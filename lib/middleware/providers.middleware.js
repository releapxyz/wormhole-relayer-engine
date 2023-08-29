"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providers = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ethers_1 = require("ethers");
const web3_js_1 = require("@solana/web3.js");
const application_1 = require("../application");
const consts_1 = require("@certusone/wormhole-sdk/lib/cjs/utils/consts");
const defaultSupportedChains = {
    [application_1.Environment.MAINNET]: {
        [wormhole_sdk_1.CHAIN_ID_SOLANA]: { endpoints: ["https://api.mainnet-beta.solana.com"] },
        [wormhole_sdk_1.CHAIN_ID_ETH]: { endpoints: ["https://rpc.ankr.com/eth"] },
        [wormhole_sdk_1.CHAIN_ID_BSC]: { endpoints: ["https://bsc-dataseed1.binance.org/"] },
        [consts_1.CHAIN_ID_POLYGON]: { endpoints: ["https://rpc.ankr.com/polygon"] },
        [consts_1.CHAIN_ID_AVAX]: { endpoints: ["https://api.avax.network/ext/bc/C/rpc"] },
        [consts_1.CHAIN_ID_FANTOM]: { endpoints: ["https://rpc.ftm.tools"] },
        [wormhole_sdk_1.CHAIN_ID_CELO]: { endpoints: ["https://forno.celo.org"] },
        [wormhole_sdk_1.CHAIN_ID_MOONBEAM]: { endpoints: ["https://rpc.api.moonbeam.network"] },
        [wormhole_sdk_1.CHAIN_ID_ACALA]: { endpoints: ["https://eth-rpc-acala.aca-api.network"] },
        [wormhole_sdk_1.CHAIN_ID_ALGORAND]: { endpoints: ["https://node.algoexplorerapi.io/"] },
        [wormhole_sdk_1.CHAIN_ID_APTOS]: {
            endpoints: ["https://fullnode.mainnet.aptoslabs.com/v1"],
        },
    },
    [application_1.Environment.TESTNET]: {
        [wormhole_sdk_1.CHAIN_ID_ALGORAND]: { endpoints: ["node.testnet.algoexplorerapi.io/"] },
        [wormhole_sdk_1.CHAIN_ID_SOLANA]: {
            endpoints: ["https://api.devnet.solana.com"],
        },
        [wormhole_sdk_1.CHAIN_ID_ETH]: {
            endpoints: [
                "https://eth-goerli.g.alchemy.com/v2/mvFFcUhFfHujAOewWU8kH5D1R2bgFgLt",
            ],
        },
        [wormhole_sdk_1.CHAIN_ID_BSC]: {
            endpoints: ["https://data-seed-prebsc-1-s3.binance.org:8545"],
        },
        [consts_1.CHAIN_ID_POLYGON]: {
            endpoints: ["https://matic-mumbai.chainstacklabs.com"],
        },
        [consts_1.CHAIN_ID_AVAX]: {
            endpoints: ["https://api.avax-test.network/ext/bc/C/rpc"],
        },
        [consts_1.CHAIN_ID_FANTOM]: { endpoints: ["https://rpc.ankr.com/fantom_testnet"] },
        [wormhole_sdk_1.CHAIN_ID_CELO]: {
            endpoints: ["https://alfajores-forno.celo-testnet.org"],
        },
        [wormhole_sdk_1.CHAIN_ID_MOONBEAM]: {
            endpoints: ["https://rpc.testnet.moonbeam.network"],
        },
        [wormhole_sdk_1.CHAIN_ID_APTOS]: {
            endpoints: ["https://fullnode.devnet.aptoslabs.com/v1"],
        },
    },
    [application_1.Environment.DEVNET]: {
        [wormhole_sdk_1.CHAIN_ID_ETH]: {
            endpoints: ["http://localhost:8545/"],
        },
        [wormhole_sdk_1.CHAIN_ID_BSC]: {
            endpoints: ["http://localhost:8546/"],
        },
    },
};
/**
 * providers is a middleware that populates `ctx.providers` with provider information
 * @param opts
 */
function providers(opts) {
    let providers;
    return async (ctx, next) => {
        if (!providers) {
            ctx.logger?.debug(`Providers initializing...`);
            providers = buildProviders(ctx.env, opts);
            ctx.logger?.debug(`Providers Initialized`);
        }
        ctx.providers = providers;
        ctx.logger?.debug("Providers attached to context");
        await next();
    };
}
exports.providers = providers;
function buildProviders(env, opts) {
    const supportedChains = Object.assign({}, defaultSupportedChains[env], opts?.chains);
    const providers = {
        evm: {},
        solana: [],
        untyped: {},
    };
    for (const [chainIdStr, chainCfg] of Object.entries(supportedChains)) {
        const chainId = Number(chainIdStr);
        const { endpoints } = chainCfg;
        if ((0, wormhole_sdk_1.isEVMChain)(chainId)) {
            providers.evm[chainId] = endpoints.map(url => new ethers_1.ethers.providers.JsonRpcProvider(url));
        }
        else if (chainId === wormhole_sdk_1.CHAIN_ID_SOLANA) {
            providers.solana = endpoints.map(url => new web3_js_1.Connection(url));
        }
        else {
            // @ts-ignore
            providers.untyped[chainId] = endpoints.map(c => ({ rpcUrl: c }));
        }
    }
    return providers;
}
//# sourceMappingURL=providers.middleware.js.map