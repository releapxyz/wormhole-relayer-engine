"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayerApp = exports.RelayerEvents = exports.defaultWormholeRpcs = exports.UnrecoverableError = exports.Environment = void 0;
const events_1 = require("events");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const compose_middleware_1 = require("./compose.middleware");
const wormhole_spydk_1 = require("@certusone/wormhole-spydk");
const bullmq_1 = require("bullmq");
Object.defineProperty(exports, "UnrecoverableError", { enumerable: true, get: function () { return bullmq_1.UnrecoverableError; } });
const utils_1 = require("./utils");
const grpcWebNodeHttpTransport = require("@improbable-eng/grpc-web-node-http-transport");
const logging_1 = require("./logging");
const bundle_fetcher_helper_1 = require("./bundle-fetcher.helper");
var Environment;
(function (Environment) {
    Environment["MAINNET"] = "mainnet";
    Environment["TESTNET"] = "testnet";
    Environment["DEVNET"] = "devnet";
})(Environment = exports.Environment || (exports.Environment = {}));
exports.defaultWormholeRpcs = {
    [Environment.MAINNET]: ["https://api.wormscan.io"],
    [Environment.TESTNET]: [
        "https://wormhole-v2-testnet-api.certus.one",
        "https://api.testnet.wormscan.io",
    ],
    [Environment.DEVNET]: [""],
};
const defaultOpts = (env) => ({
    wormholeRpcs: exports.defaultWormholeRpcs[env],
    concurrency: 1,
});
var RelayerEvents;
(function (RelayerEvents) {
    RelayerEvents["Received"] = "received";
    RelayerEvents["Added"] = "added";
    RelayerEvents["Skipped"] = "skipped";
    RelayerEvents["Completed"] = "completed";
    RelayerEvents["Failed"] = "failed";
})(RelayerEvents = exports.RelayerEvents || (exports.RelayerEvents = {}));
class RelayerApp extends events_1.EventEmitter {
    env;
    pipeline;
    errorPipeline;
    chainRouters = {};
    spyUrl;
    rootLogger;
    storage;
    filters = [];
    opts;
    vaaFilters = [];
    constructor(env = Environment.TESTNET, opts = {}) {
        super();
        this.env = env;
        this.opts = (0, utils_1.mergeDeep)({}, [defaultOpts(env), opts]);
    }
    /**
     *  This function will run as soon as a VAA is received and will determine whether we want to process it or skip it.
     *  This is useful if you're listening to a contract but you don't care about every one of the VAAs emitted by it (eg. The Token Bridge contract).
     *
     *  WARNING: If your function throws, the VAA will be skipped (is this the right behavior?). If you want to process the VAA anyway, catch your errors and return true.
     *
     * @param newFilter pass in a function that will receive the raw bytes of the VAA and if it returns `true` or `Promise<true>` the VAA will be processed, otherwise it will be skipped
     */
    filter(newFilter) {
        this.vaaFilters.push(newFilter);
    }
    async shouldProcessVaa(vaa) {
        if (this.vaaFilters.length === 0) {
            return true;
        }
        for (let i = 0; i < this.vaaFilters.length; i++) {
            const chain = vaa.emitterChain;
            const emitterAddress = vaa.emitterAddress.toString("hex");
            const sequence = vaa.sequence.toString();
            const filter = this.vaaFilters[i];
            let isOk;
            try {
                isOk = await filter(vaa);
            }
            catch (e) {
                isOk = false;
                this.rootLogger.debug(`filter ${i} of ${this.vaaFilters.length} threw an exception`, {
                    chain,
                    emitterAddress,
                    sequence,
                    message: e.message,
                    stack: e.stack,
                    name: e.name,
                });
            }
            if (!isOk) {
                this.rootLogger.debug(`Vaa was skipped by filter ${i} of ${this.vaaFilters.length}`, { chain, emitterAddress, sequence });
                return false;
            }
        }
        return true;
    }
    on(eventName, listener) {
        return super.on(eventName, listener);
    }
    emit(eventName, vaa, job, ...args) {
        return super.emit(eventName, vaa, job, ...args);
    }
    /**
     * Allows you to pass an object that specifies a combination of chains with address for which you want to run middleware.
     *
     * @example:
     * ```
     * relayerApp.multiple({[CHAIN_ID_SOLANA]: "mysolanaAddress", [ CHAIN_ID_ETH ]: "0xMyEthAddress" }, middleware1, middleware2)
     * ```
     *
     * This would run `middleware1` and `middleware2` for the address `mysolanaAddress` in Solana and for the address `0xMyEthAddress` in Ethereum.
     * @param chainsAndAddresses
     * @param middleware
     */
    multiple(chainsAndAddresses, ...middleware) {
        for (let [chain, addresses] of Object.entries(chainsAndAddresses)) {
            addresses = Array.isArray(addresses) ? addresses : [addresses];
            const chainRouter = this.chain(Number(chain));
            for (const address of addresses) {
                chainRouter.address(address, ...middleware);
            }
        }
    }
    /**
     * Pass in a set of middlewares that will run for each request
     * @example:
     * ```
     * relayerApp.use(logging(logger));
     * ```
     * @param middleware
     */
    use(...middleware) {
        if (!middleware.length) {
            return;
        }
        // adding error middleware
        if (middleware[0].length > 2) {
            if (this.errorPipeline) {
                middleware.unshift(this.errorPipeline);
            }
            this.errorPipeline = (0, compose_middleware_1.composeError)(middleware);
            return;
        }
        // adding regular middleware
        if (this.pipeline) {
            middleware.unshift(this.pipeline);
        }
        this.pipeline = (0, compose_middleware_1.compose)(middleware);
    }
    fetchVaas(opts) {
        const bundle = new bundle_fetcher_helper_1.VaaBundleFetcher(this.fetchVaa.bind(this), {
            vaaIds: opts.ids,
            maxAttempts: opts.attempts,
            delayBetweenAttemptsInMs: opts.delayBetweenRequestsInMs,
        });
        return bundle.build();
    }
    /**
     * Fetches a VAA from a wormhole compatible RPC.
     * You can specify how many times to retry in case it fails and how long to wait between retries
     * @param chain emitterChain
     * @param emitterAddress
     * @param sequence
     * @param retryTimeout backoff between retries
     * @param retries number of attempts
     */
    async fetchVaa(chain, emitterAddress, sequence, { retryTimeout = 100, retries = 2, } = {
        retryTimeout: 100,
        retries: 2,
    }) {
        const res = await (0, wormhole_sdk_1.getSignedVAAWithRetry)(this.opts.wormholeRpcs, Number(chain), emitterAddress.toString("hex"), sequence.toString(), { transport: grpcWebNodeHttpTransport.NodeHttpTransport() }, retryTimeout, retries);
        return (0, utils_1.parseVaaWithBytes)(res.vaaBytes);
    }
    /**
     * processVaa allows you to put a VAA through the pipeline leveraging storage if needed.
     * @param vaa
     * @param opts You can use this to extend the context that will be passed to the middleware
     */
    async processVaa(vaa, opts = {}) {
        let parsedVaa = (0, utils_1.parseVaaWithBytes)(vaa);
        this.emit(RelayerEvents.Received, parsedVaa);
        if (!(await this.shouldProcessVaa(parsedVaa)) && !opts.force) {
            this.rootLogger?.debug("VAA did not pass filters. Skipping...", {
                emitterChain: parsedVaa.emitterChain,
                emitterAddress: parsedVaa.emitterAddress.toString("hex"),
                sequence: parsedVaa.sequence.toString(),
            });
            this.emit(RelayerEvents.Skipped, parsedVaa);
            return;
        }
        if (this.storage) {
            const job = await this.storage.addVaaToQueue(parsedVaa.bytes);
            this.emit(RelayerEvents.Added, parsedVaa, job);
        }
        else {
            this.emit(RelayerEvents.Added, parsedVaa);
            await this.pushVaaThroughPipeline(vaa, opts);
        }
    }
    /**
     * Pushes a vaa through the pipeline. Unless you're the storage service you probably want to use `processVaa`.
     * @param vaa
     * @param opts
     */
    async pushVaaThroughPipeline(vaa, opts) {
        const parsedVaa = (0, utils_1.parseVaaWithBytes)(vaa);
        let ctx = {
            config: {
                spyFilters: await this.spyFilters(),
            },
            env: this.env,
            fetchVaa: this.fetchVaa.bind(this),
            fetchVaas: this.fetchVaas.bind(this),
            locals: {},
            on: this.on.bind(this),
            processVaa: this.processVaa.bind(this),
            vaa: parsedVaa,
            vaaBytes: vaa,
        };
        Object.assign(ctx, opts);
        try {
            await this.pipeline?.(ctx, () => { });
            this.emit(RelayerEvents.Completed, parsedVaa, opts?.storage?.job);
        }
        catch (e) {
            this.errorPipeline?.(e, ctx, () => { });
            this.emit(RelayerEvents.Failed, parsedVaa, opts?.storage?.job);
            throw e;
        }
    }
    /**
     * Gives you a Chain router so you can add middleware on an address.
     * @example:
     * ```
     * relayerApp.chain(CHAIN_ID_ETH).address("0x0001234abcdef...", middleware1, middleware2);
     * ```
     *
     * @param chainId
     */
    chain(chainId) {
        if (!this.chainRouters[chainId]) {
            this.chainRouters[chainId] = new ChainRouter(chainId);
        }
        return this.chainRouters[chainId];
    }
    /**
     * A convenient shortcut to subscribe to tokenBridge messages.
     * @example:
     * ```
     * relayerApp.tokenBridge(["ethereum", CHAIN_ID_SOLANA], middleware1, middleware2)
     * ```
     *
     * Would run middleware1 and middleware2 for any tokenBridge vaa coming from ethereum or solana.
     *
     * @param chainsOrChain
     * @param handlers
     */
    tokenBridge(chainsOrChain, ...handlers) {
        const chains = Array.isArray(chainsOrChain)
            ? chainsOrChain
            : [chainsOrChain];
        for (const chainIdOrName of chains) {
            const chainName = (0, wormhole_sdk_1.coalesceChainName)(chainIdOrName);
            const chainId = (0, wormhole_sdk_1.coalesceChainId)(chainIdOrName);
            let address = 
            // @ts-ignore TODO
            wormhole_sdk_1.CONTRACTS[this.env.toUpperCase()][chainName].token_bridge;
            this.chain(chainId).address(address, ...handlers);
        }
        return this;
    }
    async spyFilters() {
        const spyFilters = new Set();
        for (const chainRouter of Object.values(this.chainRouters)) {
            for (const filter of await chainRouter.spyFilters()) {
                spyFilters.add(filter);
            }
        }
        return Array.from(spyFilters.values());
    }
    /**
     * Pass in the URL where you have an instance of the spy listening. Usually localhost:7073
     *
     * You can run the spy locally (for TESTNET) by doing:
     * ```
      docker run \
          --platform=linux/amd64 \
          -p 7073:7073 \
          --entrypoint /guardiand \
          ghcr.io/wormhole-foundation/guardiand:latest \
      spy --nodeKey /node.key --spyRPC "[::]:7073" --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWAkB9ynDur1Jtoa97LBUp8RXdhzS5uHgAfdTquJbrbN7i
     * ```
     *
     * You can run the spy locally (for MAINNET) by doing:
     * ```
     docker run \
        --platform=linux/amd64 \
        -p 7073:7073 \
        --entrypoint /guardiand \
        ghcr.io/wormhole-foundation/guardiand:latest \
     spy --nodeKey /node.key --spyRPC "[::]:7073" --network /wormhole/mainnet/2 --bootstrap /dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7,/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC
     * ```
     * @param url
     */
    spy(url) {
        this.spyUrl = url;
        return this;
    }
    /**
     * Set a logger for the relayer app. Not to be confused with a logger for the middleware. This is for when the relayer app needs to log info/error.
     *
     * @param logger
     */
    logger(logger) {
        this.rootLogger = logger;
    }
    /**
     * Configure your storage by passing info redis connection info among other details.
     * If you are using RelayerApp<any>, and you do not call this method, you will not be using storage.
     * Which means your VAAS will go straight through the pipeline instead of being added to a queue.
     * @param storage
     */
    useStorage(storage) {
        this.storage = storage;
    }
    generateChainRoutes() {
        return async (ctx, next) => {
            let router = this.chainRouters[ctx.vaa.emitterChain];
            if (!router) {
                this.rootLogger.error("received a vaa but we don't have a router for it");
                return;
            }
            await router.process(ctx, next);
        };
    }
    /**
     * Connect to the spy and start processing VAAs.
     */
    async listen() {
        this.rootLogger = this.rootLogger ?? logging_1.defaultLogger;
        this.use(this.generateChainRoutes());
        this.filters = await this.spyFilters();
        this.rootLogger.debug(JSON.stringify(this.filters, null, 2));
        if (this.filters.length > 0 && !this.spyUrl) {
            throw new Error("you need to setup the spy url");
        }
        this.storage?.startWorker(this.onVaaFromQueue);
        while (true) {
            const client = (0, wormhole_spydk_1.createSpyRPCServiceClient)(this.spyUrl);
            try {
                const stream = await (0, wormhole_spydk_1.subscribeSignedVAA)(client, {
                    filters: this.filters,
                });
                this.rootLogger.info(`connected to the spy at: ${this.spyUrl}`);
                for await (const vaa of stream) {
                    this.rootLogger.debug(`Received VAA through spy`);
                    this.processVaa(vaa.vaaBytes);
                }
            }
            catch (err) {
                this.rootLogger.error("error connecting to the spy");
            }
            await (0, utils_1.sleep)(300); // wait a bit before trying to reconnect.
        }
    }
    /**
     * Stop the worker from grabbing more jobs and wait until it finishes with the ones that it has.
     */
    stop() {
        return this.storage.stopWorker();
    }
    onVaaFromQueue = async (job) => {
        await this.pushVaaThroughPipeline(job.data.vaaBytes, { storage: { job } });
        await job.updateProgress(100);
        return [""];
    };
}
exports.RelayerApp = RelayerApp;
class ChainRouter {
    chainId;
    _addressHandlers = {};
    constructor(chainId) {
        this.chainId = chainId;
    }
    /**
     * Specify an address in native format (eg base58 for solana) and a set of middleware to run when we receive a VAA from that address
     * @param address
     * @param handlers
     */
    address = (address, ...handlers) => {
        address = (0, utils_1.encodeEmitterAddress)(this.chainId, address);
        if (!this._addressHandlers[address]) {
            this._addressHandlers[address] = (0, compose_middleware_1.compose)(handlers);
        }
        else {
            this._addressHandlers[address] = (0, compose_middleware_1.compose)([
                this._addressHandlers[address],
                ...handlers,
            ]);
        }
        return this;
    };
    spyFilters() {
        let addresses = Object.keys(this._addressHandlers);
        return addresses.map(address => ({
            emitterFilter: { chainId: this.chainId, emitterAddress: address },
        }));
    }
    async process(ctx, next) {
        let addr = ctx.vaa.emitterAddress.toString("hex");
        let handler = this._addressHandlers[addr];
        if (!handler) {
            throw new Error("route undefined");
        }
        return handler?.(ctx, next);
    }
}
//# sourceMappingURL=application.js.map