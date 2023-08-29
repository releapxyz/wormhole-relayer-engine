"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnWalletWorker = void 0;
const walletToolBox_1 = require("./walletToolBox");
const utils_1 = require("../../utils");
const DEFAULT_WORKER_RESTART_MS = 2 * 1000;
const DEFAULT_WORKER_INTERVAL_MS = 1;
async function spawnWalletWorker(actionQueue, providers, workerInfo, logger) {
    const workerIntervalMS = DEFAULT_WORKER_INTERVAL_MS;
    const walletToolBox = (0, walletToolBox_1.createWalletToolbox)(providers, workerInfo.walletPrivateKey, workerInfo.targetChainId);
    while (true) {
        // always sleep between loop iterations
        await (0, utils_1.sleep)(workerIntervalMS);
        try {
            if (actionQueue.isEmpty()) {
                continue;
            }
            const actionWithCont = actionQueue.dequeue();
            try {
                const result = await actionWithCont.action.f(walletToolBox, workerInfo.targetChainId);
                logger.debug(`Action ${actionWithCont.pluginName} completed`, {
                    action: actionWithCont,
                });
                actionWithCont.resolve(result);
            }
            catch (e) {
                logger.error(`Unexpected error while executing chain action:`, e);
                actionWithCont.reject(e);
            }
        }
        catch (e) {
            logger.error("", e);
            // wait longer between loop iterations on error
            await (0, utils_1.sleep)(DEFAULT_WORKER_RESTART_MS);
        }
    }
}
exports.spawnWalletWorker = spawnWalletWorker;
//# sourceMappingURL=wallet.worker.js.map