"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyPluginCompat = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
function legacyPluginCompat(app, plugin) {
    const filters = plugin.getFilters();
    const multiple = {};
    for (const { chainId, emitterAddress, doNotTransform } of filters) {
        if (multiple[chainId]?.length !== 0) {
            multiple[chainId] = [];
        }
        // todo: support doNotTransform option
        multiple[chainId]?.push(emitterAddress);
    }
    // plugin.afterSetup(providers, )
    app.multiple(multiple, async (ctx, next) => {
        const { kv, vaa, vaaBytes, logger } = ctx;
        const vaaWithBytes = vaa;
        vaaWithBytes.bytes = vaaBytes;
        const providers = providersShimToLegacy(ctx.providers);
        const res = await plugin.consumeEvent(vaaWithBytes, kv, Object.assign(providers));
        if (!res) {
            return next();
        }
        const { workflowOptions, workflowData } = res;
        await plugin.handleWorkflow({ data: workflowData }, providers, makeExecuteWrapper(ctx));
        return next();
    });
}
exports.legacyPluginCompat = legacyPluginCompat;
function makeExecuteWrapper(ctx) {
    const execute = async (action) => {
        if ((0, wormhole_sdk_1.isEVMChain)(action.chainId)) {
            ctx.wallets.onEVM(action.chainId, (wallet, chainId) => {
                return action.f(walletShimToLegacy(wallet), chainId);
            });
        }
        else if (action.chainId === wormhole_sdk_1.CHAIN_ID_SOLANA) {
            return ctx.wallets.onSolana((wallet) => action.f(walletShimToLegacy(wallet), action.chainId));
        }
    };
    execute.onEVM = (action) => {
        return ctx.wallets.onEVM(action.chainId, (wallet) => action.f(walletShimToLegacy(wallet), action.chainId));
    };
    execute.onSolana = (f) => {
        return ctx.wallets.onSolana(f);
    };
    return execute;
}
function providersShimToLegacy(providers) {
    return {
        solana: providers.solana.length > 0
            ? providers.solana[0]
            : undefined,
        untyped: Object.fromEntries(Object.entries(providers.untyped).map(([chain, rpcs]) => [
            chain,
            rpcs[0],
        ])),
        evm: Object.fromEntries(Object.entries(providers.evm).map(([chain, rpcs]) => [chain, rpcs[0]])),
    };
}
function providersShimFromLegacy(providers) {
    return {
        solana: providers.solana ? [providers.solana] : [],
        untyped: Object.fromEntries(Object.entries(providers.untyped).map(([chain, rpc]) => [chain, [rpc]])),
        evm: Object.fromEntries(Object.entries(providers.evm).map(([chain, rpc]) => [chain, [rpc]])),
    };
}
function walletShimToLegacy(wallets) {
    return {
        ...providersShimToLegacy(wallets),
        wallet: wallets.wallet,
    };
}
function walletShimFromLegacy(wallets) {
    return {
        ...providersShimFromLegacy(wallets),
        wallet: wallets.wallet,
    };
}
//# sourceMappingURL=legacy-plugin.middleware.js.map