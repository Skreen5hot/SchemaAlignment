/**
 * Output Structure and Invariants Tests
 *
 * 19 test cases validating JSON-LD output structure, field IRI normalization,
 * JCS canonicalization, error handling, and property-based invariants.
 *
 * Task 1.17 from ROADMAP.md.
 */

import { strictEqual, ok } from "node:assert";
import { align } from "../src/kernel/transform.js";
import { stableStringify } from "../src/kernel/canonicalize.js";
import type {
  CISMRoot,
  SchemaNode,
  SASResult,
  DataFieldLD,
} from "../src/kernel/transform.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCISM(
  fields: Array<{ name: string; node: SchemaNode }>,
  rootOccurrences?: number,
): CISMRoot {
  const occ = rootOccurrences ?? fields[0].node.occurrences;
  return {
    version: "1.3",
    generatedAt: "2026-03-01T00:00:00.000Z",
    config: {},
    root: {
      kind: "object",
      occurrences: occ,
      properties: fields.map((f) => ({ name: f.name, target: f.node })),
    },
  };
}

function prim(
  primitiveType: string,
  occurrences: number,
  typeDistribution: Record<string, number>,
): SchemaNode {
  return { kind: "primitive", primitiveType, occurrences, typeDistribution };
}

/** Recursively verify all object keys are lexicographically sorted. */
function keysAreSorted(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return true;
  if (Array.isArray(obj)) return obj.every(keysAreSorted);
  const keys = Object.keys(obj);
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] < keys[i - 1]) return false;
  }
  return Object.values(obj).every(keysAreSorted);
}

const HASH = "sha256:output-test";
let passed = 0;
let failed = 0;

// ---------------------------------------------------------------------------
// Shared results for invariant tests
// ---------------------------------------------------------------------------

const multiCism = makeCISM([
  { name: "id", node: prim("integer", 100, { integer: 100 }) },
  { name: "Name", node: prim("string", 100, { string: 100 }) },
  { name: "name", node: prim("string", 100, { string: 100 }) },
  { name: "score", node: prim("number", 100, { number: 95, string: 5 }) },
  { name: "active", node: prim("boolean", 100, { boolean: 100 }) },
  { name: "sparse", node: prim("integer", 10000, { "null": 9997, integer: 3 }) },
  { name: "metadata", node: { kind: "object" as const, occurrences: 100, properties: [] } },
], 10000);
const multiResult = align(multiCism, HASH);

const errorCism: CISMRoot = {
  version: "1.0",
  generatedAt: "2026-03-01T00:00:00.000Z",
  config: {},
  root: { kind: "object", occurrences: 0, properties: [] },
};
const errorResult = align(errorCism, HASH);

// ---------------------------------------------------------------------------
// Test 1: Field IRI normalization
// "Revenue" → viz:field/revenue, "First Name" → viz:field/first-name
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([
    { name: "Revenue", node: prim("integer", 100, { integer: 100 }) },
    { name: "First Name", node: prim("string", 100, { string: 100 }) },
  ]);
  const result = align(cism, HASH);
  const fields = result.schema!["viz:hasField"];
  strictEqual(fields[0]["@id"], "viz:field/revenue");
  strictEqual(fields[1]["@id"], "viz:field/first-name");
  console.log("  \u2713 PASS: field IRI normalization \u2192 revenue, first-name");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: field IRI normalization");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 2: Field IRI collision
// Two fields normalizing to same slug → second gets -1 suffix
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  const nameField = fields.find((f) => f["viz:fieldName"] === "Name")!;
  const nameField2 = fields.find((f) => f["viz:fieldName"] === "name")!;
  strictEqual(nameField["@id"], "viz:field/name");
  strictEqual(nameField2["@id"], "viz:field/name-1");
  console.log("  \u2713 PASS: field IRI collision \u2192 name, name-1");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: field IRI collision");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 3: Raw hash propagation
