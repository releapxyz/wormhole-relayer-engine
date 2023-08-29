import { RelayerApp } from "../../application";
import { Plugin } from "./legacy-plugin-definition";
import { StorageContext } from "../../storage/storage";
import { LoggingContext } from "../logger.middleware";
import { StagingAreaContext } from "../staging-area.middleware";
import { ProviderContext } from "../providers.middleware";
import { WalletContext } from "../wallet";
export type PluginContext<Ext> = LoggingContext & StorageContext & StagingAreaContext & WalletContext & ProviderContext & Ext;
export declare function legacyPluginCompat<Ext>(app: RelayerApp<PluginContext<Ext>>, plugin: Plugin): void;
