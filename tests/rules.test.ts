/**
 * Rules Tests — Temporal, Boolean, Null Vocab, Normalization
 *
 * 13 test cases for post-consensus rules: temporal detection (name + SNP),
 * boolean pair detection, null vocabulary reclassification, SNP annotations,
 * nested structure skipping, and SAS v2.1 addendum tests (T-19, T-20).
 *
 * Tasks 1.16 and 1.21 from ROADMAP.md.
 */

import { strictEqual, ok } from "node:assert";
import { align } from "../src/kernel/transform.js";
import type {
  CISMRoot,
  SchemaNode,
  SASResult,
  DataFieldLD,
  ManifestEntry,
  SASConfig,
} from "../src/kernel/transform.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal CISM with one or more fields. */
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

/** Extract the first field from a successful SASResult. */
function getField(result: SASResult, index = 0): DataFieldLD {
  const fields = result.schema?.["viz:hasField"];
  if (!fields || fields.length <= index) throw new Error(`No field at index ${index}`);
  return fields[index];
}

/** Check whether a diagnostic code exists in the result. */
function hasDiag(result: SASResult, code: string): boolean {
  return result.diagnostics.some((d) => d.code === code);
}

const HASH = "sha256:rules-test";
let passed = 0;
let failed = 0;

// ---------------------------------------------------------------------------
// Test 1: Temporal (name match)
// field "created_at", string → TemporalType, rule "temporal-detection", SAS-010
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "created_at",
    node: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } },
  }]);
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:TemporalType");
  strictEqual(field["sas:alignmentRule"], "temporal-detection");
  ok(hasDiag(result, "SAS-010"), "expected SAS-010 diagnostic");
  console.log("  \u2713 PASS: temporal (name match) \u2192 TemporalType + SAS-010");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: temporal (name match)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 2: Temporal (SNP evidence)
// manifest with detail.type "date_converted" → TemporalType, SAS-009
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "event_date",
    node: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } },
  }]);
  const manifest: ManifestEntry[] = [
    { rule: "snp", path: "event_date", detail: { type: "date_converted" } },
  ];
  const result = align(cism, HASH, undefined, manifest);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:TemporalType");
  strictEqual(field["sas:alignmentRule"], "temporal-detection-snp-evidence");
  ok(hasDiag(result, "SAS-009"), "expected SAS-009 diagnostic");
  console.log("  \u2713 PASS: temporal (SNP evidence) \u2192 TemporalType + SAS-009");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: temporal (SNP evidence)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 3: Temporal (no match)
// field "description", string → NominalType (no temporal override)
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "description",
    node: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } },
  }]);
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  ok(!hasDiag(result, "SAS-009"), "should not have SAS-009");
  ok(!hasDiag(result, "SAS-010"), "should not have SAS-010");
  console.log("  \u2713 PASS: temporal (no match) \u2192 NominalType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: temporal (no match)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 4: Temporal not triggered after null vocab shift
// field "created_at" with { integer: 90, string: 10 }, occ 100
// Null vocab reclassifies strings → consensus assigns QuantitativeType
// → temporal detection does NOT run (currentType ≠ NominalType)
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "created_at",
    node: { kind: "primitive", primitiveType: "integer", occurrences: 100, typeDistribution: { integer: 90, string: 10 } },
  }]);
  const config: Partial<SASConfig> = {
    nullVocabulary: { created_at: ["N/A", "n/a"] },
  };
  const result = align(cism, HASH, config);
  const field = getField(result);
  // Without null vocab: 90/100 = 0.90 < 0.95 → NominalType → temporal fires
  // With null vocab: strings→null, 90/90 = 1.0 → QuantitativeType → temporal skips
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  ok(!hasDiag(result, "SAS-010"), "temporal detection should NOT fire when type is not NominalType");
  ok(hasDiag(result, "SAS-008"), "expected SAS-008 (null vocab changed consensus winner)");
  console.log("  \u2713 PASS: temporal not triggered after null vocab shift \u2192 QuantitativeType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: temporal not triggered after null vocab shift");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 5: Boolean pair (configured)
