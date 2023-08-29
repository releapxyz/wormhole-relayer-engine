/// <reference types="node" />
import * as wormholeSdk from "@certusone/wormhole-sdk";
import { ChainId, EVMChainId, SignedVaa } from "@certusone/wormhole-sdk";
import { ParsedVaaWithBytes } from "./application";
export declare function encodeEmitterAddress(chainId: wormholeSdk.ChainId, emitterAddressStr: string): string;
export declare function sleep(ms: number): Promise<unknown>;
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export declare function isObject(item: any): boolean;
export declare function parseVaaWithBytes(bytes: SignedVaa): ParsedVaaWithBytes;
/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export declare function mergeDeep<T>(target: Partial<T>, sources: Partial<T>[], maxDepth?: number): T;
export declare const second = 1000;
export declare const minute: number;
export declare const hour: number;
export declare class EngineError extends Error {
    args?: Record<any, any>;
    constructor(msg: string, args?: Record<any, any>);
}
export declare function maybeConcat<T>(...arrs: (T[] | undefined)[]): T[];
export declare function nnull<T>(x: T | undefined | null, errMsg?: string): T;
export declare function assertStr(x: any, fieldName?: string): string;
export declare function assertInt(x: any, fieldName?: string): number;
export declare function assertArray<T>(x: any, name: string, elemsPred?: (x: any) => boolean): T[];
export declare function assertBool(x: any, fieldName?: string): boolean;
export declare function wormholeBytesToHex(address: Buffer | Uint8Array): string;
export declare function assertEvmChainId(chainId: number): EVMChainId;
export declare function assertChainId(chainId: number): ChainId;
