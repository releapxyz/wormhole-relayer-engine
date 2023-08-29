import { Middleware } from "../compose.middleware";
import { ChainName, EVMChainId, ParsedTokenTransferVaa, TokenTransfer } from "@certusone/wormhole-sdk";
import { ethers, Signer } from "ethers";
import { ProviderContext } from "./providers.middleware";
import { ITokenBridge } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
export interface TokenBridgeContext extends ProviderContext {
    tokenBridge: {
        addresses: {
            [k in ChainName]?: string;
        };
        contractConstructor: (address: string, signerOrProvider: Signer | ethers.providers.Provider) => ITokenBridge;
        contracts: {
            read: {
                evm: {
                    [k in EVMChainId]?: ITokenBridge[];
                };
            };
        };
        vaa?: ParsedTokenTransferVaa;
        payload?: TokenTransfer;
    };
}
export type TokenBridgeChainConfigInfo = {
    evm: {
        [k in EVMChainId]: {
            contracts: ITokenBridge[];
        };
    };
};
export declare function tokenBridgeContracts(): Middleware<TokenBridgeContext>;
