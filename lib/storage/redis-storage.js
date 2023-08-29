"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStorage = void 0;
const bullmq_1 = require("bullmq");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ioredis_1 = require("ioredis");
const storage_metrics_1 = require("../storage.metrics");
const utils_1 = require("../utils");
const koa_1 = require("@bull-board/koa");
const api_1 = require("@bull-board/api");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
function serializeVaa(vaa) {
    return {
        sequence: vaa.sequence.toString(),
        hash: vaa.hash.toString("base64"),
        emitterChain: vaa.emitterChain,
        emitterAddress: vaa.emitterAddress.toString("hex"),
        payload: vaa.payload.toString("base64"),
        nonce: vaa.nonce,
        timestamp: vaa.timestamp,
        version: vaa.version,
        guardianSignatures: vaa.guardianSignatures.map(sig => ({
            signature: sig.signature.toString("base64"),
            index: sig.index,
        })),
        consistencyLevel: vaa.consistencyLevel,
        guardianSetIndex: vaa.guardianSetIndex,
    };
}
function deserializeVaa(vaa) {
    return {
        sequence: BigInt(vaa.sequence),
        hash: Buffer.from(vaa.hash, "base64"),
        emitterChain: vaa.emitterChain,
        emitterAddress: Buffer.from(vaa.emitterAddress, "hex"),
        payload: Buffer.from(vaa.payload, "base64"),
        nonce: vaa.nonce,
        timestamp: vaa.timestamp,
        version: vaa.version,
        guardianSignatures: vaa.guardianSignatures.map((sig) => ({
            signature: Buffer.from(sig.signature, "base64"),
            index: sig.index,
        })),
        consistencyLevel: vaa.consistencyLevel,
        guardianSetIndex: vaa.guardianSetIndex,
    };
}
const defaultOptions = {
    attempts: 3,
    redis: {},
    queueName: "relays",
    concurrency: 3,
};
class RedisStorage {
    logger;
    vaaQueue;
    worker;
    prefix;
    redis;
    registry;
    metrics;
    opts;
    workerId;
    constructor(opts) {
        this.opts = Object.assign({}, defaultOptions, opts);
        // ensure redis is defined
        if (!this.opts.redis) {
            this.opts.redis = {};
        }
        this.opts.redis.maxRetriesPerRequest = null; //Added because of: DEPRECATION WARNING! Your redis options maxRetriesPerRequest must be null. On the next versions having this settings will throw an exception
        this.prefix = `{${this.opts.namespace ?? this.opts.queueName}}`;
        this.redis =
            this.opts.redisClusterEndpoints?.length > 0
                ? new ioredis_1.Redis.Cluster(this.opts.redisClusterEndpoints, this.opts.redisCluster)
                : new ioredis_1.Redis(this.opts.redis);
        this.vaaQueue = new bullmq_1.Queue(this.opts.queueName, {
            prefix: this.prefix,
            connection: this.redis,
        });
        const { metrics, registry } = (0, storage_metrics_1.createStorageMetrics)();
        this.metrics = metrics;
        this.registry = registry;
    }
    async addVaaToQueue(vaaBytes) {
        const parsedVaa = (0, wormhole_sdk_1.parseVaa)(vaaBytes);
        const id = this.vaaId(parsedVaa);
        const idWithoutHash = id.substring(0, id.length - 6);
        this.logger?.debug(`Adding VAA to queue`, {
            emitterChain: parsedVaa.emitterChain,
            emitterAddress: parsedVaa.emitterAddress.toString("hex"),
            sequence: parsedVaa.sequence.toString(),
        });
        const job = await this.vaaQueue.add(idWithoutHash, {
            parsedVaa: serializeVaa(parsedVaa),
            vaaBytes: vaaBytes.toString("base64"),
        }, {
            jobId: id,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: this.opts.attempts,
        });
        return {
            attempts: 0,
            data: { vaaBytes, parsedVaa },
            id: job.id,
            name: job.name,
            log: job.log.bind(job),
            updateProgress: job.updateProgress.bind(job),
            maxAttempts: this.opts.attempts,
        };
    }
    vaaId(vaa) {
        const emitterAddress = vaa.emitterAddress.toString("hex");
        const hash = vaa.hash.toString("base64").substring(0, 5);
        let sequence = vaa.sequence.toString();
        return `${vaa.emitterChain}/${emitterAddress}/${sequence}/${hash}`;
    }
    startWorker(handleJob) {
        this.logger?.debug(`Starting worker for queue: ${this.opts.queueName}. Prefix: ${this.prefix}.`);
        this.worker = new bullmq_1.Worker(this.opts.queueName, async (job) => {
            let parsedVaa = job.data?.parsedVaa;
            if (parsedVaa) {
                this.logger?.debug(`Starting job: ${job.id}`, {
                    emitterChain: parsedVaa.emitterChain,
                    emitterAddress: parsedVaa.emitterAddress.toString("hex"),
                    sequence: parsedVaa.sequence.toString(),
                });
            }
            else {
                this.logger.debug("Received job with no parsedVaa");
            }
            const vaaBytes = Buffer.from(job.data.vaaBytes, "base64");
            const relayJob = {
                attempts: job.attemptsMade,
                data: {
                    vaaBytes,
                    parsedVaa: (0, wormhole_sdk_1.parseVaa)(vaaBytes),
                },
                id: job.id,
                maxAttempts: this.opts.attempts,
                name: job.name,
                log: job.log.bind(job),
                updateProgress: job.updateProgress.bind(job),
            };
            await job.log(`processing by..${this.workerId}`);
            await handleJob(relayJob);
            return;
        }, {
            prefix: this.prefix,
            connection: this.redis,
            concurrency: this.opts.concurrency,
        });
        this.workerId = this.worker.id;
        this.worker.on("completed", this.onCompleted.bind(this));
        this.spawnGaugeUpdateWorker();
    }
    async stopWorker() {
        await this.worker?.close();
        this.worker = null;
    }
    async spawnGaugeUpdateWorker(ms = 5000) {
        while (this.worker !== null) {
            await this.updateGauges();
            await (0, utils_1.sleep)(ms);
        }
    }
    async updateGauges() {
        const { active, delayed, waiting } = await this.vaaQueue.getJobCounts();
        this.metrics.activeGauge.labels({ queue: this.vaaQueue.name }).set(active);
        this.metrics.delayedGauge
            .labels({ queue: this.vaaQueue.name })
            .set(delayed);
        this.metrics.waitingGauge
            .labels({ queue: this.vaaQueue.name })
            .set(waiting);
    }
    async onCompleted(job) {
        const completedDuration = job.finishedOn - job.timestamp; // neither can be null
        const processedDuration = job.finishedOn - job.processedOn; // neither can be null
        this.metrics.completedDuration
            .labels({ queue: this.vaaQueue.name })
            .observe(completedDuration);
        this.metrics.processedDuration
            .labels({ queue: this.vaaQueue.name })
            .observe(processedDuration);
    }
    storageKoaUI(path) {
        // UI
        const serverAdapter = new koa_1.KoaAdapter();
        serverAdapter.setBasePath(path);
        (0, api_1.createBullBoard)({
            queues: [new bullMQAdapter_1.BullMQAdapter(this.vaaQueue)],
            serverAdapter: serverAdapter,
        });
        return serverAdapter.registerPlugin();
    }
}
exports.RedisStorage = RedisStorage;
//# sourceMappingURL=redis-storage.js.map