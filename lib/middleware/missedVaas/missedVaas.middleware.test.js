"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const missedVaas_middleware_1 = require("./missedVaas.middleware");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const ioredis_1 = require("ioredis");
const winston_1 = require("winston");
const logger = (0, winston_1.createLogger)({
    level: "debug",
    transports: new winston_1.transports.Console({ format: winston_1.format.simple() }),
});
const opts = {
    redis: {
        host: "localhost",
        port: 6301,
    },
};
const emitterAddress = "0xEF179777F69cE855718Df64E2E84BBA99b6E4828";
const emitterChain = wormhole_sdk_1.CHAIN_ID_BSC;
const emitterAddressOther = "0xAF179777F69cE855718Df64E2E84BBA99b6E4827";
const key = (seq) => ({ emitterAddress, emitterChain, seq });
const filters = [
    {
        emitterFilter: {
            chainId: emitterChain,
            emitterAddress,
        },
    },
];
(0, globals_1.describe)("missed vaa job", () => {
    // @ts-ignore
    let redis;
    (0, globals_1.beforeAll)(() => {
        redis = new ioredis_1.Redis(opts.redis);
    });
    (0, globals_1.afterAll)(() => redis.disconnect());
    (0, globals_1.beforeEach)(() => redis.flushall());
    (0, globals_1.describe)("missedVaaJob", () => {
        (0, globals_1.test)("simple", async () => {
            const signed = [1n, 2n, 5n, 7n, 8n];
            const seen = [0n, 3n, 4n, 6n];
            // mark processed
            await Promise.all(seen.map(seq => (0, missedVaas_middleware_1.markProcessed)(redis, key(seq), logger)));
            const tryFetchAndProcess = globals_1.jest.fn(async (redis, vaaKey, logger) => {
                return signed.includes(vaaKey.seq);
            });
            await (0, missedVaas_middleware_1.missedVaaJob)(redis, filters, tryFetchAndProcess, logger);
            expect(tryFetchAndProcess).toBeCalledTimes(6);
            const results = Promise.all(tryFetchAndProcess.mock.results.map(r => r.value));
            expect(results).resolves.toStrictEqual([
                true,
                true,
                true,
                true,
                true,
                false,
            ]);
        });
    });
    (0, globals_1.describe)("tryFetchAndProcess", () => {
        (0, globals_1.test)("success", async () => {
            // mocks
            const fetchVaa = globals_1.jest.fn(async (vaaKey) => {
                if (true) {
                    return { vaaBytes: new Uint8Array([Number(vaaKey.seq)]) };
                }
                throw vaaNotFound();
            });
            const processVaa = globals_1.jest.fn(async (vaa) => Promise.resolve());
            const fetched = await (0, missedVaas_middleware_1.tryFetchAndProcess)(processVaa, fetchVaa, redis, key(5n), logger);
            expect(fetched).toBeTruthy();
        });
        (0, globals_1.test)("inProgress", async () => {
            (0, missedVaas_middleware_1.markInProgress)(redis, key(5n), logger);
            // mocks
            const fetchVaa = globals_1.jest.fn(async (vaaKey) => {
                if (true) {
                    return { vaaBytes: new Uint8Array([Number(vaaKey.seq)]) };
                }
                throw vaaNotFound();
            });
            const processVaa = globals_1.jest.fn(async (vaa) => Promise.resolve());
            const fetched = await (0, missedVaas_middleware_1.tryFetchAndProcess)(processVaa, fetchVaa, redis, key(5n), logger);
            expect(fetched).toBeFalsy();
        });
        (0, globals_1.test)("processVaa throws", async () => {
            // mocks
            const fetchVaa = globals_1.jest.fn(async (vaaKey) => {
                throw vaaNotFound();
            });
            const processVaa = globals_1.jest.fn(async (vaa) => Promise.reject("bad processing!!!!"));
            const fetched = await (0, missedVaas_middleware_1.tryFetchAndProcess)(processVaa, fetchVaa, redis, key(5n), logger);
            expect(fetched).toBeFalsy();
        });
        (0, globals_1.test)("fetch fails", async () => {
            // mocks
            const fetchVaa = globals_1.jest.fn(async (vaaKey) => {
                throw vaaNotFound();
            });
            const processVaa = globals_1.jest.fn(async (vaa) => Promise.resolve());
            const fetched = await (0, missedVaas_middleware_1.tryFetchAndProcess)(processVaa, fetchVaa, redis, key(5n), logger);
            expect(fetched).toBeFalsy();
        });
    });
});
const vaaNotFound = () => {
    let e = new Error("vaa not found");
    e.code = 5;
    return e;
};
//# sourceMappingURL=missedVaas.middleware.test.js.map