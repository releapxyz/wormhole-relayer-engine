import { WalletManagerFullConfig } from "@xlabs-xyz/wallet-monitor";
import { Logger } from "winston";
import { ChainId } from "@certusone/wormhole-sdk";
import { Environment } from "../../environment";
export type PrivateKeys = Partial<{
    [k in ChainId]: string[];
}>;
export type TokensByChain = Partial<{
    [k in ChainId]: string[];
}>;
export declare function startWalletManagement(env: Environment, privateKeys: PrivateKeys, tokensByChain?: TokensByChain, metricsOpts?: WalletManagerFullConfig["options"]["metrics"], logger?: Logger): import("@xlabs-xyz/wallet-monitor").IClientWalletManager | import("@xlabs-xyz/wallet-monitor").ILibraryWalletManager;