// rawHash appears as viz:rawInputHash in output
// ---------------------------------------------------------------------------
try {
  strictEqual(multiResult.schema!["viz:rawInputHash"], HASH);
  console.log("  \u2713 PASS: raw hash propagation \u2192 viz:rawInputHash matches input");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: raw hash propagation");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 4: JCS canonicalization
// stableStringify output has lexicographically sorted keys at every level
// ---------------------------------------------------------------------------
try {
  const serialized = stableStringify(multiResult, true);
  const parsed = JSON.parse(serialized);
  ok(keysAreSorted(parsed), "all keys should be lexicographically sorted after stableStringify");
  console.log("  \u2713 PASS: JCS canonicalization \u2192 all keys lexicographically sorted");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: JCS canonicalization");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 5: SASResult status on fatal
// CISM version "1.0" → status "error", schema absent, SAS-007
// ---------------------------------------------------------------------------
try {
  strictEqual(errorResult.status, "error");
  strictEqual(errorResult.schema, undefined);
  ok(errorResult.diagnostics.some((d) => d.code === "SAS-007"), "expected SAS-007");
  console.log("  \u2713 PASS: SASResult status on fatal \u2192 error, no schema, SAS-007");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: SASResult status on fatal");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 6: Schema-level fatal (SAS-007)
// version "1.0" → status "error", SAS-007 with level "fatal" in diagnostics
// ---------------------------------------------------------------------------
try {
  const diag = errorResult.diagnostics.find((d) => d.code === "SAS-007");
  ok(diag !== undefined, "SAS-007 diagnostic must be present");
  strictEqual(diag!.level, "fatal");
  ok(diag!.message.includes("1.0"), "SAS-007 message should reference the version");
  console.log("  \u2713 PASS: schema-level fatal \u2192 SAS-007 with level 'fatal'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: schema-level fatal (SAS-007)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 7: Field-level fatal (SAS-013)
// One field has count mismatch → UnknownType, status "ok", other fields intact
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([
    { name: "good", node: prim("integer", 100, { integer: 100 }) },
    { name: "bad", node: prim("integer", 100, { integer: 60, string: 50 }) },
    { name: "also_good", node: prim("string", 100, { string: 100 }) },
  ]);
  const result = align(cism, HASH);
  strictEqual(result.status, "ok");
  ok(result.schema !== undefined, "schema should be present");
  const fields = result.schema!["viz:hasField"];
  strictEqual(fields.length, 3);
  strictEqual(fields[0]["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  strictEqual(fields[1]["viz:hasDataType"]["@id"], "viz:UnknownType");
  strictEqual(fields[2]["viz:hasDataType"]["@id"], "viz:NominalType");
  ok(result.diagnostics.some((d) => d.code === "SAS-013"), "expected SAS-013");
  console.log("  \u2713 PASS: field-level fatal \u2192 bad field UnknownType, status ok, others intact");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: field-level fatal (SAS-013)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 8: Property invariant 1 — align() terminates and never throws
// ---------------------------------------------------------------------------
try {
  // Test with valid, error, and edge-case CISMs
  const results: SASResult[] = [
    multiResult,
    errorResult,
    align({ version: "1.3", generatedAt: "", config: {}, root: { kind: "object", occurrences: 0, properties: [] } }, HASH),
    align({ version: "1.3", generatedAt: "", config: {}, root: { kind: "array", occurrences: 1, itemType: { kind: "object", occurrences: 0, properties: [] } } }, HASH),
  ];
  ok(results.every((r) => r !== null && r !== undefined), "all results are defined");
  console.log("  \u2713 PASS: invariant 1 \u2192 align() terminates and never throws");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 1 (align terminates)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 9: Property invariant 2 — status is "ok" or "error"
// ---------------------------------------------------------------------------
try {
  ok(multiResult.status === "ok" || multiResult.status === "error", "multiResult status");
  ok(errorResult.status === "ok" || errorResult.status === "error", "errorResult status");
  strictEqual(multiResult.status, "ok");
  strictEqual(errorResult.status, "error");
  console.log("  \u2713 PASS: invariant 2 \u2192 status is 'ok' or 'error'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 2 (status values)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 10: Property invariant 3 — If "ok", every primitive SchemaEdge
// produces exactly one DataField (nested/array skipped)
// ---------------------------------------------------------------------------
try {
  const edges = multiCism.root.properties!;
  const primitiveEdges = edges.filter((e) => e.target.kind === "primitive");
  const fields = multiResult.schema!["viz:hasField"];
  strictEqual(fields.length, primitiveEdges.length);
  console.log("  \u2713 PASS: invariant 3 \u2192 " + primitiveEdges.length + " primitive edges \u2192 " + fields.length + " DataFields");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 3 (primitive edge count)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 11: Property invariant 4 — If "error", schema absent,
// at least one fatal diagnostic
// ---------------------------------------------------------------------------
try {
  strictEqual(errorResult.status, "error");
  strictEqual(errorResult.schema, undefined);
  ok(errorResult.diagnostics.length > 0, "at least one diagnostic");
  ok(errorResult.diagnostics.some((d) => d.level === "fatal"), "at least one fatal diagnostic");
  console.log("  \u2713 PASS: invariant 4 \u2192 error: no schema, has fatal diagnostic");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 4 (error shape)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 12: Property invariant 5 — Every DataField has exactly one
// viz:hasDataType with an @id
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  for (const f of fields) {
    const dt = f["viz:hasDataType"];
    ok(dt !== undefined && dt !== null, `${f["viz:fieldName"]} has viz:hasDataType`);
    ok(typeof dt["@id"] === "string" && dt["@id"].length > 0, `${f["viz:fieldName"]} has @id string`);
  }
  console.log("  \u2713 PASS: invariant 5 \u2192 every DataField has exactly one viz:hasDataType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 5 (hasDataType)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 13: Property invariant 6 — Every consensusScore matches format
// /^\d+\.\d{6}$/ and is in [0.000000, 1.000000]
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  const pattern = /^\d+\.\d{6}$/;
  for (const f of fields) {
    const score = f["viz:consensusScore"];
    ok(typeof score === "string", `${f["viz:fieldName"]} score is string`);
    ok(pattern.test(score), `${f["viz:fieldName"]} score "${score}" matches format`);
    const num = parseFloat(score);
    ok(num >= 0 && num <= 1, `${f["viz:fieldName"]} score ${num} in [0,1]`);
  }
  console.log("  \u2713 PASS: invariant 6 \u2192 all consensusScores valid format and range");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 6 (consensusScore format)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 14: Property invariant 7 — numerator <= denominator,
// both non-negative integers
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  for (const f of fields) {
    const num = f["sas:consensusNumerator"];
    const den = f["sas:consensusDenominator"];
    ok(typeof num === "number" && Number.isInteger(num), `${f["viz:fieldName"]} num is integer`);
    ok(typeof den === "number" && Number.isInteger(den), `${f["viz:fieldName"]} den is integer`);
    ok(num >= 0, `${f["viz:fieldName"]} num >= 0`);
    ok(den >= 0, `${f["viz:fieldName"]} den >= 0`);
    ok(num <= den, `${f["viz:fieldName"]} num (${num}) <= den (${den})`);
  }
  console.log("  \u2713 PASS: invariant 7 \u2192 all numerator/denominator valid");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 7 (numerator/denominator)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 15: Property invariant 8 — Every DataField has sas:alignmentRule string
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  for (const f of fields) {
    const rule = f["sas:alignmentRule"];
    ok(typeof rule === "string" && rule.length > 0, `${f["viz:fieldName"]} has alignmentRule`);
  }
  console.log("  \u2713 PASS: invariant 8 \u2192 every DataField has sas:alignmentRule");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 8 (alignmentRule)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 16: Property invariant 11 — viz:rawInputHash equals input rawHash
// ---------------------------------------------------------------------------
try {
  strictEqual(multiResult.schema!["viz:rawInputHash"], HASH);
  // Also check with a different hash value
  const altHash = "sha256:alternate-hash";
  const altResult = align(multiCism, altHash);
  strictEqual(altResult.schema!["viz:rawInputHash"], altHash);
  console.log("  \u2713 PASS: invariant 11 \u2192 viz:rawInputHash equals input rawHash");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 11 (rawInputHash)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 17: Property invariant 12 — If nonNullTotal < minObservationThreshold,
// type is UnknownType
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  const sparseField = fields.find((f) => f["viz:fieldName"] === "sparse")!;
  ok(sparseField !== undefined, "sparse field exists");
  strictEqual(sparseField["viz:hasDataType"]["@id"], "viz:UnknownType");
  console.log("  \u2713 PASS: invariant 12 \u2192 sparse field (nonNull 3 < 5) is UnknownType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 12 (min observation → UnknownType)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 18: Property invariant 14 — viz:hasField preserves SchemaEdge order
// ---------------------------------------------------------------------------
try {
  const edges = multiCism.root.properties!;
  const primitiveEdges = edges.filter((e) => e.target.kind === "primitive");
  const fields = multiResult.schema!["viz:hasField"];
  strictEqual(fields.length, primitiveEdges.length);
  for (let i = 0; i < fields.length; i++) {
    strictEqual(fields[i]["viz:fieldName"], primitiveEdges[i].name,
      `field ${i}: expected "${primitiveEdges[i].name}", got "${fields[i]["viz:fieldName"]}"`);
  }
  console.log("  \u2713 PASS: invariant 14 \u2192 viz:hasField preserves CISM edge order");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 14 (field order)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 19: Property invariant 15 — All @id values in viz:hasField are unique
// ---------------------------------------------------------------------------
try {
  const fields = multiResult.schema!["viz:hasField"];
  const ids = fields.map((f) => f["@id"]);
  const uniqueIds = new Set(ids);
  strictEqual(uniqueIds.size, ids.length, `expected ${ids.length} unique IDs, got ${uniqueIds.size}`);
  console.log("  \u2713 PASS: invariant 15 \u2192 all " + ids.length + " @id values are unique");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: invariant 15 (unique @id)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
