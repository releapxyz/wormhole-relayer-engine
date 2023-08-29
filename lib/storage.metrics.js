"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorageMetrics = void 0;
const prom_client_1 = require("prom-client");
function createStorageMetrics(storageRegistry = new prom_client_1.Registry()) {
    return {
        registry: storageRegistry,
        metrics: {
            activeGauge: new prom_client_1.Gauge({
                name: `active_workflows`,
                help: "Total number of active jobs (currently being processed)",
                labelNames: ["queue"],
                registers: [storageRegistry],
            }),
            delayedGauge: new prom_client_1.Gauge({
                name: `delayed_workflows`,
                help: "Total number of jobs that will run in the future",
                labelNames: ["queue"],
                registers: [storageRegistry],
            }),
            waitingGauge: new prom_client_1.Gauge({
                name: `waiting_workflows`,
                help: "Total number of jobs waiting to be processed",
                labelNames: ["queue"],
                registers: [storageRegistry],
            }),
            processedDuration: new prom_client_1.Histogram({
                name: `worklow_processing_duration`,
                help: "Processing time in ms for completed jobs (processing until completed)",
                buckets: [100, 500, 1000, 2500, 5000, 7500, 10000, 25000],
                labelNames: ["queue"],
                registers: [storageRegistry],
            }),
            completedDuration: new prom_client_1.Histogram({
                name: `workflow_total_duration`,
                help: "Completion time in ms for jobs (created until completed)",
                buckets: [500, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 100000],
                labelNames: ["queue"],
                registers: [storageRegistry],
            }),
        },
    };
}
exports.createStorageMetrics = createStorageMetrics;
//# sourceMappingURL=storage.metrics.js.map