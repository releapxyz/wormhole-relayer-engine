"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletToolbox = void 0;
const wh = require("@certusone/wormhole-sdk");
const bs58 = require("bs58");
const ethers_1 = require("ethers");
const solana = require("@solana/web3.js");
function createWalletToolbox(providers, privateKey, chainId) {
    if (wh.isEVMChain(chainId)) {
        return createEVMWalletToolBox(providers, privateKey, chainId);
    }
    switch (chainId) {
        case wh.CHAIN_ID_SOLANA:
            let secretKey;
            try {
                secretKey = bs58.decode(privateKey);
            }
            catch (e) {
                secretKey = new Uint8Array(JSON.parse(privateKey));
            }
            return createSolanaWalletToolBox(providers, secretKey);
    }
}
exports.createWalletToolbox = createWalletToolbox;
function createEVMWalletToolBox(providers, privateKey, chainId) {
    return {
        ...providers,
        wallet: new ethers_1.ethers.Wallet(privateKey, providers.evm[chainId][0]),
    };
}
function createSolanaWalletToolBox(providers, privateKey) {
    return {
        ...providers,
        wallet: {
            conn: providers.solana[0],
            payer: solana.Keypair.fromSecretKey(privateKey),
        },
    };
}
//# sourceMappingURL=walletToolBox.js.map