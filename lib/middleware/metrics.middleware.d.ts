import { Middleware } from "../compose.middleware";
import { Context } from "../context";
import { Job } from "bullmq";
import { Registry } from "prom-client";
interface MetricsOpts {
    registry?: Registry;
}
export declare function metrics(opts?: MetricsOpts): Middleware<Context & {
    job?: Job;
}>;
export {};
