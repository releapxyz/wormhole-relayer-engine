"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisPool = exports.markProcessed = exports.markInProgress = exports.tryFetchAndProcess = exports.missedVaaJob = exports.missedVaas = void 0;
const grpcWebNodeHttpTransport = require("@improbable-eng/grpc-web-node-http-transport");
const ioredis_1 = require("ioredis");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const application_1 = require("../../application");
const generic_pool_1 = require("generic-pool");
const utils_1 = require("../../utils");
const IN_PROGRESS_TIMEOUT = 5 * utils_1.minute;
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
function missedVaas(app, opts) {
    // set defaults
    opts.redis = opts.redis || { host: "localhost", port: 6379 };
    opts.redis.keyPrefix = opts.namespace;
    opts.wormholeRpcs = opts.wormholeRpcs ?? application_1.defaultWormholeRpcs[app.env];
    const redisPool = createRedisPool(opts);
    // mark vaa processed when app emits "Added" event
    const markVaaAsProcessed = (vaa) => {
        redisPool.use(redis => markProcessed(redis, {
            emitterAddress: vaa.emitterAddress.toString("hex"),
            emitterChain: vaa.emitterChain,
            seq: vaa.sequence,
        }, opts.logger));
    };
    app.addListener(application_1.RelayerEvents.Added, markVaaAsProcessed);
    app.addListener(application_1.RelayerEvents.Skipped, markVaaAsProcessed);
    // construct dependency
    const fetchVaaFn = (vaaKey) => fetchVaa(opts.wormholeRpcs, vaaKey);
    // start worker
    setTimeout(() => startMissedVaaWorker(redisPool, app, fetchVaaFn, opts), 100); // start worker once config is done.
    // return noop middleware
    return async (ctx, next) => next();
}
exports.missedVaas = missedVaas;
// Background job to ensure no vaas are missed
async function startMissedVaaWorker(pool, app, fetchVaaFn, opts) {
    while (true) {
        await pool
            .use(redis => missedVaaJob(redis, app.filters, (redis, vaaKey) => tryFetchAndProcess(app.processVaa.bind(app), fetchVaaFn, redis, vaaKey, opts.logger), opts.logger))
            .catch(e => opts.logger?.error(`error managing redis pool.`, e));
        await (0, utils_1.sleep)(opts.checkForMissedVaasEveryMs || 30_000);
    }
}
// Job that for each registered (emitterChain, emitterAddress) pair:
// - refetches and processes all sequence numbers not marked seen or in progress since initial sequence
// - looks ahead for unseen sequences
async function missedVaaJob(redis, filters, tryFetchAndProcess, logger) {
    try {
        logger?.debug(`Checking for missed VAAs.`);
        const addressWithSeenSeqs = await (0, utils_1.mapConcurrent)(filters, async (filter) => {
            const address = {
                emitterChain: filter.emitterFilter.chainId,
                emitterAddress: filter.emitterFilter.emitterAddress,
            };
            const seenSeqs = await getAllProcessedSeqsInOrder(redis, address.emitterChain, address.emitterAddress);
            return { address, seenSeqs };
        });
        for (const { address: { emitterAddress, emitterChain }, seenSeqs, } of addressWithSeenSeqs) {
            if (seenSeqs.length === 0) {
                continue;
            }
            // comb over all seenSequences looking for gaps
            // note: seenSequences is in ascending order
            const missing = [];
            let idx = 0;
            let nextSeen = seenSeqs[0];
            for (let seq = seenSeqs[0]; seq < seenSeqs[seenSeqs.length - 1]; seq++) {
                if (seq === nextSeen) {
                    nextSeen = seenSeqs[++idx];
                    continue;
                }
                missing.push(seq);
                const vaaKey = {
                    emitterAddress,
                    emitterChain,
                    seq: seq,
                };
                await tryFetchAndProcess(redis, vaaKey, logger);
            }
            // look ahead of greatest seen sequence in case the next vaa was missed
            // continue looking ahead until a vaa can't be fetched
            for (let seq = seenSeqs[seenSeqs.length - 1] + 1n; true; seq++) {
                // iterate until fetchVaa throws because we couldn't find a next vaa.
                const vaaKey = {
                    emitterAddress,
                    emitterChain,
                    seq: seq,
                };
                const fetched = await tryFetchAndProcess(redis, vaaKey, logger);
                if (!fetched) {
                    break;
                }
                missing.push(vaaKey.seq);
            }
            if (missing.length > 0) {
                logger?.info(`missedVaaWorker found ${missing.length} missed vaas ${JSON.stringify({
                    emitterAddress,
                    emitterChain,
                    missedSequences: missing.map(seq => seq.toString()),
                })}`);
            }
        }
    }
    catch (e) {
        logger?.error(`startMissedVaaWorker loop failed with error`, e);
    }
}
exports.missedVaaJob = missedVaaJob;
// returns true if fetched and processed
async function tryFetchAndProcess(processVaa, fetchVaa, redis, key, logger) {
    try {
        const isInProgress = await fetchIsInProgress(redis, key, logger);
        if (isInProgress) {
            // short circuit is missedVaa middleware has already detected this vaa
            return false;
        }
        const fetchedVaa = await fetchVaa(key);
        logger?.info(`Possibly missed a vaa, adding to queue.`, vaaKeyReadable(key));
        // before re-triggering middleware, mark key as in progress to avoid recursion
        await markInProgress(redis, key, logger);
        // push the missed vaa through all the middleware / storage service if used.
        processVaa(Buffer.from(fetchedVaa.vaaBytes));
        return true;
    }
    catch (e) {
        // code 5 means vaa not found in store
        if (e.code !== 5) {
            logger?.error(`Could not process missed vaa. Sequence: ${key.seq.toString()}`, e);
        }
        return false;
    }
}
exports.tryFetchAndProcess = tryFetchAndProcess;
/*
 * Storage Helpers
 */
