import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, place, change } from "../src/model.ts";
const customer = { id: "customer", name: "A", phone: "demo", role: "customer" },
  owner = { ...customer, id: "owner0", role: "store_owner" };
function buy(d, id = "m1", ttl = 600000) {
  return place(d, customer, "s0", { [id]: 1 }, "pickup", "", "", "", ttl);
}
test("normal pickup uses store price and reserves a unit", () => {
  const d = initial(),
    n = d.shops[0].stock.m1;
  assert.equal(buy(d).total, d.shops[0].price.m1);
  assert.equal(d.shops[0].stock.m1, n - 1);
});
test("last unit can be reserved only once", () => {
  const d = initial();
  d.shops[0].stock.m1 = 1;
  buy(d);
  assert.throws(() => buy(d));
  assert.equal(d.orders.length, 1);
});
test("expiry restores stock exactly once", () => {
  const d = initial(),
    n = d.shops[0].stock.m1,
    o = buy(d, "m1", -1);
  change(d, null, o.id, "expired");
  assert.equal(n, d.shops[0].stock.m1);
  assert.throws(() => change(d, null, o.id, "expired"));
});
test("rejected orders cannot be completed", () => {
  const d = initial(),
    o = buy(d);
  change(d, owner, o.id, "rejected", "No stock");
  assert.throws(() => change(d, owner, o.id, "completed", o.code));
});
test("other owners cannot accept, correct code required at handover", () => {
  const d = initial(),
    o = buy(d);
  assert.throws(() => change(d, { ...owner, id: "other" }, o.id, "accepted"));
  change(d, owner, o.id, "accepted");
  change(d, owner, o.id, "ready");
  assert.throws(() => change(d, owner, o.id, "completed", "0000"));
  change(d, owner, o.id, "completed", o.code);
});
