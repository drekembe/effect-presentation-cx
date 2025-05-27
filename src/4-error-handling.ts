import { Data, Effect, Schedule } from "effect";

class PokemonError extends Data.TaggedError("PokemonError")<{ cause: unknown; name: string }> {}

const getPokemon = (name: string) =>
  Effect.tryPromise({
    try: () => fetch(`https://pokeapi.co/api/v2/pokemon/${name}`).then(res => res.json()),
    catch: (error) => new PokemonError({ cause: error, name }),
  });

// TODO: Add timeout, fibonacci backoff
// const schedule = Schedule.intersect(Schedule.fibonacci("1 second"), Schedule.recurs(5));
const getPokemonRetry = (name: string) =>
  getPokemon(name).pipe(
    Effect.retry({ times: 3 }),
  );

// TODO: Limit concurrency
const getMultiplePokemon = (names: Array<string>) => Effect.all(names.map(getPokemonRetry));

// TODO: add storage, catch errors
const program = Effect.gen(function*() {
  const pokemans = yield* getMultiplePokemon(["snorlax", "pikachu"]);
  yield* Effect.log(pokemans.map(pokemon => pokemon.name));
});
// class StorageError extends Data.TaggedError("StorgeError")<{}> {}

// const storePokemon = (key: string, data: unknown) =>
//   Effect.gen(function*() {
//     if (key.length > 3) {
//       yield* Effect.succeed(key);
//     } else {
//       yield* Effect.fail(new StorageError());
//     }
//   });

Effect.runPromise(program);
