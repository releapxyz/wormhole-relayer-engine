import yargs from "yargs";
import { Buffer } from "buffer";
import * as Koa from "koa";
import {
  Context,
  Environment,
  logging,
  LoggingContext,
  missedVaas,
  Next,
  providers,
  RelayerApp,
  sourceTx,
  SourceTxContext,
  stagingArea,
  StagingAreaContext,
  StorageContext,
  TokenBridgeContext,
  tokenBridgeContracts,
  WalletContext,
  wallets,
} from "@wormhole-foundation/relayer-engine";
import { CHAIN_ID_BASE } from "@certusone/wormhole-sdk";
import { rootLogger } from "./log";
import { ApiController } from "./controller";
import { Logger } from "winston";
import { RedisStorage } from "../../relayer/storage/redis-storage";
import {
  Connection,
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
} from "@mysten/sui.js";
import { storeDoc } from "./storage";
import admin from "firebase-admin";

export type MyRelayerContext = LoggingContext &
  StorageContext &
  SourceTxContext &
  TokenBridgeContext &
  StagingAreaContext &
  WalletContext;

// You need to read in your keys
// const privateKeys = {
//   [CHAIN_ID_SUI]: [
//     "0x11747c8d7ca158fad91bfe5af19541858707d16a540576e26e2ec0bf809da62f",
//   ],
// };

async function main() {
  let opts: any = yargs(process.argv.slice(2)).argv;
  const env = Environment.MAINNET;
  const app = new RelayerApp<MyRelayerContext>(env);
  const fundsCtrl = new ApiController();

  // Config
  const store = new RedisStorage({
    attempts: 3,
    namespace: "simple",
    queueName: "relays",
  });
  configRelayer(app, store);

  // Set up middleware
  app.use(logging(rootLogger)); // <-- logging middleware
  app.use(missedVaas(app, { namespace: "simple", logger: rootLogger }));
  app.use(providers());
  // console.log("wallet: ", process.env);
  // app.use(
  //   wallets(Environment.TESTNET, {
  //     logger: rootLogger,
  //     namespace: "simple",
  //     privateKeys,
  //   })
  // ); // <-- you need a valid private key to turn on this middleware
  app.use(tokenBridgeContracts());
  app.use(stagingArea());
  app.use(sourceTx());

  const suiProvider = new JsonRpcProvider(
    new Connection({
      fullnode: "https://sui-mainnet-rpc.nodereal.io",
    })
  );
  const keyPair = Ed25519Keypair.deriveKeypair(process.env.PRIVATE_KEY);
  const signer = new RawSigner(keyPair, suiProvider);

  app
    .chain(CHAIN_ID_BASE)
    .address("", async (ctx: MyRelayerContext, next: Next) => {
      try {
        const payload = String.fromCharCode.apply(null, ctx.vaa.payload);
        console.log("Payload received: ", payload);

        if (payload.contains("CREATE:")) {
          const profileName = payload.replace("CREATE:", "");
          const tx = new TransactionBlock();

          tx.moveCall({
            target: `0x6b66969e6ace49a4dadde9c1c84a05c7e41d292715f26e887f5c43353edf268c::releap_social::new_profile`,
            arguments: [
              tx.object(
                "0xe270693fd9b2b84f55197071f420a45edf3211f0116dca8b953e10befa83b792"
              ),
              tx.pure(profileName),
              tx.object(SUI_CLOCK_OBJECT_ID),
              tx.object(
                "0x57cf6b2e91dd04d66a9611fd861645febdef0123b45e7fd245552d5e38676839"
              ),
            ],
          });

          const result = await signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: { showEvents: true, showEffects: true },
          });

          const createdProfileId =
            result.effects?.created?.find((it: any) => {
              if (typeof it.owner === "object" && "Shared" in it.owner) {
                return (
                  it.owner.Shared.initial_shared_version ===
                  it.reference.version
                );
              }
            })?.reference?.objectId ?? "";

          //TEMP STORAGE
          await storeDoc<any>("users", createdProfileId, {
            name: profileName,
            profileId: createdProfileId,
            isEVM: true,
          });
        }
      } catch (e) {
        console.log("ERROR: ", e);
      }
    });

  // Another way to do it if you want to listen to multiple addresses on different chaints:
  // app.multiple(
  //   { [CHAIN_ID_SOLANA]: "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe"
  //     [CHAIN_ID_ETH]: ["0xabc1230000000...","0xdef456000....."]
  //   },
  //   fundsCtrl.processFundsTransfer
  // );

  app.use(async (err, ctx, next) => {
    ctx.logger.error("error middleware triggered");
  }); // <-- if you pass in a function with 3 args, it'll be used to process errors (whenever you throw from your middleware)

  app.listen();
  runUI(app, store, opts, rootLogger);
}

function configRelayer<T extends Context>(
  app: RelayerApp<T>,
  store: RedisStorage
) {
  app.spy("localhost:7073");
  app.useStorage(store);
  app.logger(rootLogger);
}

function runUI(
  relayer: RelayerApp<any>,
  store: RedisStorage,
  { port }: any,
  logger: Logger
) {
  const app = new Koa();

  app.use(store.storageKoaUI("/ui"));
  app.use(async (ctx, next) => {
    if (ctx.request.method !== "GET" && ctx.request.url !== "/metrics") {
      await next();
      return;
    }

    ctx.body = await store.registry.metrics();
  });

  port = Number(port) || 3000;
  app.listen(port, () => {
    logger.info(`Running on ${port}...`);
    logger.info(`For the UI, open http://localhost:${port}/ui`);
    logger.info("Make sure Redis is running on port 6379 by default");
  });
}

main();
