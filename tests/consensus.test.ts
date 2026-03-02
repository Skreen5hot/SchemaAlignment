/**
 * Consensus and Type Mapping Tests
 *
 * 23 test cases for consensus promotion, thresholds, tie-breaking,
 * passthrough, precision, min observation, unknown assignment, CISM
 * validation, unrecognized keys, and boolean-encoded-string.
 *
 * Task 1.15 from ROADMAP.md.
 */

import { strictEqual, ok } from "node:assert";
import { align } from "../src/kernel/transform.js";
import type { CISMRoot, SchemaNode, SASResult, DataFieldLD } from "../src/kernel/transform.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal CISM with a single field. */
function makeCISM(fieldName: string, node: SchemaNode): CISMRoot {
  return {
    version: "1.3",
    generatedAt: "2026-03-01T00:00:00.000Z",
    config: {},
    root: {
      kind: "object",
      occurrences: node.occurrences,
      properties: [{ name: fieldName, target: node }],
    },
  };
}

/** Extract the first field from a successful SASResult. */
function getField(result: SASResult): DataFieldLD {
  const fields = result.schema?.["viz:hasField"];
  if (!fields || fields.length === 0) throw new Error("No fields in result");
  return fields[0];
}

/** Check whether a diagnostic code exists in the result. */
function hasDiag(result: SASResult, code: string): boolean {
  return result.diagnostics.some((d) => d.code === code);
}

const HASH = "sha256:consensus-test";
let passed = 0;
let failed = 0;

// ---------------------------------------------------------------------------
// Test 1: Consensus promotion (integer)
// { "integer": 95, "string": 5 }, occ 100 → QuantitativeType, "0.950000"
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 95, string: 5 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  strictEqual(field["viz:consensusScore"], "0.950000");
  console.log("  \u2713 PASS: consensus promotion (integer) \u2192 QuantitativeType at 0.950000");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: consensus promotion (integer)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 2: Consensus below threshold
// { "integer": 94, "string": 6 }, occ 100 → NominalType, SAS-001
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 94, string: 6 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  ok(hasDiag(result, "SAS-001"), "expected SAS-001 diagnostic");
  console.log("  \u2713 PASS: consensus below threshold \u2192 NominalType + SAS-001");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: consensus below threshold");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 3: Consensus with nulls
