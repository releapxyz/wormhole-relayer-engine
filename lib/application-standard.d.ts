import { Environment, RelayerApp, RelayerAppOpts } from "./application";
import { LoggingContext } from "./middleware/logger.middleware";
import { ProvidersOpts } from "./middleware/providers.middleware";
import { WalletContext } from "./middleware/wallet/wallet.middleware";
import { TokenBridgeContext } from "./middleware/tokenBridge.middleware";
import { StagingAreaContext } from "./middleware/staging-area.middleware";
import { Logger } from "winston";
import { StorageContext } from "./storage/storage";
import { ChainId } from "@certusone/wormhole-sdk";
import { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import { SourceTxContext } from "./middleware/source-tx.middleware";
export interface StandardRelayerAppOpts extends RelayerAppOpts {
    name: string;
    spyEndpoint?: string;
    logger?: Logger;
    privateKeys?: Partial<{
        [k in ChainId]: any[];
    }>;
    workflows?: {
        retries: number;
    };
    providers?: ProvidersOpts;
    redisClusterEndpoints?: ClusterNode[];
    redisCluster?: ClusterOptions;
    redis?: RedisOptions;
    fetchSourceTxhash?: boolean;
}
export type StandardRelayerContext = LoggingContext & StorageContext & TokenBridgeContext & StagingAreaContext & WalletContext & SourceTxContext;
export declare class StandardRelayerApp<ContextT extends StandardRelayerContext = StandardRelayerContext> extends RelayerApp<ContextT> {
    private store;
    constructor(env: Environment, opts: StandardRelayerAppOpts);
    /**
     * Registry with prometheus metrics exported by the relayer.
     * Metrics include:
     * - active_workflows: Number of workflows currently running
     * - delayed_workflows: Number of worklows which are scheduled in the future either because they were scheduled that way or because they failed.
     * - waiting_workflows: Workflows waiting for a worker to pick them up.
     * - worklow_processing_duration: Processing time for completed jobs (processing until completed)
     * - workflow_total_duration: Processing time for completed jobs (processing until completed)
     */
    get metricsRegistry(): import("prom-client").Registry;
    /**
     * A UI that you can mount in a KOA app to show the status of the queue / jobs.
     * @param path
     */
    storageKoaUI(path: string): Koa.Middleware<Koa.DefaultState, Koa.DefaultContext, any>;
}
