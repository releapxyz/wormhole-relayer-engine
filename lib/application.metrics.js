"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRelayerMetrics = void 0;
const prom_client_1 = require("prom-client");
function createRelayerMetrics(relayerRegistry = new prom_client_1.Registry()) {
    return {
        registry: relayerRegistry,
        metrics: {
            connectedSpies: new prom_client_1.Gauge({
                name: `connected_spies`,
                help: "Total number of spies connected the relayer is connected to. For now this is always 1 or 0.",
                labelNames: ["queue"],
                registers: [relayerRegistry],
            }),
            lastVaaReceived: new prom_client_1.Gauge({
                name: `last_vaa_received_at`,
                help: "Date in ms since epoch of when the last VAA was received",
                labelNames: ["queue"],
                registers: [relayerRegistry],
            }),
            vaasViaSpyTotal: new prom_client_1.Counter({
                name: `vaa_via_spy_total`,
                help: "Total number of VAAs received via the spy. If the same vaa is received multiple times, it will be counted multiple times.",
                labelNames: ["queue"],
                registers: [relayerRegistry],
            }),
            spySubscribedFilters: new prom_client_1.Gauge({
                name: `spy_subscribed_filter_count`,
                help: "Number of Filters passed in to the Spy. This is the number of contracts the relayer is watching.",
                labelNames: ["queue"],
                registers: [relayerRegistry],
            }),
        },
    };
}
exports.createRelayerMetrics = createRelayerMetrics;
//# sourceMappingURL=application.metrics.js.map