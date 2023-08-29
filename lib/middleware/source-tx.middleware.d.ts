/// <reference types="node" />
/// <reference lib="dom" />
import { Middleware } from "../compose.middleware";
import { Context } from "../context";
import { Environment } from "../application";
import { Logger } from "winston";
export interface SourceTxOpts {
    wormscanEndpoint: string;
    retries: number;
}
export interface SourceTxContext extends Context {
    sourceTxHash?: string;
}
export declare const wormscanEndpoints: {
    [k in Environment]: string | undefined;
};
export declare function sourceTx(optsWithoutDefaults?: SourceTxOpts): Middleware<SourceTxContext>;
export declare function fetchVaaHash(emitterChain: number, emitterAddress: Buffer, sequence: bigint, logger: Logger, env: Environment, retries?: number, baseEndpoint?: string): Promise<string>;
