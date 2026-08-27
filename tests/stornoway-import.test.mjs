import test from "node:test";
import assert from "node:assert/strict";
import {
  parseStornowayFragment,
  readImportedLineIds,
  rememberImportedLineIds,
  STORNOWAY_FRAGMENT_PREFIX,
  STORNOWAY_SESSION_KEY,
} from "../src/stornoway-import.js";

function fragment(payload) {
  return `${STORNOWAY_FRAGMENT_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

const validPayload = {
  v: 1,
  source: "stornoway",
  lineId: "line-123",
  requestNumber: "REQ-45",
  lotNumber: "36182",
  fitName: "Weird Guy",
  sizes: [
    { size: "27", quantity: 5 },
    { size: "M", quantity: 2 },
  ],
};

test("parses and normalizes an exact v1 Stornoway payload", () => {
  const result = parseStornowayFragment(fragment(validPayload));

  assert.equal(result.error, null);
  assert.equal(result.payload.lineId, "line-123");
  assert.deepEqual(result.payload.counts, { 27: 5, M: 2 });
  assert.deepEqual(result.payload.orderedSizes, [27, "M"]);
});

test("ignores unrelated fragments", () => {
  assert.deepEqual(parseStornowayFragment("#anything-else"), {
    found: false,
    payload: null,
    error: null,
  });
});

test("rejects unexpected fields and invalid quantities", () => {
  const withSecret = parseStornowayFragment(fragment({ ...validPayload, email: "no@example.com" }));
  assert.equal(withSecret.payload, null);
  assert.match(withSecret.error, /inattendues/);

  const zeroQuantity = parseStornowayFragment(
    fragment({ ...validPayload, sizes: [{ size: "27", quantity: 0 }] })
  );
  assert.equal(zeroQuantity.payload, null);
  assert.match(zeroQuantity.error, /tailles/);
});

test("keeps imported source lines unique for the current session", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  rememberImportedLineIds(storage, ["line-1", "line-2"]);
  rememberImportedLineIds(storage, ["line-2", "line-3"]);

  assert.deepEqual(readImportedLineIds(storage), ["line-1", "line-2", "line-3"]);
  assert.equal(values.has(STORNOWAY_SESSION_KEY), true);
});
