import {
  FetchHttpClient,
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
  HttpApiSwagger,
  OpenApi,
} from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Array, Context, Effect, Layer, Option, Order, pipe, Ref, Schedule, Schema } from "effect";

class BadError extends Schema.TaggedError<BadError>()(
  "BadError",
  {
    severity: Schema.Number,
  },
  HttpApiSchema.annotations({ status: 409 }),
) {}

const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));
type UserId = Schema.Schema.Type<typeof UserId>;

const User = Schema.Struct({
  id: UserId,
  username: Schema.NonEmptyString,
}).annotations({
  schemaId: "User",
  title: "The user",
  description: "This is a user",
});

class Random extends Context.Tag("Random")<Random, { getRandom: Effect.Effect<number> }>() {}

class Db extends Context.Tag("DB")<Db, {
  saveUser: (u: User) => Effect.Effect<void>;
  getUser: (id: UserId) => Effect.Effect<Option.Option<User>>;
  getAllUsers: (arg?: { limit: number | undefined; offset: number | undefined }) => Effect.Effect<Array<User>>;
}>() {}

type User = Schema.Schema.Type<typeof User>;

const MockDb = Layer.effect(
  Db,
  Effect.gen(function*() {
    const store = yield* Ref.make<Record<UserId, User>>({});
    return Db.of({
      saveUser: (u) =>
        Ref.get(store).pipe(
          Effect.andThen(value => Ref.set(store, { ...value, [u.id]: u })),
          Effect.tap(() => Effect.log(`Saving user with id ${u.id}`)),
        ),
      getUser: (id) => Ref.get(store).pipe(Effect.map(value => Option.fromNullable(value[id]))),
      getAllUsers: (arg) =>
        Effect.gen(function*() {
          const { limit, offset } = arg ?? {};
          const usersMap = yield* Ref.get(store);
          const usersList = pipe(
            usersMap,
            Array.fromRecord,
            Array.map(([_, user]) => user),
            Array.sortBy(
              Order.mapInput(Order.string, (user) => user.username),
            ),
            Array.drop(offset ?? 0),
            Array.take(limit ?? 1000),
          );

          return yield* Effect.succeed(usersList);
        }),
    });
  }),
);

const RandomLive = Layer.succeed(
  Random,
  Random.of({
    getRandom: Effect.sync(() => Math.random()),
  }),
);

const userIdParam = HttpApiSchema.param("userid", UserId);

const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("Base")
    .add(HttpApiEndpoint.get("hello-world")`/`.addSuccess(Schema.String))
    .add(
      HttpApiEndpoint.get("listUsers")`/users/`.addSuccess(Schema.Array(User)).addError(BadError).addError(
        HttpApiError.Forbidden,
      ).annotate(
        OpenApi.Description,
        "Get all users",
      ).setUrlParams(
        Schema.Struct({
          limit: Schema.optionalWith(Schema.NumberFromString, { exact: true }).annotations({
            description: "Limit to n entries",
          }),
          offset: Schema.optionalWith(
            Schema.NumberFromString.annotations({
              description: "Offset value",
            }),
            { exact: true },
          ),
        }),
      ),
    )
    .add(HttpApiEndpoint.post("createUser")`/users/`.setPayload(User))
    .add(HttpApiEndpoint.get("getUserById")`/users/${userIdParam}/`.addSuccess(User).addError(HttpApiError.NotFound))
    .prefix("/v3")
    .annotate(OpenApi.Description, "My Api Group"),
);

const DefaultGroup = HttpApiBuilder.group(
  MyApi,
  "Base",
  handlers =>
    handlers
      .handle("hello-world", () => Effect.succeed("Yo"))
      .handle(
        "listUsers",
        ({ urlParams: { limit, offset } }) =>
          Effect.gen(function*() {
            const db = yield* Db;
            const { getRandom } = yield* Random;
            const rn = yield* getRandom;
            if (rn > 0.7) {
              return yield* Effect.fail(new BadError({ severity: rn }));
            }
            const users = yield* db.getAllUsers({ limit, offset });
            return users;
          }),
      )
      .handle("getUserById", (params) =>
        Effect.gen(function*() {
          const db = yield* Db;
          const userOption = yield* db.getUser(params.path.userid);
          if (userOption._tag === "Some") {
            return userOption.value;
          } else {
            return yield* Effect.fail(new HttpApiError.NotFound());
          }
        }))
      .handle("createUser", (params) =>
        Effect.gen(function*() {
          yield* Effect.log(`Saving user, ${params.payload.id}`);
          const db = yield* Db;
          yield* db.saveUser(params.payload);
        })),
);

const LiveApi = HttpApiBuilder.api(MyApi).pipe(Layer.provide(DefaultGroup));

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(LiveApi),
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
  Layer.provide(RandomLive),
  Layer.provide(MockDb),
);

Layer.launch(ServerLive).pipe(
  BunRuntime.runMain,
);

// const program = Effect.gen(function*() {
//   const client = yield* HttpApiClient.make(MyApi, {
//     baseUrl: "http://localhost:3000",
//   });
//   const hello = (client.Base.getUserById({ path: { userid: UserId.make("yolo") } })).pipe(
//     Effect.andThen(Effect.log),
//   ).pipe(
//     Effect.catchTag("NotFound", () => Effect.log("Not found")),
//   );
//   yield* Effect.schedule(
//     hello,
//     Schedule.intersect(Schedule.fibonacci("1 second"), Schedule.recurs(5)),
//   );
// }).pipe(
//   Effect.catchTags({
//     "ParseError": () => Effect.log("ParseError"),
//     "HttpApiDecodeError": () => Effect.log("No decode"),
//     "ResponseError": () => Effect.log("Resp"),
//     "RequestError": () => Effect.log("REquest handle"),
//   }),
// );
//
// Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)));
