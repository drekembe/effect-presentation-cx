import { AiLanguageModel } from "@effect/ai";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Config, Effect, Layer, Schema } from "effect";

const MtgSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  manaCost: Schema.NonEmptyString,
  cardTypes: Schema.Array(Schema.NonEmptyString),
  cardSuperTypes: Schema.Array(Schema.NonEmptyString),
  rulesText: Schema.NonEmptyString,
  powerAndToughness: Schema.Option(Schema.Struct({
    power: Schema.Number,
    toughness: Schema.Number,
  })),
  artDescription: Schema.NonEmptyString,
});

const generateMtgCard = Effect.gen(function*() {
  const response = yield* AiLanguageModel.generateObject({
    prompt:
      "Generate a random mtg card. when generating, try to generate an even distribution of creatures, lands, instants, sorceries, artifacts and enchantments",
    schema: MtgSchema,
  });
  return response;
});

const main = Effect.gen(function*() {
  const gpt4o = yield* OpenAiLanguageModel.model("gpt-4o");
  const response = yield* gpt4o.use(generateMtgCard);
  yield* Effect.log(response.value);
}).pipe(Effect.withLogSpan("ai_call"));

const OpenAiWithHttp = OpenAiClient.layerConfig({
  apiKey: Config.redacted("OPENAI_API_KEY"),
}).pipe(Layer.provide(FetchHttpClient.layer));

BunRuntime.runMain(
  main.pipe(Effect.provide(BunContext.layer), Effect.provide(OpenAiWithHttp)),
);
