"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchVaaHash = exports.sourceTx = exports.wormscanEndpoints = void 0;
const application_1 = require("../application");
const utils_1 = require("../utils");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
exports.wormscanEndpoints = {
    [application_1.Environment.MAINNET]: "https://api.wormscan.io",
    [application_1.Environment.TESTNET]: "https://api.testnet.wormscan.io",
    [application_1.Environment.DEVNET]: undefined,
};
const defaultOptsByEnv = {
    [application_1.Environment.MAINNET]: {
        wormscanEndpoint: exports.wormscanEndpoints[application_1.Environment.MAINNET],
        retries: 5,
    },
    [application_1.Environment.TESTNET]: {
        wormscanEndpoint: exports.wormscanEndpoints[application_1.Environment.TESTNET],
        retries: 3,
    },
    [application_1.Environment.DEVNET]: {
        wormscanEndpoint: exports.wormscanEndpoints[application_1.Environment.DEVNET],
        retries: 3,
    },
};
function sourceTx(optsWithoutDefaults) {
    let opts;
    return async (ctx, next) => {
        if (!opts) {
            // initialize options now that we know the environment from context
            opts = Object.assign({}, defaultOptsByEnv[ctx.env], optsWithoutDefaults);
        }
        const { emitterChain, emitterAddress, sequence } = ctx.vaa;
        ctx.logger?.debug("Fetching tx hash...");
        let txHash = await fetchVaaHash(emitterChain, emitterAddress, sequence, ctx.logger, ctx.env, opts.retries, opts.wormscanEndpoint);
        ctx.logger?.debug(txHash === ""
            ? "Could not retrive tx hash."
            : `Retrieved tx hash: ${txHash}`);
        ctx.sourceTxHash = txHash;
        await next();
    };
}
exports.sourceTx = sourceTx;
async function fetchVaaHash(emitterChain, emitterAddress, sequence, logger, env, retries = 3, baseEndpoint = exports.wormscanEndpoints[env]) {
    let attempt = 0;
    let txHash = "";
    do {
        try {
            const res = await fetch(`${baseEndpoint}/api/v1/vaas/${emitterChain}/${emitterAddress.toString("hex")}/${sequence.toString()}`);
            if (res.status === 404) {
                throw new Error("Not found yet.");
            }
            else if (res.status > 500) {
                throw new Error(`Got: ${res.status}`);
            }
            txHash = (await res.json()).data?.txHash;
        }
        catch (e) {
            logger?.error(`could not obtain txHash, attempt: ${attempt} of ${retries}.`, e);
            await (0, utils_1.sleep)((attempt + 1) * 200); // linear wait
        }
    } while (++attempt < retries && !txHash);
    if ((0, wormhole_sdk_1.isEVMChain)(emitterChain) &&
        txHash &&
        !txHash.startsWith("0x")) {
        txHash = `0x${txHash}`;
    }
    return txHash;
}
exports.fetchVaaHash = fetchVaaHash;
//# sourceMappingURL=source-tx.middleware.js.map