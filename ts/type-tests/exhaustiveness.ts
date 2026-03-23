import { match, shape, tag } from "../src/index";

declare const bool: boolean;
declare const route: "a" | "b";
declare const event:
  | { type: "pay"; amount: number }
  | { type: "refund"; refundId: string };

match(bool).when(true).to("yes").when(false).to("no").run();
match(route).when("a").to(1).when("b").to(2).run();
match(event).when(tag("type", "pay")).to("pay").when(tag("type", "refund")).to("refund").run();

match(Math.random() > 0.5 ? ({ a: 1 } as const) : ({ b: 2 } as const))
  .when(shape({ a: 1 }))
  .to("a")
  .when(shape({ b: 2 }))
  .to("b")
  .run();

const nonExhaustive = match(bool).when(true).to("yes");

// @ts-expect-error non-exhaustive matcher requires otherwise() or an explicit diagnostic hint
nonExhaustive.run();

// @ts-expect-error literal false is not assignable to Pattern<true>
match(true).when(false);

// @ts-expect-error exhaustive matcher rejects additional branches
match(bool).when(true).to("yes").when(false).to("no").when(true);