// booleanFields: { "is_active": ["Y", "N"] }, field "is_active" → BooleanType
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "is_active",
    node: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } },
  }]);
  const config: Partial<SASConfig> = {
    booleanFields: { is_active: ["Y", "N"] },
  };
  const result = align(cism, HASH, config);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:BooleanType");
  strictEqual(field["sas:alignmentRule"], "boolean-pair-configured");
  console.log("  \u2713 PASS: boolean pair (configured) \u2192 BooleanType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: boolean pair (configured)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 6: Boolean pair (not configured)
// field "is_active", no booleanFields config → NominalType
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "is_active",
    node: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } },
  }]);
  const result = align(cism, HASH);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:NominalType");
  console.log("  \u2713 PASS: boolean pair (not configured) \u2192 NominalType");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: boolean pair (not configured)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 7: Null vocabulary (field-specific)
// nullVocabulary: { "result": ["N/A"] }, field with { integer: 90, string: 10 }
// Without null vocab: 90/100 < 0.95 → NominalType
// With null vocab: strings→null, 90/90 = 1.0 → QuantitativeType, SAS-008
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "result",
    node: { kind: "primitive", primitiveType: "integer", occurrences: 100, typeDistribution: { integer: 90, string: 10 } },
  }]);
  const config: Partial<SASConfig> = {
    nullVocabulary: { result: ["N/A"] },
  };
  const result = align(cism, HASH, config);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:QuantitativeType");
  ok(hasDiag(result, "SAS-008"), "expected SAS-008 (null vocab changed winner)");
  console.log("  \u2713 PASS: null vocabulary (field-specific) \u2192 QuantitativeType + SAS-008");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: null vocabulary (field-specific)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 8: Null vocab cascade order
// Verify numerator/denominator reflect adjusted nonNullTotal, not original
// Same setup as test 7: after null vocab, nonNull = 90, num = 90, den = 90
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "result",
    node: { kind: "primitive", primitiveType: "integer", occurrences: 100, typeDistribution: { integer: 90, string: 10 } },
  }]);
  const config: Partial<SASConfig> = {
    nullVocabulary: { result: ["N/A"] },
  };
  const result = align(cism, HASH, config);
  const field = getField(result);
  // After null vocab: { integer: 90, null: 10 }, nonNull = 90
  // Consensus runs on adjusted counts → num=90, den=90
  strictEqual(field["sas:consensusNumerator"], 90);
  strictEqual(field["sas:consensusDenominator"], 90);
  console.log("  \u2713 PASS: null vocab cascade order \u2192 num/den reflect adjusted nonNullTotal (90/90)");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: null vocab cascade order");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 9: SNP currency annotation
// manifest with detail.type "currency_stripped" → viz:wasNormalized: true
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "revenue",
    node: { kind: "primitive", primitiveType: "integer", occurrences: 100, typeDistribution: { integer: 100 } },
  }]);
  const manifest: ManifestEntry[] = [
    { rule: "snp", path: "revenue", detail: { type: "currency_stripped", originalValue: "$1,234" } },
  ];
  const result = align(cism, HASH, undefined, manifest);
  const field = getField(result);
  strictEqual(field["viz:wasNormalized"], true);
  console.log("  \u2713 PASS: SNP currency annotation \u2192 viz:wasNormalized: true");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: SNP currency annotation");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 10: SNP percentage annotation
// manifest with detail.type "percent_stripped" → viz:wasPercentage: true
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "rate",
    node: { kind: "primitive", primitiveType: "integer", occurrences: 100, typeDistribution: { integer: 100 } },
  }]);
  const manifest: ManifestEntry[] = [
    { rule: "snp", path: "rate", detail: { type: "percent_stripped", originalValue: "45%" } },
  ];
  const result = align(cism, HASH, undefined, manifest);
  const field = getField(result);
  strictEqual(field["viz:wasPercentage"], true);
  console.log("  \u2713 PASS: SNP percentage annotation \u2192 viz:wasPercentage: true");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: SNP percentage annotation");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 11: Nested structure skipped
