"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
const prom_client_1 = require("prom-client");
const prom_client_2 = require("prom-client");
function metrics(opts = {}) {
    opts.registry = opts.registry || prom_client_1.register;
    const processedVaasTotal = new prom_client_2.Counter({
        name: "vaas_processed_total",
        help: "Number of vaas processed successfully or unsuccessfully.",
        registers: [opts.registry],
    });
    const finishedVaasTotal = new prom_client_2.Counter({
        name: "vaas_finished_total",
        help: "Number of vaas processed successfully or unsuccessfully.",
        labelNames: ["status"],
        registers: [opts.registry],
    });
    return async (ctx, next) => {
        const job = ctx.storage?.job;
        // disable this metric if storage is enabled because the storage will actually compute the metrics.
        if (job) {
            await next();
            return;
        }
        processedVaasTotal.inc();
        try {
            await next();
            finishedVaasTotal.labels({ status: "succeeded" }).inc();
        }
        catch (e) {
            finishedVaasTotal.labels({ status: "failed" }).inc();
        }
    };
}
exports.metrics = metrics;
//# sourceMappingURL=metrics.middleware.js.map