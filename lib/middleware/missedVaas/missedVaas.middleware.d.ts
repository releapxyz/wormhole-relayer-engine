/// <reference types="node" />
import { Middleware } from "../../compose.middleware";
import Redis, { Cluster, RedisOptions } from "ioredis";
import { ChainId } from "@certusone/wormhole-sdk";
import { RelayerApp } from "../../application";
import { Logger } from "winston";
import { Pool } from "generic-pool";
import { RedisConnectionOpts } from "../../storage/redis-storage";
import { GetSignedVAAResponse } from "@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc";
export type { RedisOptions };
export interface MissedVaaOpts extends RedisConnectionOpts {
    checkForMissedVaasEveryMs?: number;
    wormholeRpcs?: string[];
    logger?: Logger;
}
export interface VaaKey {
    emitterChain: number;
    emitterAddress: string;
    seq: bigint;
}
type FetchVaaFn = (vaa: VaaKey) => Promise<GetSignedVAAResponse>;
type ProcessVaaFn = (x: Buffer) => Promise<void>;
type TryFetchAndProcessFn = (redis: Redis | Cluster, vaaKey: VaaKey, logger?: Logger) => Promise<boolean>;
/**
 * Storage schema
 * chain/emitter -> sortedSet -> seq
 *
 * Job:
 * - requery for missed vaas
 * - query next vaa
 *
 * Middleware
 * - requery for missed vaas since last seen (not all)
 */
export declare function missedVaas(app: RelayerApp<any>, opts: MissedVaaOpts): Middleware;
export declare function missedVaaJob(redis: Redis | Cluster, filters: {
    emitterFilter?: {
        chainId?: ChainId;
        emitterAddress?: string;
    };
}[], tryFetchAndProcess: TryFetchAndProcessFn, logger?: Logger): Promise<void>;
export declare function tryFetchAndProcess(processVaa: ProcessVaaFn, fetchVaa: FetchVaaFn, redis: Redis | Cluster, key: VaaKey, logger?: Logger): Promise<boolean>;
export declare function markInProgress(redis: Redis | Cluster, keyObj: VaaKey, logger: Logger): Promise<void>;
export declare function markProcessed(redis: Redis | Cluster, { emitterAddress, emitterChain, seq }: VaaKey, logger: Logger): Promise<void>;
export declare function createRedisPool(opts: RedisConnectionOpts): Pool<Redis | Cluster>;
