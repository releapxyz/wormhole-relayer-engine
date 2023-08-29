"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardRelayerApp = void 0;
const application_1 = require("./application");
const logger_middleware_1 = require("./middleware/logger.middleware");
const missedVaas_middleware_1 = require("./middleware/missedVaas.middleware");
const providers_middleware_1 = require("./middleware/providers.middleware");
const wallet_middleware_1 = require("./middleware/wallet/wallet.middleware");
const tokenBridge_middleware_1 = require("./middleware/tokenBridge.middleware");
const staging_area_middleware_1 = require("./middleware/staging-area.middleware");
const redis_storage_1 = require("./storage/redis-storage");
const utils_1 = require("./utils");
const source_tx_middleware_1 = require("./middleware/source-tx.middleware");
const logging_1 = require("./logging");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const koa_1 = require("@bull-board/koa");
const api_1 = require("@bull-board/api");
const defaultOpts = {
    spyEndpoint: "localhost:7073",
    workflows: {
        retries: 3,
    },
    fetchSourceTxhash: true,
    logger: logging_1.defaultLogger,
};
class StandardRelayerApp extends application_1.RelayerApp {
    store;
    constructor(env, opts) {
        // take logger out before merging because of recursive call stack
        const logger = opts.logger;
        delete opts.logger;
        // now we can merge
        opts = (0, utils_1.mergeDeep)({}, [defaultOpts, opts]);
        const { privateKeys, name, spyEndpoint, redis, redisCluster, redisClusterEndpoints, wormholeRpcs, } = opts;
        super(env, opts);
        this.store = new redis_storage_1.RedisStorage({
            redis,
            redisClusterEndpoints,
            redisCluster,
            attempts: opts.workflows.retries ?? 3,
            namespace: name,
            queueName: `${name}-relays`,
        });
        this.spy(spyEndpoint);
        this.useStorage(this.store);
        this.logger(logger);
        this.use((0, logger_middleware_1.logging)(logger)); // <-- logging middleware
        this.use((0, missedVaas_middleware_1.missedVaas)(this, {
            namespace: name,
            logger,
            redis,
            redisCluster,
            redisClusterEndpoints,
            wormholeRpcs,
        }));
        this.use((0, providers_middleware_1.providers)(opts.providers));
        if (opts.privateKeys && Object.keys(opts.privateKeys).length) {
            this.use((0, wallet_middleware_1.wallets)(env, {
                logger,
                namespace: name,
                privateKeys,
                metrics: { registry: this.metricsRegistry },
            })); // <-- you need valid private keys to turn on this middleware
        }
        this.use((0, tokenBridge_middleware_1.tokenBridgeContracts)());
        this.use((0, staging_area_middleware_1.stagingArea)({
            namespace: name,
            redisCluster,
            redis,
            redisClusterEndpoints,
        }));
        if (opts.fetchSourceTxhash) {
            this.use((0, source_tx_middleware_1.sourceTx)());
        }
    }
    /**
     * Registry with prometheus metrics exported by the relayer.
     * Metrics include:
     * - active_workflows: Number of workflows currently running
     * - delayed_workflows: Number of worklows which are scheduled in the future either because they were scheduled that way or because they failed.
     * - waiting_workflows: Workflows waiting for a worker to pick them up.
     * - worklow_processing_duration: Processing time for completed jobs (processing until completed)
     * - workflow_total_duration: Processing time for completed jobs (processing until completed)
     */
    get metricsRegistry() {
        return this.store.registry;
    }
    /**
     * A UI that you can mount in a KOA app to show the status of the queue / jobs.
     * @param path
     */
    storageKoaUI(path) {
        // UI
        const serverAdapter = new koa_1.KoaAdapter();
        serverAdapter.setBasePath(path);
        (0, api_1.createBullBoard)({
            queues: [new bullMQAdapter_1.BullMQAdapter(this.store.vaaQueue)],
            serverAdapter: serverAdapter,
        });
        return serverAdapter.registerPlugin();
    }
}
exports.StandardRelayerApp = StandardRelayerApp;
//# sourceMappingURL=application-standard.js.map