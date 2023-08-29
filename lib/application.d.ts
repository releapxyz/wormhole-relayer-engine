/// <reference types="node" />
/// <reference types="node" />
import { EventEmitter } from "events";
import { ChainId, ChainName, ParsedVaa, SignedVaa } from "@certusone/wormhole-sdk";
import { ErrorMiddleware, Middleware, Next } from "./compose.middleware";
import { Context } from "./context";
import { Logger } from "winston";
import { BigNumber } from "ethers";
import { ChainID } from "@certusone/wormhole-spydk/lib/cjs/proto/publicrpc/v1/publicrpc";
import { UnrecoverableError } from "bullmq";
import { VaaId } from "./bundle-fetcher.helper";
import { RelayJob, Storage } from "./storage/storage";
export declare enum Environment {
    MAINNET = "mainnet",
    TESTNET = "testnet",
    DEVNET = "devnet"
}
export { UnrecoverableError };
export interface RelayerAppOpts {
    wormholeRpcs?: string[];
    concurrency?: number;
}
export type FetchaVaasOpts = {
    ids: VaaId[];
    delayBetweenRequestsInMs?: number;
    attempts?: number;
};
export declare const defaultWormholeRpcs: {
    mainnet: string[];
    testnet: string[];
    devnet: string[];
};
interface SerializableVaaId {
    emitterChain: ChainId;
    emitterAddress: string;
    sequence: string;
}
export interface ParsedVaaWithBytes extends ParsedVaa {
    id: SerializableVaaId;
    bytes: SignedVaa;
}
export type FilterFN = (vaaBytes: ParsedVaaWithBytes) => Promise<boolean> | boolean;
export declare enum RelayerEvents {
    Received = "received",
    Added = "added",
    Skipped = "skipped",
    Completed = "completed",
    Failed = "failed"
}
export type ListenerFn = (vaa: ParsedVaaWithBytes, job?: RelayJob) => void;
export declare class RelayerApp<ContextT extends Context> extends EventEmitter {
    env: Environment;
    private pipeline?;
    private errorPipeline?;
    private chainRouters;
    private spyUrl?;
    private rootLogger;
    storage: Storage;
    filters: {
        emitterFilter?: {
            chainId?: ChainID;
            emitterAddress?: string;
        };
    }[];
    private opts;
    private vaaFilters;
    constructor(env?: Environment, opts?: RelayerAppOpts);
    /**
     *  This function will run as soon as a VAA is received and will determine whether we want to process it or skip it.
     *  This is useful if you're listening to a contract but you don't care about every one of the VAAs emitted by it (eg. The Token Bridge contract).
     *
     *  WARNING: If your function throws, the VAA will be skipped (is this the right behavior?). If you want to process the VAA anyway, catch your errors and return true.
     *
     * @param newFilter pass in a function that will receive the raw bytes of the VAA and if it returns `true` or `Promise<true>` the VAA will be processed, otherwise it will be skipped
     */
    filter(newFilter: FilterFN): void;
    private shouldProcessVaa;
    on(eventName: RelayerEvents, listener: ListenerFn): this;
    emit(eventName: RelayerEvents, vaa: ParsedVaaWithBytes, job?: RelayJob, ...args: any): boolean;
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
    multiple(chainsAndAddresses: Partial<{
        [k in ChainId]: string[] | string;
    }>, ...middleware: Middleware<ContextT>[]): void;
    /**
     * Pass in a set of middlewares that will run for each request
     * @example:
     * ```
     * relayerApp.use(logging(logger));
     * ```
     * @param middleware
     */
    use(...middleware: Middleware<ContextT>[] | ErrorMiddleware<ContextT>[]): void;
    fetchVaas(opts: FetchaVaasOpts): Promise<ParsedVaaWithBytes[]>;
    /**
     * Fetches a VAA from a wormhole compatible RPC.
     * You can specify how many times to retry in case it fails and how long to wait between retries
     * @param chain emitterChain
     * @param emitterAddress
     * @param sequence
     * @param retryTimeout backoff between retries
     * @param retries number of attempts
     */
    fetchVaa(chain: ChainId | string, emitterAddress: Buffer | string, sequence: bigint | string | BigNumber, { retryTimeout, retries, }?: {
        retryTimeout: number;
        retries: number;
    }): Promise<ParsedVaaWithBytes>;
    /**
     * processVaa allows you to put a VAA through the pipeline leveraging storage if needed.
     * @param vaa
     * @param opts You can use this to extend the context that will be passed to the middleware
     */
    processVaa(vaa: Buffer, opts?: any): Promise<void>;
    /**
     * Pushes a vaa through the pipeline. Unless you're the storage service you probably want to use `processVaa`.
     * @param vaa
     * @param opts
     */
    private pushVaaThroughPipeline;
    /**
     * Gives you a Chain router so you can add middleware on an address.
     * @example:
     * ```
     * relayerApp.chain(CHAIN_ID_ETH).address("0x0001234abcdef...", middleware1, middleware2);
     * ```
     *
     * @param chainId
     */
    chain(chainId: ChainId): ChainRouter<ContextT>;
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
    tokenBridge(chainsOrChain: ChainId[] | ChainName[] | ChainId | ChainName, ...handlers: Middleware<ContextT>[]): this;
    private spyFilters;
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
    spy(url: string): this;
    /**
     * Set a logger for the relayer app. Not to be confused with a logger for the middleware. This is for when the relayer app needs to log info/error.
     *
     * @param logger
     */
    logger(logger: Logger): void;
    /**
     * Configure your storage by passing info redis connection info among other details.
     * If you are using RelayerApp<any>, and you do not call this method, you will not be using storage.
     * Which means your VAAS will go straight through the pipeline instead of being added to a queue.
     * @param storage
     */
    useStorage(storage: Storage): void;
    private generateChainRoutes;
    /**
     * Connect to the spy and start processing VAAs.
     */
    listen(): Promise<void>;
    /**
     * Stop the worker from grabbing more jobs and wait until it finishes with the ones that it has.
     */
    stop(): Promise<void>;
    private onVaaFromQueue;
}
declare class ChainRouter<ContextT extends Context> {
    chainId: ChainId;
    _addressHandlers: Record<string, Middleware<ContextT>>;
    constructor(chainId: ChainId);
    /**
     * Specify an address in native format (eg base58 for solana) and a set of middleware to run when we receive a VAA from that address
     * @param address
     * @param handlers
     */
    address: (address: string, ...handlers: Middleware<ContextT>[]) => ChainRouter<ContextT>;
    spyFilters(): {
        emitterFilter: ContractFilter;
    }[];
    process(ctx: ContextT, next: Next): Promise<void>;
}
export type ContractFilter = {
    emitterAddress: string;
    chainId: ChainId;
};
