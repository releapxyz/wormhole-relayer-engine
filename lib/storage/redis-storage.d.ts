/// <reference types="node" />
import { Queue } from "bullmq";
import { Logger } from "winston";
import { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import { Registry } from "prom-client";
import { onJobHandler, RelayJob, Storage } from "./storage";
export interface StorageOptions {
    redisClusterEndpoints?: ClusterNode[];
    redisCluster?: ClusterOptions;
    redis?: RedisOptions;
    queueName: string;
    attempts: number;
    namespace?: string;
    concurrency?: number;
}
export type JobData = {
    parsedVaa: any;
    vaaBytes: string;
};
export declare class RedisStorage implements Storage {
    logger: Logger;
    vaaQueue: Queue<JobData, string[], string>;
    private worker;
    private readonly prefix;
    private readonly redis;
    registry: Registry;
    private metrics;
    private opts;
    workerId: string;
    constructor(opts: StorageOptions);
    addVaaToQueue(vaaBytes: Buffer): Promise<RelayJob>;
    private vaaId;
    startWorker(handleJob: onJobHandler): void;
    stopWorker(): Promise<void>;
    spawnGaugeUpdateWorker(ms?: number): Promise<void>;
    private updateGauges;
    private onCompleted;
    storageKoaUI(path: string): Koa.Middleware<Koa.DefaultState, Koa.DefaultContext, any>;
}
