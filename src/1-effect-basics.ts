import { Effect } from "effect";
// Effect: robustness, error handling, concurrency, DI, batteries included etc.
async function getTodos() {
  return await fetch("https://todos.com/my-todos").then(res => res.json());
}

// It's lazy!
const program = Effect.log(`你好`);

const someValue = Effect.succeed(1917);

const epicFail = Effect.fail(new Error("I can't do it"));

function divide(a: number, b: number): Effect.Effect<number, Error> {
  if (b === 0) return Effect.fail(new Error("Cannot divide by 零"));
  return Effect.succeed(a / b);
}

const calculation = Effect.sync(() => 2 + 2);

const getPokemon = (name: string) =>
  Effect.tryPromise({
    try: () => fetch(`https://pokeapi.co/api/v2/pokemon/${name}`).then(res => res.json()),
    catch: () => new Error("Bad Pokemon"),
  });

Effect.runPromise(program);
