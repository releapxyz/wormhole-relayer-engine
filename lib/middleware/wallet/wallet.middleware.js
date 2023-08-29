"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wallets = void 0;
const bs58 = require("bs58");
const ethers_1 = require("ethers");
const solana = require("@solana/web3.js");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const wallet_worker_1 = require("./wallet.worker");
const queue_1 = require("@datastructures-js/queue");
const wallet_monitor_1 = require("@xlabs-xyz/wallet-monitor");
const application_1 = require("../../application");
const consts_1 = require("@certusone/wormhole-sdk/lib/cjs/utils/consts");
function makeExecuteFunc(actionQueues, pluginName, logger) {
    // push action onto actionQueue and have worker reject or resolve promise
    const func = (chainId, f) => {
        return new Promise((resolve, reject) => {
            const maybeQueue = actionQueues.get(chainId);
            if (!maybeQueue) {
                logger?.error(`Error making execute function. Unsupported chain: ${chainId}`);
                return reject("Chain not supported");
            }
            maybeQueue.enqueue({
                action: { chainId, f },
                pluginName,
                resolve,
                reject,
            });
        });
    };
    func.onSolana = (f) => func(wormhole_sdk_1.CHAIN_ID_SOLANA, f);
    func.onEVM = (chainId, f) => func(chainId, f);
    return func;
}
const networks = {
    [application_1.Environment.MAINNET]: {
        [wormhole_sdk_1.CHAIN_ID_ETH]: "mainnet",
    },
    [application_1.Environment.TESTNET]: {
        [wormhole_sdk_1.CHAIN_ID_ETH]: "goerli",
        [wormhole_sdk_1.CHAIN_ID_SOLANA]: "devnet",
        [consts_1.CHAIN_ID_AVAX]: "testnet",
        [wormhole_sdk_1.CHAIN_ID_CELO]: "alfajores",
        [wormhole_sdk_1.CHAIN_ID_BSC]: "testnet",
        [consts_1.CHAIN_ID_POLYGON]: "mumbai",
        [consts_1.CHAIN_ID_FANTOM]: "testnet",
        [wormhole_sdk_1.CHAIN_ID_MOONBEAM]: "moonbase-alpha",
    },
    [application_1.Environment.DEVNET]: {},
};
function buildMonitoringFromPrivateKeys(env, privateKeys) {
    const networkByChain = networks[env];
    const config = {};
    for (const [chainIdStr, keys] of Object.entries(privateKeys)) {
        const chainId = Number(chainIdStr);
        const chainName = (0, wormhole_sdk_1.coalesceChainName)(chainId);
        let addresses = {};
        if ((0, wormhole_sdk_1.isEVMChain)(chainId)) {
            for (const key of keys) {
                addresses[new ethers_1.ethers.Wallet(key).address] = [];
            }
        }
        else if (wormhole_sdk_1.CHAIN_ID_SOLANA === chainId) {
            for (const key of keys) {
                let secretKey;
                try {
                    secretKey = new Uint8Array(JSON.parse(key));
                }
                catch (e) {
                    secretKey = bs58.decode(key);
                }
                addresses[solana.Keypair.fromSecretKey(secretKey).publicKey.toBase58()] = [];
            }
        }
        config[chainName] = { addresses, network: networkByChain[chainId] };
    }
    return config;
}
function wallets(env, opts) {
    const workerInfoMap = new Map(Object.entries(opts.privateKeys).map(([chainIdStr, keys]) => {
        //TODO update for all ecosystems
        let chainId = Number(chainIdStr);
        const workerInfos = keys.map((key, id) => ({
            id,
            targetChainId: chainId,
            targetChainName: wormhole_sdk_1.CHAIN_ID_TO_NAME[chainId],
            walletPrivateKey: key,
        }));
        return [chainId, workerInfos];
    }));
    const wallets = buildMonitoringFromPrivateKeys(env, opts.privateKeys);
    opts.logger?.info(JSON.stringify(wallets, null, 2));
    if (opts.metrics) {
        const exporter = new wallet_monitor_1.MultiWalletExporter(wallets, {
            logger: opts.logger,
            prometheus: { registry: opts.metrics.registry },
        });
        exporter.start();
    }
    let executeFunction;
    return async (ctx, next) => {
        if (!executeFunction) {
            ctx.logger?.debug(`Initializing wallets...`);
            const actionQueues = new Map();
            for (const [chain, workerInfos] of workerInfoMap.entries()) {
                const actionQueue = new queue_1.Queue();
                actionQueues.set(chain, actionQueue);
                workerInfos.forEach(info => (0, wallet_worker_1.spawnWalletWorker)(actionQueue, ctx.providers, info, opts.logger));
            }
            executeFunction = makeExecuteFunc(actionQueues, opts.namespace ?? "default", opts.logger);
            ctx.logger?.debug(`Initialized wallets`);
        }
        ctx.logger?.debug("wallets attached to context");
        ctx.wallets = executeFunction;
        await next();
    };
}
exports.wallets = wallets;
//# sourceMappingURL=wallet.middleware.js.map