// { "null": 10, "integer": 85, "string": 5 }, occ 100
// nonNull 90, 85/90 ≈ 0.9444 < 0.95 → NominalType, SAS-001
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { "null": 10, integer: 85, string: 5 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  ok(hasDiag(result, "SAS-001"), "expected SAS-001 diagnostic");
  console.log("  \u2713 PASS: consensus with nulls (85/90 < 0.95) \u2192 NominalType + SAS-001");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: consensus with nulls");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 4: Consensus exact threshold (≥, not >)
// { "integer": 95, "string": 5 }, occ 100 → 95*1M >= 950K*100 → passes
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 95, string: 5 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  ok(!hasDiag(result, "SAS-001"), "should not have SAS-001 at exact threshold");
  console.log("  \u2713 PASS: consensus exact threshold passes (\u2265, not >)");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: consensus exact threshold");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 5: Integer threshold boundary (passes)
// { "integer": 19, "string": 1 }, occ 20 → 19*1M=19M >= 950K*20=19M → passes
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 20,
    typeDistribution: { integer: 19, string: 1 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  ok(!hasDiag(result, "SAS-001"), "should not have SAS-001 when threshold passes");
  console.log("  \u2713 PASS: integer threshold boundary passes (19*1M >= 950K*20)");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: integer threshold boundary (passes)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 6: Integer threshold boundary (fails)
// { "integer": 189, "string": 11 }, occ 200 → 189M < 190M → fails
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 200,
    typeDistribution: { integer: 189, string: 11 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  ok(hasDiag(result, "SAS-001"), "expected SAS-001 diagnostic");
  console.log("  \u2713 PASS: integer threshold boundary fails (189M < 190M)");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: integer threshold boundary (fails)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 7: Consensus tie-breaking (ADR-006)
// { "integer": 50, "number": 50 }, occ 100, threshold 0.50
// Both pass → number wins (wider in lattice rank 4 > integer rank 3)
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "number", occurrences: 100,
    typeDistribution: { integer: 50, number: 50 },
  });
  const result = align(cism, HASH, { consensusThreshold: 0.50 });
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  strictEqual(field["viz:numericPrecision"], "float");
  console.log("  \u2713 PASS: tie-breaking \u2192 number wins (wider in lattice) \u2192 precision 'float'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: consensus tie-breaking (ADR-006)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 8: Structural passthrough (integer)
// { "integer": 100 }, occ 100 → QuantitativeType, "1.000000", "integer"
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("count", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  strictEqual(field["viz:consensusScore"], "1.000000");
  strictEqual(field["viz:numericPrecision"], "integer");
  console.log("  \u2713 PASS: passthrough (integer) \u2192 QuantitativeType, 1.000000, precision 'integer'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: structural passthrough (integer)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 9: Structural passthrough (boolean)
// { "boolean": 100 }, occ 100 → BooleanType
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("active", {
    kind: "primitive", primitiveType: "boolean", occurrences: 100,
    typeDistribution: { boolean: 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:BooleanType");
  console.log("  \u2713 PASS: passthrough (boolean) \u2192 BooleanType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: structural passthrough (boolean)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 10: Structural passthrough (string, no temporal)
// { "string": 100 }, occ 100, field "description" → NominalType
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("description", {
    kind: "primitive", primitiveType: "string", occurrences: 100,
    typeDistribution: { string: 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  console.log("  \u2713 PASS: passthrough (string) field 'description' \u2192 NominalType (not temporal)");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: structural passthrough (string, no temporal)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 11: Numeric precision (integer)
// primitiveType "integer" → numericPrecision "integer"
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("id", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:numericPrecision"], "integer");
  console.log("  \u2713 PASS: numeric precision (integer) \u2192 'integer'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: numeric precision (integer)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 12: Numeric precision (float)
// primitiveType "number" → numericPrecision "float"
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("price", {
    kind: "primitive", primitiveType: "number", occurrences: 100,
    typeDistribution: { number: 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:numericPrecision"], "float");
  console.log("  \u2713 PASS: numeric precision (float) \u2192 'float'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: numeric precision (float)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 13: Numeric precision (consensus override)
// BIBSS widened to "number", but 98% integer → precision "integer"
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("count", {
    kind: "primitive", primitiveType: "number", occurrences: 100,
    typeDistribution: { integer: 98, number: 2 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  strictEqual(field["viz:numericPrecision"], "integer");
  console.log("  \u2713 PASS: consensus override \u2192 precision 'integer' despite primitiveType 'number'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: numeric precision (consensus override)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 14: ConsensusScore string format
// Always a JSON string matching /^\d+\.\d{6}$/. 1.0 → "1.000000"
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  const score = field["viz:consensusScore"];
  ok(typeof score === "string", "consensusScore must be a string");
  ok(/^\d+\.\d{6}$/.test(score), `consensusScore "${score}" must match /^\\d+\\.\\d{6}$/`);
  strictEqual(score, "1.000000");
  console.log("  \u2713 PASS: consensusScore string format \u2192 '1.000000'");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: consensusScore string format");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 15: Numerator/denominator integers
// sas:consensusNumerator and sas:consensusDenominator present as integers
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("value", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 95, string: 5 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  const num = field["sas:consensusNumerator"];
  const den = field["sas:consensusDenominator"];
  ok(typeof num === "number" && Number.isInteger(num), "consensusNumerator must be an integer");
  ok(typeof den === "number" && Number.isInteger(den), "consensusDenominator must be an integer");
  strictEqual(num, 95);
  strictEqual(den, 100);
  console.log("  \u2713 PASS: numerator/denominator are exact integers (95, 100)");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: numerator/denominator integers");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 16: Min observation (below)
// { "null": 9997, "integer": 3 }, occ 10000 → nonNull 3 < 5 → UnknownType, SAS-012
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("rare", {
    kind: "primitive", primitiveType: "integer", occurrences: 10000,
    typeDistribution: { "null": 9997, integer: 3 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:UnknownType");
  ok(hasDiag(result, "SAS-012"), "expected SAS-012 diagnostic");
  console.log("  \u2713 PASS: min observation below (3 < 5) \u2192 UnknownType + SAS-012");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: min observation (below)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 17: Min observation (at threshold)
// { "null": 95, "integer": 5 }, occ 100, min 5 → nonNull 5 >= 5 → proceeds
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("sparse", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { "null": 95, integer: 5 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  // nonNull = 5 >= 5 → passes min observation; 5/5 = 1.0 → QuantitativeType
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  ok(!hasDiag(result, "SAS-012"), "should not have SAS-012 at exact min observation");
  console.log("  \u2713 PASS: min observation at threshold (5 >= 5) \u2192 proceeds to consensus");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: min observation (at threshold)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 18: Min observation (single)
// { "null": 9999, "integer": 1 }, occ 10000 → nonNull 1 < 5 → UnknownType, SAS-012
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("singleton", {
    kind: "primitive", primitiveType: "integer", occurrences: 10000,
    typeDistribution: { "null": 9999, integer: 1 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:UnknownType");
  ok(hasDiag(result, "SAS-012"), "expected SAS-012 diagnostic");
  console.log("  \u2713 PASS: min observation single (1 < 5) \u2192 UnknownType + SAS-012");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: min observation (single)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 19: Unknown (all null)
// { "null": 100 }, occ 100, primitiveType "null" → UnknownType, SAS-002
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("empty", {
    kind: "primitive", primitiveType: "null", occurrences: 100,
    typeDistribution: { "null": 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:UnknownType");
  ok(hasDiag(result, "SAS-002"), "expected SAS-002 diagnostic");
  console.log("  \u2713 PASS: all null \u2192 UnknownType + SAS-002");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: unknown (all null)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 20: Unknown (union)
// kind "union" → UnknownType, SAS-002
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("mixed", {
    kind: "union", occurrences: 100,
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:UnknownType");
  ok(hasDiag(result, "SAS-002"), "expected SAS-002 diagnostic");
  console.log("  \u2713 PASS: union kind \u2192 UnknownType + SAS-002");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: unknown (union)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 21: CISM count mismatch
// typeDistribution sum (110) > occurrences (100) → SAS-013, UnknownType
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("bad_counts", {
    kind: "primitive", primitiveType: "integer", occurrences: 100,
    typeDistribution: { integer: 60, string: 50 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:UnknownType");
  ok(hasDiag(result, "SAS-013"), "expected SAS-013 diagnostic");
  console.log("  \u2713 PASS: CISM count mismatch (sum 110 > occ 100) \u2192 UnknownType + SAS-013");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: CISM count mismatch");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 22: Unrecognized key
// { "custom_type": 50 }, occ 50 → folded to string → NominalType, SAS-014
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("exotic", {
    kind: "primitive", primitiveType: "string", occurrences: 50,
    typeDistribution: { custom_type: 50 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  ok(hasDiag(result, "SAS-014"), "expected SAS-014 diagnostic");
  console.log("  \u2713 PASS: unrecognized key 'custom_type' \u2192 treated as string + SAS-014");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: unrecognized key");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 23: boolean-encoded-string recognized
// { "boolean-encoded-string": 100 }, occ 100 → BooleanType, no SAS-014
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM("is_active", {
    kind: "primitive", primitiveType: "string", occurrences: 100,
    typeDistribution: { "boolean-encoded-string": 100 },
  });
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:BooleanType");
  ok(!hasDiag(result, "SAS-014"), "boolean-encoded-string should NOT trigger SAS-014");
  console.log("  \u2713 PASS: boolean-encoded-string \u2192 BooleanType, no SAS-014");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: boolean-encoded-string recognized");
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
