import { FetchHttpClient, HttpClient, Terminal } from "@effect/platform";
import { BunContext, BunHttpPlatform, BunRuntime } from "@effect/platform-bun";
import { Clock, Context, Data, Effect, Either, Layer, Schedule } from "effect";

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
});
// TODO: Handle error, add retry

// const MockAciValidationService = Layer.succeed(
//   AciValidationService,
//   AciValidationService.of({
//     validateAciNumber: (aciNumber) =>
//       aciNumber.startsWith("7") ? Effect.void : Effect.fail(new AciValidationError({ aciNumber })),
//   }),
// );

// const RealAciValidationService = Layer.effect(
//   AciValidationService,
//   Effect.gen(function*() {
//     const client = yield* HttpClient.HttpClient;
//     return AciValidationService.of({
//       validateAciNumber: (aciNumber) =>
//         Effect.gen(function*() {
//           const result = yield* client.get(`http://www.randomnumberapi.com/api/v1.0/random`);
//           const json = (yield* result.json) as [number];
//           if (json[0] > 50) {
//             yield* Effect.fail(new AciValidationError({ aciNumber }));
//           }
//         }),
//     });
//   }),
// );

// TODO: Provide BunContext.layer, MockAciValidationService
BunRuntime.runMain(program);
