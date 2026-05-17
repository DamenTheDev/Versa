const test = require("node:test");
const assert = require("node:assert/strict");
const {
  _normalizeShoppingItem,
  _calculateSimulationEloDelta,
} = require("./index");

test("normalizeShoppingItem returns null for invalid input", () => {
  assert.equal(_normalizeShoppingItem(null), null);
  assert.equal(_normalizeShoppingItem({id: "1"}), null);
  assert.equal(_normalizeShoppingItem({title: "Item"}), null);
});

test("normalizeShoppingItem normalizes and defaults optional fields", () => {
  const item = _normalizeShoppingItem({
    id: 123,
    title: "Chair",
    price: "99.50",
  });

  assert.equal(item.source_id, "123");
  assert.equal(item.title, "Chair");
  assert.equal(item.price, 99.5);
  assert.equal(item.image_url, "");
  assert.equal(item.merchant_name, "");
  assert.ok(item.created_at);
});

test("calculateSimulationEloDelta obeys configured min/max bounds", () => {
  assert.equal(_calculateSimulationEloDelta(() => 0), -20);
  assert.equal(_calculateSimulationEloDelta(() => 0.999999), 20);
});
