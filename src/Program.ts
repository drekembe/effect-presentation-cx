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
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";

class Nope extends Schema.TaggedError<Nope>()(
  "Nope",
  {
    severity: Schema.Number,
  },
  HttpApiSchema.annotations({ status: 409 }),
) {}

const rr = Effect.gen(function*() {
  yield* Effect.log("going once");
  yield* Effect.sleep("1 seconds");
  yield* Effect.fail(new Error("what"));
}).pipe(
  Effect.retry({ times: 3 }),
);

class Random extends Context.Tag("Random")<Random, { getRandom: Effect.Effect<number> }>() {}

const UserId = Schema.NonEmptyString.pipe(Schema.brand("User"));
type UserId = Schema.Schema.Type<typeof UserId>;

const User = Schema.Struct({
  id: UserId,
  username: Schema.NonEmptyString,
});

type User = Schema.Schema.Type<typeof User>;

class Db extends Context.Tag("DB")<Db, {
  saveUser: (u: User) => Effect.Effect<void>;
  getUser: (id: UserId) => Effect.Effect<Option.Option<User>>;
}>() {}

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
    });
  }),
);

const idParam = HttpApiSchema.param(
  "id",
  Schema.NonEmptyString.annotations({ description: "OK id param" }).pipe(
    Schema.compose(Schema.Trim),
    Schema.maxLength(5),
  ).annotations({ description: "wwowowo " }),
);

const userIdParam = HttpApiSchema.param("userid", UserId);

const PostMe = Schema.Struct({
  id: Schema.NonEmptyTrimmedString,
  name: Schema.NonEmptyString,
});

const grp = HttpApiGroup.make("Wased").add(HttpApiEndpoint.get("nyoo")`/hehehe`.addSuccess(Schema.String));

const MyApi = HttpApi.make("MyApi").add(grp).add(
  HttpApiGroup.make("Base")
    .add(HttpApiEndpoint.get("helloWorld")`/`.addSuccess(Schema.String))
    .add(
      HttpApiEndpoint.get("whatup")`/${idParam}/`.addSuccess(Schema.String).addError(Nope).addError(
        HttpApiError.Forbidden,
      ).annotate(
        OpenApi.Description,
        "Whatup endpoint",
      ).setUrlParams(
        Schema.Struct({
          // Parameter "page" for pagination
          page: Schema.optionalWith(Schema.NumberFromString, { exact: true }).annotations({ description: "Pagegege" }),
          // Parameter "sort" for sorting options with an added description
          sort: Schema.optionalWith(
            Schema.String.annotations({
              description: "Sorting criteria (e.g., 'name', 'date eg')",
            }),
            { exact: true },
          ),
        }),
      ),
    )
    .add(HttpApiEndpoint.post("postMe")`/big-post/`.setPayload(PostMe).addSuccess(Schema.String))
    .add(HttpApiEndpoint.post("createUser")`/users/`.setPayload(User))
    .add(HttpApiEndpoint.get("getUserById")`/users/${userIdParam}/`.addSuccess(User)).addError(HttpApiError.NotFound)
    .prefix("/groupPrefix")
    .annotate(OpenApi.Description, "Based"),
);

const DfGrp2 = HttpApiBuilder.group(
  MyApi,
  "Wased",
  handlers => handlers.handle("nyoo", () => Effect.succeed("hehehe")),
);

const DefaultGroup = HttpApiBuilder.group(
  MyApi,
  "Base",
  handlers =>
    handlers
      .handle("postMe", () => {
        return Effect.succeed("OKOKOKOK");
      })
      .handle("helloWorld", () => Effect.succeed("Yo"))
      .handle(
        "whatup",
        (params) =>
          Effect.gen(function*() {
            const { getRandom } = yield* Random;
            const rn = yield* getRandom;
            yield* Effect.log(rn);
            if (rn > 0.5) {
              return yield* Effect.fail(new Nope({ severity: rn }));
            }
            return yield* Effect.succeed(`${params.path.id}${rn}`);
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

const LiveApi = HttpApiBuilder.api(MyApi).pipe(Layer.provide(DefaultGroup), Layer.provide(DfGrp2));

const RandomLive = Layer.succeed(
  Random,
  Random.of({
    getRandom: Effect.sync(() => Math.random()),
  }),
);

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

const program = Effect.gen(function*() {
  const client = yield* HttpApiClient.make(MyApi, {
    baseUrl: "http://localhost:3000",
  });
  yield* rr;
  const hello = (client.Base.whatup({ path: { id: "你好  " }, urlParams: {} })).pipe(
    Effect.andThen(Effect.log),
  ).pipe(
    Effect.catchTag("Nope", (nope) => Effect.log(`Recovering from Nope: ${nope.severity}`)),
  );
  yield* Effect.schedule(
    hello,
    Schedule.intersect(Schedule.fibonacci("1 second"), Schedule.recurs(5)),
  );
}).pipe(
  Effect.catchTags({
    "Forbidden": () => Effect.log("Forbidden"),
    "ParseError": () => Effect.log("ParseError"),
    "HttpApiDecodeError": () => Effect.log("No decode"),
    "ResponseError": () => Effect.log("Resp"),
    "RequestError": () => Effect.log("REquest handle"),
  }),
);

Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)));
