import { Counter, Gauge, Registry } from "prom-client";
export interface RelayerMetrics {
    connectedSpies: Gauge<string>;
    lastVaaReceived: Gauge<string>;
    vaasViaSpyTotal: Counter<string>;
    spySubscribedFilters: Gauge<string>;
}
export declare function createRelayerMetrics(relayerRegistry?: Registry): {
    registry: Registry;
    metrics: RelayerMetrics;
};
