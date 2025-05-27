import { Effect } from "effect";

const getPokemon = (name: string) =>
  Effect.tryPromise({
    try: () => fetch(`https://pokeapi.co/api/v2/pokemon/${name}`).then(res => res.json()),
    catch: () => new Error("Bad Pokemon"),
  });

const getPokemonLoggedAndSlowed = (name: string) =>
  Effect.gen(function*() {
    yield* Effect.log(`Fetching ${name}`);
    yield* Effect.sleep("3 seconds");
    const pokemon = yield* getPokemon(name);
    yield* Effect.log(`Got ${name}`);
    return pokemon;
  });

// TODO: Limit concurrency
const getMultiplePokemon = (names: Array<string>) => Effect.all(names.map(getPokemonLoggedAndSlowed));

const program = Effect.gen(function*() {
  const pokemons = yield* getMultiplePokemon(["snorlax", "pikachu", "charizard", "gengar"]);
  yield* Effect.log(pokemons.map(pokemon => pokemon.name));
});

Effect.runPromise(program);
