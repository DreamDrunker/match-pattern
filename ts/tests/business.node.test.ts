import { describe, expect, it } from "vitest";

import {
  and,
  eq,
  exactShape,
  gt,
  lt,
  match,
  not,
  or,
  shape,
  tag,
} from "../src/index";

describe("business scenarios", () => {
  it("routes order workflow state in e-commerce", () => {
    type Order = {
      status: "created" | "paid" | "packed" | "shipped" | "cancelled";
      amount: number;
      items: Array<{ sku: string; qty: number }>;
    };
    const nextStep = (order: Order) =>
      match(order)
        .when(shape({ status: eq("created"), amount: gt(0) }))
        .to("collect-payment")
        .when(
          shape({ status: eq("paid"), items: (items) => Array.isArray(items) }),
        )
        .to("reserve-stock")
        .when(shape({ status: eq("packed") }))
        .to("handover-carrier")
        .when(shape({ status: eq("shipped") }))
        .to("wait-delivery")
        .otherwise("closed");

    expect(
      nextStep({
        status: "created",
        amount: 88,
        items: [{ sku: "A", qty: 1 }],
      }),
    ).toBe("collect-payment");
    expect(
      nextStep({ status: "paid", amount: 88, items: [{ sku: "A", qty: 1 }] }),
    ).toBe("reserve-stock");
    expect(nextStep({ status: "cancelled", amount: 88, items: [] })).toBe(
      "closed",
    );
  });

  it("routes payment events with discriminated union tags", () => {
    type Event =
      | { type: "pay"; amount: number; orderId: string }
      | { type: "refund"; amount: number; refundId: string }
      | { type: "ping" };
    const channel = (event: Event): string =>
      match(event)
        .when(and(tag("type", "pay"), shape({ amount: gt(0) })))
        .to("payment-flow")
        .when(tag("type", "refund"))
        .to("refund-flow")
        .otherwise("ignore");

    expect(channel({ type: "pay", amount: 50, orderId: "o-1" })).toBe(
      "payment-flow",
    );
    expect(channel({ type: "refund", amount: 50, refundId: "r-1" })).toBe(
      "refund-flow",
    );
    expect(channel({ type: "ping" })).toBe("ignore");
  });

  it("classifies fraud risk based on nested user profile", () => {
    type Tx = {
      type: "pay";
      amount: number;
      user: { chargebackCount: number; trustedDevice: boolean };
    };
    const classify = (tx: Tx): string =>
      match(tx)
        .when(
          and(
            shape({ amount: gt(3000) }),
            shape({ user: shape({ chargebackCount: gt(0) }) }),
          ),
        )
        .to("manual-review")
        .when(shape({ user: shape({ trustedDevice: eq(true) }) }))
        .to("auto-approve")
        .otherwise("standard-check");

    expect(
      classify({
        type: "pay",
        amount: 5000,
        user: { chargebackCount: 1, trustedDevice: true },
      }),
    ).toBe("manual-review");
    expect(
      classify({
        type: "pay",
        amount: 100,
        user: { chargebackCount: 0, trustedDevice: true },
      }),
    ).toBe("auto-approve");
  });

  it("decides access control with composed predicates", () => {
    type PermissionContext = {
      role: "owner" | "admin" | "viewer";
      action: "read" | "write" | "delete";
      suspended: boolean;
    };
    const allow = (ctx: PermissionContext): boolean =>
      match(ctx)
        .when(
          and(
            shape({ role: eq("owner") }),
            not(shape({ suspended: eq(true) })),
          ),
        )
        .to(true)
        .when(
          and(
            shape({ role: eq("admin") }),
            or(shape({ action: eq("read") }), shape({ action: eq("write") })),
            not(shape({ suspended: eq(true) })),
          ),
        )
        .to(true)
        .when(shape({ role: eq("viewer"), action: eq("read") }))
        .to(true)
        .otherwise(false);

    expect(allow({ role: "owner", action: "delete", suspended: false })).toBe(
      true,
    );
    expect(allow({ role: "admin", action: "write", suspended: false })).toBe(
      true,
    );
    expect(allow({ role: "viewer", action: "write", suspended: false })).toBe(
      false,
    );
    expect(allow({ role: "admin", action: "delete", suspended: true })).toBe(
      false,
    );
  });

  it("computes checkout total with map in promotion flow", () => {
    type Cart = {
      items: Array<{ price: number; count: number }>;
      coupon?: "VIP10";
    };
    const total = (cart: Cart): number =>
      match(cart)
        .when(shape({ coupon: eq("VIP10") }))
        .map(
          ({ items }) =>
            items.reduce((sum, item) => sum + item.price * item.count, 0) * 0.9,
        )
        .when(
          shape({ items: (items) => Array.isArray(items) && items.length > 0 }),
        )
        .map(({ items }) =>
          items.reduce((sum, item) => sum + item.price * item.count, 0),
        )
        .otherwise(0);

    expect(
      total({
        items: [
          { price: 10, count: 2 },
          { price: 20, count: 1 },
        ],
        coupon: "VIP10",
      }),
    ).toBe(36);
    expect(total({ items: [{ price: 10, count: 1 }] })).toBe(10);
  });

  it("handles SLA tiers for logistics", () => {
    type Shipment = {
      country: "CN" | "US" | "SG";
      express: boolean;
      parcelCount: number;
    };
    const classifySla = (shipment: Shipment): string =>
      match(shipment)
        .when(
          exactShape({
            country: eq("CN"),
            express: eq(true),
            parcelCount: gt(0),
          }),
        )
        .to("same-day")
        .when(shape({ country: eq("SG"), express: eq(true) }))
        .to("next-day")
        .when(shape({ country: eq("US") }))
        .to("intl-standard")
        .otherwise("manual");

    expect(classifySla({ country: "CN", express: true, parcelCount: 2 })).toBe(
      "same-day",
    );
    expect(classifySla({ country: "SG", express: true, parcelCount: 1 })).toBe(
      "next-day",
    );
    expect(classifySla({ country: "US", express: false, parcelCount: 1 })).toBe(
      "intl-standard",
    );
  });

  it("selects billing retry policy by error payload", () => {
    type BillingResult =
      | { ok: true; provider: string }
      | {
          ok: false;
          error: { code: "timeout" | "rate_limit" | "auth" | "other" };
        };
    const policy = (result: BillingResult): string =>
      match(result)
        .when({ ok: false, error: { code: "timeout" } })
        .to("retry-fast")
        .when({ ok: false, error: { code: "rate_limit" } })
        .to("retry-backoff")
        .when({ ok: false, error: { code: "auth" } })
        .to("alert-ops")
        .otherwise("done");

    expect(policy({ ok: false, error: { code: "timeout" } })).toBe(
      "retry-fast",
    );
    expect(policy({ ok: false, error: { code: "auth" } })).toBe("alert-ops");
    expect(policy({ ok: true, provider: "stripe" })).toBe("done");
  });

  it("supports config-driven runtime rules for ingestion gates", () => {
    const allowRegion = new Set(["cn", "us"]);
    const regionRule = (
      value: string | number | boolean | object | null | undefined,
    ): boolean => typeof value === "string" && allowRegion.has(value);

    type Row = {
      id: string;
      amount: number;
      region: string;
    };
    const gate = (row: Row): string =>
      match(row)
        .when(shape({ amount: gt(0), region: regionRule }))
        .to("accept")
        .otherwise("reject");

    expect(gate({ id: "1", amount: 9, region: "cn" })).toBe("accept");
    expect(gate({ id: "2", amount: 9, region: "eu" })).toBe("reject");
  });

  it("routes customer support tickets by urgency", () => {
    type Ticket = {
      source: "email" | "chat";
      vip: boolean;
      waitingMinutes: number;
      category: "bug" | "billing" | "other";
    };
    const queue = (ticket: Ticket): string =>
      match(ticket)
        .when(and(shape({ vip: eq(true) }), shape({ waitingMinutes: gt(5) })))
        .to("p0")
        .when(shape({ category: eq("billing"), waitingMinutes: gt(20) }))
        .to("p1")
        .when(shape({ category: eq("bug") }))
        .to("p2")
        .otherwise("p3");

    expect(
      queue({
        source: "chat",
        vip: true,
        waitingMinutes: 10,
        category: "other",
      }),
    ).toBe("p0");
    expect(
      queue({
        source: "email",
        vip: false,
        waitingMinutes: 25,
        category: "billing",
      }),
    ).toBe("p1");
    expect(
      queue({
        source: "email",
        vip: false,
        waitingMinutes: 3,
        category: "bug",
      }),
    ).toBe("p2");
  });

  it("segments marketing campaigns from profile and spend", () => {
    type Profile = {
      tier: "free" | "pro" | "enterprise";
      spend30d: number;
      churnRisk: "low" | "high";
    };
    const campaign = (profile: Profile): string =>
      match(profile)
        .when(
          or(shape({ tier: eq("enterprise") }), shape({ spend30d: gt(1000) })),
        )
        .to("vip-retention")
        .when(shape({ tier: eq("pro"), churnRisk: eq("high") }))
        .to("pro-save")
        .otherwise("acquisition");

    expect(
      campaign({ tier: "enterprise", spend30d: 100, churnRisk: "low" }),
    ).toBe("vip-retention");
    expect(campaign({ tier: "pro", spend30d: 120, churnRisk: "high" })).toBe(
      "pro-save",
    );
    expect(campaign({ tier: "free", spend30d: 0, churnRisk: "low" })).toBe(
      "acquisition",
    );
  });

  it("evaluates inventory actions with number thresholds", () => {
    type Inventory = {
      stock: number;
      reserved: number;
    };
    const action = (inventory: Inventory): string =>
      match(inventory.stock - inventory.reserved)
        .when(lt(5))
        .to("replenish-now")
        .when(lt(20))
        .to("replenish-soon")
        .otherwise("healthy");

    expect(action({ stock: 9, reserved: 6 })).toBe("replenish-now");
    expect(action({ stock: 30, reserved: 15 })).toBe("replenish-soon");
    expect(action({ stock: 100, reserved: 10 })).toBe("healthy");
  });

  it("respects business rule order in overlapping branches", () => {
    const payment: { type: string; amount: number } = {
      type: "pay",
      amount: 20,
    };
    const result = match(payment)
      .when(shape({ type: eq("pay") }))
      .to("generic-pay")
      .when(and(tag("type", "pay"), shape({ amount: gt(10) })))
      .to("large-pay")
      .otherwise("other");

    expect(result).toBe("generic-pay");
  });

  it("throws when boolean branches are incomplete without otherwise", () => {
    const truthy: boolean = Math.random() ? true : false;
    expect(match(truthy).when(false).to(false).otherwise(true)).toBe(truthy);
  });
});
