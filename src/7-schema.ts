import { BunRuntime } from "@effect/platform-bun";
import { Effect, JSONSchema, Schema } from "effect";

// Annotations

// const NonEmptyStringTrim = Schema.NonEmptyString.pipe(Schema.compose(Schema.Trim));
const Person = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  age: Schema.NumberFromString,
});

type Person = typeof Person.Type;

type PersonEncoded = typeof Person.Encoded;

// type guard
const isPerson = Schema.is(Person);

class MenuItem extends Schema.Class<MenuItem>("MenuItem")({
  id: Schema.NonEmptyTrimmedString,
  name: Schema.NonEmptyTrimmedString.pipe(Schema.length({ min: 2, max: 80 })),
  price: Schema.NumberFromString,
  currency: Schema.Literal("EUR", "USD", "RMB"),
}) {}

// Can add descriptions and annotations to filters
const LongString = Schema.String.pipe(
  Schema.filter(
    (s) => s.length >= 10 ? undefined : "a string at least 10 characters long",
    {
      identifier: "LongString",
      jsonSchema: { minLength: 10 },
      description: "Lorem ipsum dolor sit amet, ...",
    },
  ),
);

// Transformations
const BooleanFromString = Schema.transform(
  Schema.Literal("on", "off"),
  Schema.Boolean,
  {
    strict: true,
    decode: (s) => s === "on",
    encode: (bool) => (bool ? "on" : "off"),
  },
);

type EncodedBooleanFromString = typeof BooleanFromString.Encoded;
type DecodedBooleanFromString = typeof BooleanFromString.Type;

// Define a Password schema, starting with a string type
const Password = Schema.String
  // Add a custom error message for non-string values
  .annotations({ message: () => "not a string" })
  .pipe(
    // Enforce non-empty strings and provide a custom error message
    Schema.nonEmptyString({ message: () => "required" }),
    // Restrict the string length to 10 characters or fewer
    // with a custom error message for exceeding length
    Schema.minLength(10, {
      message: (issue) => `${issue.actual} is too short`,
    }),
  )
  .annotations({
    // Add a unique identifier for the schema
    identifier: "Password",
    // Provide a title for the schema
    title: "password",
    // Include a description explaining what this schema represents
    description: "A password is a secret string used to authenticate a user",
    // Add examples for better clarity
    examples: ["1Ki77yeeeeeeee", "jelly22fi$heeere"],
    // Include any additional documentation
    documentation: `...technical information on Password schema...`,
  });

// Parse json
const PersonFromJson = Schema.parseJson(Person);

// Utility stuff
const decodeBase64url = Schema.decodeUnknown(Schema.StringFromBase64Url);
const encodeBase64url = Schema.encode(Schema.StringFromBase64Url);

// Branded schemas
const UserId = Schema.String.pipe(Schema.brand("UserId"));
type UserId = typeof UserId.Type;
function doSomethingWithUserId(userId: UserId) {
  console.log({ userId });
}

const program = Effect.gen(function*() {
  const person = yield* Schema.decodeUnknown(Person)({ name: `小明`, age: "22" });
  yield* Effect.log({ person });

  // const toOrder = yield* Schema.decodeUnknown(MenuItem)({ id: "12", name: "Lignji", price: "23", currency: "EUR" });
  // yield* Effect.log({ toOrder });

  // const decodedSwitchValue = yield* Schema.decodeUnknown(BooleanFromString)("off");
  // const encodedSwitchValue = yield* Schema.encode(BooleanFromString)(true);
  // yield* Effect.log({ switchValue: decodedSwitchValue, encodedSwitchValue });

  // const personFromJson = yield* Schema.decode(PersonFromJson)(`{ "name": "王丽丽", "age": "21" }`);
  // yield* Effect.log({ personFromJson });

  // const decodedUrl = yield* decodeBase64url("Zm9vYmFy");
  // yield* Effect.log({ decodedUrl });
  // const encodedUrl = yield* encodeBase64url("foobar");
  // yield* Effect.log({ encodedUrl });

  // const Base64Person = Schema.compose(Schema.StringFromBase64Url, PersonFromJson);
  // const encodedBase64Person = yield* Schema.encode(Base64Person)({ name: `小明`, age: 22 });
  // yield* Effect.log({ encodedBase64Person });
  // const decodedBase64Person = yield* Schema.decode(Base64Person)("eyJuYW1lIjoi5bCP5piOIiwiYWdlIjoiMjIifQ");
  // yield* Effect.log({ decodedBase64Person });

  // const jsonSchema = JSONSchema.make(Password);
  // yield* Effect.log(JSON.stringify(jsonSchema, null, 2));
}).pipe(
  Effect.withLogSpan("decoding"),
);

BunRuntime.runMain(
  program,
);
