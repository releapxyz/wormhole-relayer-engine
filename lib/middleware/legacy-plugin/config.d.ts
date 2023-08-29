import { ChainId } from "@certusone/wormhole-sdk";
import { ChainConfigInfo, EngineInitFn, Plugin, WorkflowOptions } from "./legacy-plugin-definition";
type RelayerEngineConfigs = {
    commonEnv: CommonEnv;
    listenerEnv?: ListenerEnv;
    executorEnv?: ExecutorEnv;
};
declare enum StoreType {
    Redis = "Redis"
}
export declare enum Mode {
    LISTENER = "LISTENER",
    EXECUTOR = "EXECUTOR",
    BOTH = "BOTH"
}
type NodeURI = string;
interface RedisConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    tls?: boolean;
    cluster?: boolean;
}
export interface CommonEnv {
    namespace?: string;
    logLevel?: string;
    logFormat?: "json" | "console" | "";
    promPort?: number;
    apiPort?: number;
    apiKey?: string;
    readinessPort?: number;
    logDir?: string;
    storeType: StoreType;
    redis?: RedisConfig;
    pluginURIs?: NodeURI[];
    numGuardians?: number;
    wormholeRpc: string;
    mode: Mode;
    supportedChains: ChainConfigInfo[];
    defaultWorkflowOptions: WorkflowOptions;
}
export type ListenerEnv = {
    spyServiceHost: string;
    nextVaaFetchingWorkerTimeoutSeconds?: number;
    restPort?: number;
};
type PrivateKeys = {
    [id in ChainId]: string[];
};
export type ExecutorEnv = {
    privateKeys: PrivateKeys;
    actionInterval?: number;
};
export type CommonEnvRun = Omit<CommonEnv, "mode">;
export interface RunArgs {
    configs: string | {
        commonEnv: CommonEnvRun;
        executorEnv?: ExecutorEnv;
        listenerEnv?: ListenerEnv;
    };
    mode: Mode;
    plugins: {
        [pluginName: string]: EngineInitFn<Plugin>;
    };
}
/** @deprecated use the app builder directly, see example project for modern APIs or source code for this function*/
export declare function run(args: RunArgs, env: Environment): Promise<void>;
export declare function loadRelayerEngineConfig(dir: string, mode: Mode, { privateKeyEnv }?: {
    privateKeyEnv?: boolean;
}): Promise<RelayerEngineConfigs>;
import { Environment } from "../../application";
export declare function loadFileAndParseToObject(path: string): Promise<Record<string, any>>;
export {};
