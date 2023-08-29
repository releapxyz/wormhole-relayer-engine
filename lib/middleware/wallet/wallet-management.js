"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWalletManagement = void 0;
const wallet_monitor_1 = require("@xlabs-xyz/wallet-monitor");
const bs58 = require("bs58");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const consts_1 = require("@certusone/wormhole-sdk/lib/cjs/utils/consts");
const environment_1 = require("../../environment");
const networks = {
    [environment_1.Environment.MAINNET]: {
        [wormhole_sdk_1.CHAIN_ID_ETH]: "mainnet",
        [wormhole_sdk_1.CHAIN_ID_SOLANA]: "mainnet-beta",
        [consts_1.CHAIN_ID_AVAX]: "mainnet",
        [wormhole_sdk_1.CHAIN_ID_CELO]: "mainnet",
        [wormhole_sdk_1.CHAIN_ID_BSC]: "mainnet",
        [consts_1.CHAIN_ID_POLYGON]: "mainnet",
        [consts_1.CHAIN_ID_FANTOM]: "mainnet",
        [wormhole_sdk_1.CHAIN_ID_MOONBEAM]: "moonbeam-mainnet",
        [consts_1.CHAIN_ID_SUI]: "mainnet",
    },
    [environment_1.Environment.TESTNET]: {
        [wormhole_sdk_1.CHAIN_ID_ETH]: "goerli",
        [wormhole_sdk_1.CHAIN_ID_SOLANA]: "devnet",
        [consts_1.CHAIN_ID_AVAX]: "testnet",
        [wormhole_sdk_1.CHAIN_ID_CELO]: "alfajores",
        [wormhole_sdk_1.CHAIN_ID_BSC]: "testnet",
        [consts_1.CHAIN_ID_POLYGON]: "mumbai",
        [consts_1.CHAIN_ID_FANTOM]: "testnet",
        [wormhole_sdk_1.CHAIN_ID_MOONBEAM]: "moonbase-alpha",
        [consts_1.CHAIN_ID_SUI]: "testnet",
    },
    [environment_1.Environment.DEVNET]: {
        [wormhole_sdk_1.CHAIN_ID_ETH]: "devnet",
        [wormhole_sdk_1.CHAIN_ID_SOLANA]: "devnet",
        [consts_1.CHAIN_ID_AVAX]: "devnet",
        [wormhole_sdk_1.CHAIN_ID_CELO]: "devnet",
        [wormhole_sdk_1.CHAIN_ID_BSC]: "devnet",
        [consts_1.CHAIN_ID_POLYGON]: "devnet",
        [consts_1.CHAIN_ID_FANTOM]: "devnet",
        [wormhole_sdk_1.CHAIN_ID_MOONBEAM]: "devnet",
        [consts_1.CHAIN_ID_SUI]: "devnet",
    },
};
function buildWalletsConfig(env, privateKeys, tokensByChain) {
    const networkByChain = networks[env];
    const config = {};
    const tokens = tokensByChain ?? {};
    for (const [chainIdStr, keys] of Object.entries(privateKeys)) {
        const chainId = Number(chainIdStr);
        const chainName = (0, wormhole_sdk_1.coalesceChainName)(chainId);
        const chainWallets = [];
        if ((0, wormhole_sdk_1.isEVMChain)(chainId)) {
            for (const key of keys) {
                chainWallets.push({
                    privateKey: key,
                    tokens: tokens[chainId] ?? [],
                });
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
                chainWallets.push({
                    privateKey: secretKey.toString(),
                    tokens: tokens[chainId] ?? [],
                });
            }
        }
        else if (chainId === consts_1.CHAIN_ID_SUI) {
            for (const key of keys) {
                chainWallets.push({
                    privateKey: key,
                    tokens: tokens[chainId] ?? [],
                });
            }
        }
        else if (chainId === consts_1.CHAIN_ID_SEI) {
            continue;
            // The continue should be removed and the below section uncommented once wallet-monitor has been implemented for Sei
            // for (const key of keys) {
            //   chainWallets.push({
            //     privateKey: key,
            //   });
            // }
        }
        config[chainName] = {
            wallets: chainWallets,
            network: networkByChain[chainId],
        };
    }
    return config;
}
function startWalletManagement(env, privateKeys, tokensByChain, metricsOpts, logger) {
    const wallets = buildWalletsConfig(env, privateKeys, tokensByChain);
    const manager = (0, wallet_monitor_1.buildWalletManager)({
        config: wallets,
        options: {
            failOnInvalidChain: false,
            logger: logger?.child({ module: "wallet-manager" }),
            logLevel: "error",
            metrics: metricsOpts,
        },
    });
    return manager;
}
exports.startWalletManagement = startWalletManagement;
//# sourceMappingURL=wallet-management.js.map