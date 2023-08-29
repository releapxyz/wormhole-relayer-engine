"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFileAndParseToObject = exports.loadRelayerEngineConfig = exports.run = exports.Mode = void 0;
var StoreType;
(function (StoreType) {
    StoreType["Redis"] = "Redis";
})(StoreType || (StoreType = {}));
var Mode;
(function (Mode) {
    Mode["LISTENER"] = "LISTENER";
    Mode["EXECUTOR"] = "EXECUTOR";
    Mode["BOTH"] = "BOTH";
})(Mode = exports.Mode || (exports.Mode = {}));
/** @deprecated use the app builder directly, see example project for modern APIs or source code for this function*/
async function run(args, env) {
    if (Object.keys(args.plugins).length !== 1) {
        logging_1.defaultLogger.error(`Plugin compat layer supports running 1 plugin, ${args.plugins.length} provided`);
    }
    // load engine config
    let configs;
    if (typeof args.configs === "string") {
        configs = await loadRelayerEngineConfig(args.configs, Mode.BOTH, {
            privateKeyEnv: true,
        });
    }
    else {
        configs = args.configs;
    }
    const { commonEnv, executorEnv, listenerEnv } = configs;
    const redis = configs.commonEnv.redis;
    const app = new application_standard_1.StandardRelayerApp(env, {
        name: "legacy_relayer",
        fetchSourceTxhash: false,
        redis: redis
            ? {
                host: redis?.host,
                port: redis?.port,
                // todo: tls: undefined,
                username: redis?.username,
                password: redis?.password,
            }
            : {},
        redisCluster: redis?.cluster
            ? {
                dnsLookup: (address, callback) => callback(null, address),
                slotsRefreshTimeout: 1000,
                redisOptions: {
                    // todo: tls: undefined,
                    username: redis?.username,
                    password: redis?.password,
                },
            }
            : undefined,
        redisClusterEndpoints: redis?.cluster ? [redis.host] : undefined,
        spyEndpoint: listenerEnv.spyServiceHost,
        logger: logging_1.defaultLogger,
        privateKeys: executorEnv.privateKeys,
    });
    const [pluginName, pluginFn] = Object.entries(args.plugins)[0];
    const plugin = pluginFn(commonEnv, logging_1.defaultLogger);
    (0, legacy_plugin_middleware_1.legacyPluginCompat)(app, plugin);
    await app.listen();
}
exports.run = run;
let executorEnv = undefined;
let commonEnv = undefined;
let listenerEnv = undefined;
function loadRelayerEngineConfig(dir, mode, { privateKeyEnv = true } = {
    privateKeyEnv: true,
}) {
    return loadUntypedEnvs(dir, mode, { privateKeyEnv }).then(validateEnvs);
}
exports.loadRelayerEngineConfig = loadRelayerEngineConfig;
function transformEnvs({ mode, rawCommonEnv, rawListenerEnv, rawExecutorEnv, }) {
    return {
        mode,
        rawCommonEnv,
        rawListenerEnv,
        rawExecutorEnv: {
            ...rawExecutorEnv,
            privateKeys: transformPrivateKeys(rawExecutorEnv.privateKeys),
        },
    };
}
function validateEnvs(input) {
    console.log("Validating envs...");
    try {
        input = transformEnvs(input);
    }
    catch (e) { }
    commonEnv = validateCommonEnv(input.rawCommonEnv);
    if (input.rawExecutorEnv) {
        executorEnv = validateExecutorEnv(input.rawExecutorEnv, commonEnv.supportedChains.map(c => c.chainId));
    }
    if (input.rawListenerEnv) {
        listenerEnv = validateListenerEnv(input.rawListenerEnv);
    }
    console.log("Validated envs");
    return {
        executorEnv,
        listenerEnv,
        commonEnv,
    };
}
function validateCommonEnv(raw) {
    return {
        namespace: raw.namespace,
        logLevel: raw.logLevel,
        storeType: validateStringEnum(StoreType, raw.storeType),
        redis: {
            host: raw.redis?.host,
            port: raw.redis?.port && (0, utils_1.assertInt)(raw.redis?.port, "redis.port"),
            username: raw.redis?.username,
            password: raw.redis?.password,
            tls: raw.redis?.tls && (0, utils_1.assertBool)(raw.redis?.tls, "redis.tls"),
            cluster: raw.redis?.cluster && (0, utils_1.assertBool)(raw.redis?.cluster, "redis.cluster"),
        },
        pluginURIs: raw.pluginURIs && (0, utils_1.assertArray)(raw.pluginURIs, "pluginURIs"),
        mode: validateStringEnum(Mode, raw.mode),
        promPort: raw.promPort && (0, utils_1.assertInt)(raw.promPort, "promPort"),
        apiPort: raw.apiPort && (0, utils_1.assertInt)(raw.apiPort, "apiPort"),
        apiKey: raw.apiKey || process.env.RELAYER_ENGINE_API_KEY,
        defaultWorkflowOptions: {
            maxRetries: (0, utils_1.assertInt)(raw.defaultWorkflowOptions.maxRetries),
        },
        readinessPort: raw.readinessPort && (0, utils_1.assertInt)(raw.readinessPort, "readinessPort"),
        logDir: raw.logDir,
        logFormat: raw.logFormat,
        supportedChains: (0, utils_1.assertArray)(raw.supportedChains, "supportedChains").map(validateChainConfig),
        numGuardians: raw.numGuardians && (0, utils_1.assertInt)(raw.numGuardians, "numGuardians"),
        wormholeRpc: (0, utils_1.assertStr)(raw.wormholeRpc, "wormholeRpc"),
    };
}
function validateListenerEnv(raw) {
    return {
        spyServiceHost: raw.spyServiceHost,
        nextVaaFetchingWorkerTimeoutSeconds: raw.nextVaaFetchingWorkerTimeoutSeconds &&
            (0, utils_1.assertInt)(raw.nextVaaFetchingWorkerTimeoutSeconds, "nextVaaFetchingWorkerTimeoutSeconds"),
        restPort: raw.restPort ? (0, utils_1.assertInt)(raw.restPort, "restPort") : undefined,
    };
}
function validateExecutorEnv(raw, chainIds) {
    return {
        privateKeys: validatePrivateKeys(raw.privateKeys, chainIds),
        actionInterval: raw.actionInterval && (0, utils_1.assertInt)(raw.actionInterval, "actionInterval"),
    };
}
//Polygon is not supported on local Tilt network atm.
function validateChainConfig(supportedChainRaw) {
    const msg = (fieldName) => `Missing required field in chain config: ${fieldName}`;
    return {
        chainId: (0, utils_1.nnull)(supportedChainRaw.chainId, msg("chainId")),
        chainName: (0, utils_1.nnull)(supportedChainRaw.chainName, msg("chainName")),
        nodeUrl: (0, utils_1.nnull)(supportedChainRaw.nodeUrl, msg("nodeUrl")),
    };
}
function transformPrivateKeys(privateKeys) {
    return Object.fromEntries((0, utils_1.assertArray)(privateKeys, "privateKeys").map((obj) => {
        const { chainId, privateKeys } = obj;
        (0, utils_1.assertInt)(chainId, "chainId");
        (0, utils_1.assertArray)(privateKeys, "privateKeys");
        return [chainId, privateKeys];
    }));
}
function validatePrivateKeys(privateKeys, chainIds) {
    const set = new Set(chainIds);
    Object.entries(privateKeys).forEach(([chainId, pKeys]) => {
        if (!set.has(Number(chainId))) {
            throw new utils_1.EngineError("privateKeys includes key for unsupported chain", {
                chainId,
            });
        }
        (0, utils_1.assertInt)(chainId, "chainId");
        (0, utils_1.assertArray)(pKeys, "privateKeys").forEach((key) => {
            if (typeof key !== "string") {
                throw new Error("Private key must be string type, found: " + typeof key);
            }
        });
    });
    if (!chainIds.every(c => privateKeys[c])) {
        throw new utils_1.EngineError("privateKeys missing key from supported chains", {
            chains: chainIds.filter(c => !privateKeys[c]),
        });
    }
    return privateKeys;
}
function validateStringEnum(enumObj, value) {
    if (Object.values(enumObj).includes(value)) {
        return value;
    }
    const e = new Error("Expected value to be member of enum");
    e.value = value;
    e.enumVariants = Object.values(enumObj);
    throw e;
}
/*
 * Loads config files and env vars, resolves them into untyped objects
 */
