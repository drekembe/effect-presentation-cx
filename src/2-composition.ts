import { Effect } from "effect";

const getPokemon = (name: string) =>
  Effect.tryPromise({
    try: () => fetch(`https://pokeapi.co/api/v2/pokemon/${name}`).then(res => res.json()),
    catch: () => new Error("Bad Pokemon"),
  });

const getPokemonAndLog = (name: string) =>
  getPokemon(name).pipe(
    Effect.map(pokemon => `${pokemon.name}:${pokemon.id}`),
    Effect.andThen((output) => Effect.log(output)),
  );

const getTwoPokemonAndLog = (name1: string, name2: string) =>
  getPokemon(name1).pipe(
    Effect.andThen(pokemon1 =>
      getPokemon(name2).pipe(Effect.andThen((pokemon2) => Effect.log(`${pokemon1.id}, ${pokemon2.id}`)))
    ),
  );

// const getTwoPokemonAndLog = (name1: string, name2: string) =>
//   Effect.gen(function*() {
//     const pokemon1 = yield* getPokemon(name1);
//     const pokemon2 = yield* getPokemon(name2);
//     yield* Effect.log(`${pokemon1.id}, ${pokemon2.id}`);
//   });

Effect.runPromise(getPokemonAndLog("snorlax"));
