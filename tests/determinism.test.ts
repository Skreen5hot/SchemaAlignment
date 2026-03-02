/**
 * Determinism Test
 *
 * Verifies that the kernel align() produces identical output
 * when invoked multiple times with the same input.
 *
 * This is Spec Test #1 from ARCHITECTURE.md.
 */

import { deepStrictEqual, strictEqual } from "node:assert";
import { align } from "../src/kernel/transform.js";
import { stableStringify } from "../src/kernel/canonicalize.js";
import type { CISMRoot } from "../src/kernel/transform.js";

const cism: CISMRoot = {
  version: "1.3",
  generatedAt: "2026-03-01T00:00:00.000Z",
  config: {},
  root: {
    kind: "array",
    occurrences: 1,
    itemType: {
      kind: "object",
      occurrences: 10,
      properties: [
        {
          name: "id",
          target: { kind: "primitive", primitiveType: "integer", occurrences: 10, typeDistribution: { integer: 10 } },
        },
        {
          name: "label",
          target: { kind: "primitive", primitiveType: "string", occurrences: 10, typeDistribution: { string: 10 } },
        },
      ],
    },
  },
};

const rawHash = "sha256:determinism-test";

let passed = 0;
let failed = 0;

// Test 1: Structural equality across invocations
try {
  const output1 = align(cism, rawHash);
  const output2 = align(cism, rawHash);
  deepStrictEqual(output1, output2);
  console.log("  \u2713 PASS: align produces structurally identical output on repeated invocation");
  passed++;
} catch (error) {
  console.error("  \u2717 FAIL: align produced structurally different output on repeated invocation");
  console.error(" ", error instanceof Error ? error.message : String(error));
  failed++;
}

// Test 2: Canonicalized string equality (catches key ordering differences)
try {
  const output1 = align(cism, rawHash);
  const output2 = align(cism, rawHash);
  const str1 = stableStringify(output1);
  const str2 = stableStringify(output2);
  strictEqual(str1, str2);
  console.log("  \u2713 PASS: canonicalized output strings are identical");
  passed++;
} catch (error) {
  console.error("  \u2717 FAIL: canonicalized output strings differ");
  console.error(" ", error instanceof Error ? error.message : String(error));
  failed++;
}

// Test 3: Input immutability
try {
  const freshCism: CISMRoot = JSON.parse(JSON.stringify(cism));
  align(cism, rawHash);
  deepStrictEqual(cism, freshCism);
  console.log("  \u2713 PASS: align does not mutate input");
  passed++;
} catch (error) {
  console.error("  \u2717 FAIL: align mutated the input object");
  console.error(" ", error instanceof Error ? error.message : String(error));
  failed++;
}

// Summary
console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