const fs = require("fs");
const nodePath = require("path");
const utils_1 = require("../../utils");
const application_standard_1 = require("../../application-standard");
const logging_1 = require("../../logging");
const legacy_plugin_middleware_1 = require("./legacy-plugin.middleware");
async function loadUntypedEnvs(dir, mode, { privateKeyEnv = false } = {
    privateKeyEnv: false,
}) {
    const rawCommonEnv = await loadCommon(dir);
    rawCommonEnv.mode = mode;
    console.log("Successfully loaded the common config file.");
    const rawListenerEnv = await loadListener(dir, mode);
    const rawExecutorEnv = await loadExecutor(dir, mode, rawCommonEnv, privateKeyEnv);
    console.log("Successfully loaded the mode config file.");
    return {
        rawCommonEnv,
        rawListenerEnv,
        rawExecutorEnv,
        mode,
    };
}
async function loadCommon(dir) {
    const obj = await loadFileAndParseToObject(nodePath.join(dir, `common.json`));
    if (obj.redis) {
        if (process.env.RELAYER_ENGINE_REDIS_HOST) {
            obj.redis.host = process.env.RELAYER_ENGINE_REDIS_HOST;
        }
        if (process.env.RELAYER_ENGINE_REDIS_USERNAME) {
            obj.redis.username = process.env.RELAYER_ENGINE_REDIS_USERNAME;
        }
        if (process.env.RELAYER_ENGINE_REDIS_PASSWORD) {
            obj.redis.password = process.env.RELAYER_ENGINE_REDIS_PASSWORD;
        }
    }
    return obj;
}
async function loadExecutor(dir, mode, rawCommonEnv, privateKeyEnv) {
    if (mode == Mode.EXECUTOR || mode == Mode.BOTH) {
        const rawExecutorEnv = await loadFileAndParseToObject(nodePath.join(dir, `${Mode.EXECUTOR.toLowerCase()}.json`));
        if (privateKeyEnv) {
            rawExecutorEnv.privateKeys = Object.assign(rawExecutorEnv.privateKeys, privateKeyEnvVarLoader(rawCommonEnv.supportedChains.map(c => c.chainId)));
        }
        return rawExecutorEnv;
    }
    return undefined;
}
async function loadListener(dir, mode) {
    if (mode == Mode.LISTENER || mode == Mode.BOTH) {
        return loadFileAndParseToObject(nodePath.join(dir, `${Mode.LISTENER.toLowerCase()}.json`));
    }
    return undefined;
}
// todo: extend to take path w/o extension and look for all supported extensions
async function loadFileAndParseToObject(path) {
    console.log("About to read contents of : " + path);
    const fileContent = fs.readFileSync(path, { encoding: "utf-8" });
    console.log("Successfully read file contents");
    const ext = nodePath.extname(path);
    switch (ext) {
        case ".json":
            return JSON.parse(fileContent);
        default:
            const err = new Error("Config file has unsupported extension");
            err.ext = ext;
            err.path = path;
            throw err;
    }
}
exports.loadFileAndParseToObject = loadFileAndParseToObject;
// Helper to parse private keys from env vars.
// For Solana format is PRIVATE_KEYS_CHAIN_1 => [ 14, 173, 153, ... ]
// For ETH format is PRIVATE_KEYS_CHAIN_2 =>  ["0x4f3 ..."]
function privateKeyEnvVarLoader(chains) {
    const pkeys = {};
    for (const chain of chains) {
        const str = process.env[`PRIVATE_KEYS_CHAIN_${chain}`];
        if (!str) {
            console.log(`No PRIVATE_KEYS_CHAIN_${chain} env var, falling back to executor.json`);
            continue;
        }
        pkeys[chain] = JSON.parse(str);
    }
    return pkeys;
}
//# sourceMappingURL=config.js.map