// CISM with nested object property → SAS-003, field not in output
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([
    {
      name: "id",
      node: { kind: "primitive", primitiveType: "integer", occurrences: 100, typeDistribution: { integer: 100 } },
    },
    {
      name: "metadata",
      node: {
        kind: "object",
        occurrences: 100,
        properties: [
          { name: "source", target: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } } },
        ],
      },
    },
  ]);
  const result = align(cism, HASH);
  const fields = result.schema?.["viz:hasField"] ?? [];
  // Only "id" should be in the output — "metadata" (object) is skipped
  strictEqual(fields.length, 1);
  strictEqual(fields[0]["viz:fieldName"], "id");
  ok(hasDiag(result, "SAS-003"), "expected SAS-003 diagnostic for nested object");
  console.log("  \u2713 PASS: nested structure skipped \u2192 SAS-003, only primitive fields in output");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: nested structure skipped");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 12 (T-19): Temporal (SNP evidence) — wasNormalized NOT present
// field "order_id" (no temporal name match), SNP date_converted → TemporalType
// wasNormalized must NOT be present (date conversion ≠ normalization)
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "order_id",
    node: { kind: "primitive", primitiveType: "string", occurrences: 100, typeDistribution: { string: 100 } },
  }]);
  const manifest: ManifestEntry[] = [
    { rule: "snp", path: "order_id", detail: { type: "date_converted" } },
  ];
  const result = align(cism, HASH, undefined, manifest);
  const field = getField(result);
  strictEqual(field["viz:hasDataType"]["@id"], "viz:TemporalType");
  strictEqual(field["sas:alignmentRule"], "temporal-detection-snp-evidence");
  ok(hasDiag(result, "SAS-009"), "expected SAS-009");
  // Key addendum assertion: wasNormalized must NOT be present
  strictEqual(field["viz:wasNormalized"], undefined,
    "date_converted must NOT set wasNormalized");
  console.log("  \u2713 PASS: T-19 temporal SNP evidence \u2192 TemporalType, no wasNormalized");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: T-19 temporal SNP evidence (wasNormalized absence)");
  console.error(" ", e instanceof Error ? e.message : String(e));
  failed++;
}

// ---------------------------------------------------------------------------
// Test 13 (T-20): structural-passthrough after null vocabulary exhaustion
// All values reclassified → nonNullTotal=0 → UnknownType, structural-passthrough
// ---------------------------------------------------------------------------
try {
  const cism = makeCISM([{
    name: "status",
    node: { kind: "primitive", primitiveType: "string", occurrences: 10, typeDistribution: { string: 10 } },
  }]);
  const config: Partial<SASConfig> = {
    nullVocabulary: { status: ["N/A", "none", "-", "null", "unknown", "na", "not available", "n/a", "pending", "tbd"] },
  };
  const result = align(cism, HASH, config);
  const field = getField(result);
  // After reclassification: all 10 strings → null, nonNullTotal = 0
  strictEqual(field["viz:hasDataType"]["@id"], "viz:UnknownType",
    "null exhaustion must produce UnknownType");
  strictEqual(field["sas:alignmentRule"], "structural-passthrough",
    "rule must be structural-passthrough, not unknown-assignment");
  strictEqual(field["viz:consensusScore"], "0.000000");
  strictEqual(field["sas:consensusNumerator"], 0);
  strictEqual(field["sas:consensusDenominator"], 0);
  // Must be SAS-008 (null vocab), NOT SAS-013 (validation) or SAS-002 (empty field)
  ok(hasDiag(result, "SAS-008"), "expected SAS-008 diagnostic");
  ok(!hasDiag(result, "SAS-013"), "must NOT have SAS-013");
  ok(!hasDiag(result, "SAS-002"), "must NOT have SAS-002");
  console.log("  \u2713 PASS: T-20 null vocab exhaustion \u2192 UnknownType, structural-passthrough, SAS-008");
  passed++;
} catch (e) {
  console.error("  \u2717 FAIL: T-20 null vocab exhaustion");
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
