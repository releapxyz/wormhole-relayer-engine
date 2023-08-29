import { Gauge, Histogram, Registry } from "prom-client";
export declare function createStorageMetrics(storageRegistry?: Registry): {
    registry: Registry;
    metrics: {
        activeGauge: Gauge<"queue">;
        delayedGauge: Gauge<"queue">;
        waitingGauge: Gauge<"queue">;
        processedDuration: Histogram<"queue">;
        completedDuration: Histogram<"queue">;
    };
};
