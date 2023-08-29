"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertChainId = exports.assertEvmChainId = exports.wormholeBytesToHex = exports.assertBool = exports.assertArray = exports.assertInt = exports.assertStr = exports.nnull = exports.maybeConcat = exports.EngineError = exports.hour = exports.minute = exports.second = exports.mergeDeep = exports.parseVaaWithBytes = exports.isObject = exports.sleep = exports.encodeEmitterAddress = void 0;
const wormholeSdk = require("@certusone/wormhole-sdk");
const bech32_1 = require("bech32");
const wormhole_1 = require("@certusone/wormhole-sdk/lib/cjs/solana/wormhole");
const utils_1 = require("ethers/lib/utils");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ethers_1 = require("ethers");
function encodeEmitterAddress(chainId, emitterAddressStr) {
    if (chainId === wormholeSdk.CHAIN_ID_SOLANA ||
        chainId === wormholeSdk.CHAIN_ID_PYTHNET) {
        return (0, wormhole_1.deriveWormholeEmitterKey)(emitterAddressStr)
            .toBuffer()
            .toString("hex");
    }
    if (wormholeSdk.isCosmWasmChain(chainId)) {
        return Buffer.from((0, utils_1.zeroPad)(bech32_1.bech32.fromWords(bech32_1.bech32.decode(emitterAddressStr).words), 32)).toString("hex");
    }
    if (wormholeSdk.isEVMChain(chainId)) {
        return wormholeSdk.getEmitterAddressEth(emitterAddressStr);
    }
    if (wormholeSdk.CHAIN_ID_ALGORAND === chainId) {
        return wormholeSdk.getEmitterAddressAlgorand(BigInt(emitterAddressStr));
    }
    if (wormholeSdk.CHAIN_ID_NEAR === chainId) {
        return wormholeSdk.getEmitterAddressNear(emitterAddressStr);
    }
    throw new Error(`Unrecognized wormhole chainId ${chainId}`);
}
exports.encodeEmitterAddress = encodeEmitterAddress;
function sleep(ms) {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
}
exports.isObject = isObject;
function parseVaaWithBytes(bytes) {
    const parsedVaa = (0, wormhole_sdk_1.parseVaa)(bytes);
    const id = {
        emitterChain: parsedVaa.emitterChain,
        emitterAddress: parsedVaa.emitterAddress.toString("hex"),
        sequence: parsedVaa.sequence.toString(),
    };
    return { ...parsedVaa, bytes, id };
}
exports.parseVaaWithBytes = parseVaaWithBytes;
/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, sources, maxDepth = 10) {
    if (!sources.length || maxDepth === 0) {
        // @ts-ignore
        return target;
    }
    const source = sources.shift();
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key])
                    Object.assign(target, { [key]: {} });
                mergeDeep(target[key], [source[key]], maxDepth - 1);
            }
            else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return mergeDeep(target, sources, maxDepth);
}
exports.mergeDeep = mergeDeep;
exports.second = 1000;
exports.minute = 60 * exports.second;
exports.hour = 60 * exports.minute;
class EngineError extends Error {
    args;
    constructor(msg, args) {
        super(msg);
        this.args = args;
    }
}
exports.EngineError = EngineError;
function maybeConcat(...arrs) {
    return arrs.flatMap(arr => (arr ? arr : []));
}
exports.maybeConcat = maybeConcat;
function nnull(x, errMsg) {
    if (x === undefined || x === null) {
        throw new Error("Found unexpected undefined or null. " + errMsg);
    }
    return x;
}
exports.nnull = nnull;
function assertStr(x, fieldName) {
    if (typeof x !== "string") {
        throw new EngineError(`Expected field to be integer, found ${x}`, {
            fieldName,
        });
    }
    return x;
}
exports.assertStr = assertStr;
function assertInt(x, fieldName) {
    if (!Number.isInteger(Number(x))) {
        throw new EngineError(`Expected field to be integer, found ${x}`, {
            fieldName,
        });
    }
    return x;
}
exports.assertInt = assertInt;
function assertArray(x, name, elemsPred) {
    if (!Array.isArray(x) || (elemsPred && !x.every(elemsPred))) {
        throw new EngineError(`Expected value to be array, found ${x}`, {
            name,
        });
    }
    return x;
}
exports.assertArray = assertArray;
function assertBool(x, fieldName) {
    if (x !== false && x !== true) {
        throw new EngineError(`Expected field to be boolean, found ${x}`, {
            fieldName,
        });
    }
    return x;
}
exports.assertBool = assertBool;
function wormholeBytesToHex(address) {
    return ethers_1.ethers.utils.hexlify(address).replace("0x", "");
}
exports.wormholeBytesToHex = wormholeBytesToHex;
function assertEvmChainId(chainId) {
    if (!(0, wormhole_sdk_1.isEVMChain)(chainId)) {
        throw new EngineError("Expected number to be valid EVM chainId", {
            chainId,
        });
    }
    return chainId;
}
exports.assertEvmChainId = assertEvmChainId;
function assertChainId(chainId) {
    if (!(0, wormhole_sdk_1.isChain)(chainId)) {
        throw new EngineError("Expected number to be valid chainId", { chainId });
    }
    return chainId;
}
exports.assertChainId = assertChainId;
//# sourceMappingURL=utils.js.map