async function markInProgress(redis, keyObj, logger) {
    const key = getInProgressKey(keyObj);
    try {
        await redis
            .multi()
            .set(key, new Date().toString())
            .expire(key, IN_PROGRESS_TIMEOUT)
            .exec();
    }
    catch (e) {
        logger.error("could not mark sequence seen", e);
    }
}
exports.markInProgress = markInProgress;
async function fetchIsInProgress(redis, keyObj, logger) {
    const key = getInProgressKey(keyObj);
    try {
        const raw = await redis.get(key);
        if (!raw) {
            return false;
        }
        return new Date(raw).getTime() > Date.now() - IN_PROGRESS_TIMEOUT;
    }
    catch (e) {
        logger.error("could not mark sequence as in progress", e);
        return false;
    }
}
async function getAllProcessedSeqsInOrder(redis, emitterChain, emitterAddress) {
    const key = getKey(emitterChain, emitterAddress);
    const results = await redis.zrange(key, "-", "+", "BYLEX");
    return results.map(BigInt);
}
async function markProcessed(redis, { emitterAddress, emitterChain, seq }, logger) {
    try {
        await redis.zadd(getKey(emitterChain, emitterAddress), 0, seq.toString());
    }
    catch (e) {
        logger?.error("could not mark sequence seen", e);
    }
}
exports.markProcessed = markProcessed;
function getKey(emitterChain, emitterAddress) {
    return `missedVaasV2:${emitterChain}:${emitterAddress}`;
}
function getInProgressKey({ emitterChain, emitterAddress, seq, }) {
    return `missedVaasInProgress:${emitterChain}:${emitterAddress}:${seq.toString()}`;
}
/*
 * Utils
 */
function createRedisPool(opts) {
    const factory = {
        create: async function () {
            const redis = opts.redisCluster
                ? new ioredis_1.default.Cluster(opts.redisClusterEndpoints, opts.redisCluster)
                : new ioredis_1.default(opts.redis);
            return redis;
        },
        destroy: async function (redis) {
            // do something when destroyed?
        },
    };
    const poolOpts = {
        min: 5,
        max: 15,
        autostart: true,
    };
    return (0, generic_pool_1.createPool)(factory, poolOpts);
}
exports.createRedisPool = createRedisPool;
function vaaKeyReadable(key) {
    return {
        emitterAddress: key.emitterAddress,
        emitterChain: key.emitterChain.toString(),
        sequence: key.seq.toString(),
    };
}
async function fetchVaa(rpc, { emitterChain, emitterAddress, seq }) {
    return await (0, wormhole_sdk_1.getSignedVAAWithRetry)(rpc, emitterChain, emitterAddress, seq.toString(), { transport: grpcWebNodeHttpTransport.NodeHttpTransport() }, 100, 2);
}
//# sourceMappingURL=missedVaas.middleware.js.map