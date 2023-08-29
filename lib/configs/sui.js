"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitterCapByEnv = void 0;
// This is not part of the wormhole SDK but it is fixed and shouldn't change across releases.
const environment_1 = require("../environment");
const tokenBridgeEmitterCapTestnet = "b22cd218bb63da447ac2704c1cc72727df6b5e981ee17a22176fd7b84c114610";
const tokenBridgeEmitterCapMainnet = "ccceeb29348f71bdd22ffef43a2a19c1f5b5e17c5cca5411529120182672ade5";
exports.emitterCapByEnv = {
    [environment_1.Environment.MAINNET]: tokenBridgeEmitterCapMainnet,
    [environment_1.Environment.TESTNET]: tokenBridgeEmitterCapTestnet,
    [environment_1.Environment.DEVNET]: "",
};
//# sourceMappingURL=sui.js.map