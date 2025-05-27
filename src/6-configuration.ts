import { FetchHttpClient, HttpClient, Terminal } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Clock, Config, ConfigProvider, Context, Data, Effect, Layer, Option } from "effect";

class AciValidationError extends Data.TaggedError("AciValidationError")<{ aciNumber: string }> {}

class AciValidationService extends Context.Tag("AciValidationService")<AciValidationService, {
  validateAciNumber: (aciNumber: string) => Effect.Effect<void, AciValidationError>;
}>() {}

const program = Effect.gen(function*() {
  const terminal = yield* Terminal.Terminal;
  const now = yield* Clock.currentTimeMillis;
  yield* Effect.log(`Time is now ${new Date(now)}`);
  yield* terminal.display("Input an ACI number:\n");
  const input = yield* terminal.readLine;
  const aciValidationService = yield* AciValidationService;
  yield* aciValidationService.validateAciNumber(input);
  yield* Effect.log("All good!");
}).pipe(
  Effect.catchTag("AciValidationError", (ee) => Effect.log(`Error validating ACI number ${ee.aciNumber}`)),
);

const MockAciValidationService = Layer.succeed(
  AciValidationService,
  AciValidationService.of({
    validateAciNumber: (aciNumber) =>
      aciNumber.startsWith("7") ? Effect.void : Effect.fail(new AciValidationError({ aciNumber })),
  }),
);

const RealAciValidationService = Layer.effect(
  AciValidationService,
  Effect.gen(function*() {
    const client = yield* HttpClient.HttpClient;
    const nafezaBaseUrl = yield* Config.nonEmptyString("NAFEZA_BASE_URL");
    const nafezaPort = yield* Config.option(Config.integer("NAFEZA_PORT"));
    const nafezaClientId = yield* Config.nonEmptyString("NAFEZA_CLIENT_ID");
    const nafezaClientSecret = yield* Config.redacted("NAFEZA_CLIENT_SECRET");
    yield* Effect.log(`Secret is: ${nafezaClientSecret}`);
    return AciValidationService.of({
      validateAciNumber: (aciNumber) =>
        Effect.gen(function*() {
          const url = Option.match(nafezaPort, {
            onNone: () => `https://${nafezaClientId}:${nafezaClientSecret}@${nafezaBaseUrl}/validate/${aciNumber}`,
            onSome: (port) =>
              `https://${nafezaClientId}:${nafezaClientSecret}@${nafezaBaseUrl}:${port}/validate/${aciNumber}`,
          });
          const result = yield* client.get(url);
          const json = (yield* result.json) as { result: { isValid: boolean } };
          if (!json.result.isValid) {
            yield* Effect.fail(new AciValidationError({ aciNumber }));
          }
        }).pipe(
          Effect.withSpan("validateAci"),
          Effect.catchTags({
            "RequestError": () => Effect.fail(new AciValidationError({ aciNumber })),
            "ResponseError": () => Effect.fail(new AciValidationError({ aciNumber })),
          }),
        ),
    });
  }),
);
// TODO: Catch error on construction?

// const MockConfig = ConfigProvider.fromMap(
//   new Map([
//     ["NAFEZA_BASE_URL", "nafeza.org"],
//     ["NAFEZA_CLIENT_ID", "sfsdf"],
//     ["NAFEZA_CLIENT_SECRET", "erwwer"],
//   ]),
// );

BunRuntime.runMain(
  program.pipe(
    // Effect.withConfigProvider(MockConfig),
    Effect.provide(BunContext.layer),
    Effect.provide(RealAciValidationService),
    Effect.provide(FetchHttpClient.layer),
  ),
);
