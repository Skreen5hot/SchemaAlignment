/**
 * No-Network Test
 *
 * Verifies that the kernel align() does not make any network calls.
 * Stubs globalThis.fetch and XMLHttpRequest (if present), failing if
 * either is invoked during kernel execution.
 *
 * This is Spec Test #2 from ARCHITECTURE.md.
 */

import { align } from "../src/kernel/transform.js";
import type { CISMRoot } from "../src/kernel/transform.js";

let passed = 0;
let failed = 0;

// --- Stub fetch ---
let fetchCalled = false;
let fetchUrl = "";
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: string | URL | Request, _init?: unknown) => {
  fetchCalled = true;
  fetchUrl = String(input);
  throw new Error(`Network call detected: ${fetchUrl}`);
}) as typeof globalThis.fetch;

// --- Stub XMLHttpRequest ---
let xhrInstantiated = false;
const originalXHR = (globalThis as Record<string, unknown>)["XMLHttpRequest"];

(globalThis as Record<string, unknown>)["XMLHttpRequest"] = class StubXHR {
  constructor() {
    xhrInstantiated = true;
    throw new Error("XMLHttpRequest instantiation detected during kernel execution");
  }
};

// --- Run align ---
const cism: CISMRoot = {
  version: "1.3",
  generatedAt: "2026-03-01T00:00:00.000Z",
  config: {},
  root: {
    kind: "array",
    occurrences: 1,
    itemType: {
      kind: "object",
      occurrences: 5,
      properties: [
        {
          name: "value",
          target: { kind: "primitive", primitiveType: "integer", occurrences: 5, typeDistribution: { integer: 5 } },
        },
      ],
    },
  },
};

try {
  align(cism, "sha256:no-network-test");

  // Check fetch
  if (fetchCalled) {
    console.error(`  \u2717 FAIL: kernel invoked fetch (URL: ${fetchUrl})`);
    failed++;
  } else {
    console.log("  \u2713 PASS: kernel does not invoke fetch during align");
    passed++;
  }

  // Check XMLHttpRequest
  if (xhrInstantiated) {
    console.error("  \u2717 FAIL: kernel instantiated XMLHttpRequest");
    failed++;
  } else {
    console.log("  \u2713 PASS: kernel does not instantiate XMLHttpRequest during align");
    passed++;
  }
} catch (error) {
  console.error("  \u2717 FAIL: kernel threw during no-network test");
  console.error(" ", error instanceof Error ? error.message : String(error));
  failed++;
} finally {
  // Restore originals
  globalThis.fetch = originalFetch;
  (globalThis as Record<string, unknown>)["XMLHttpRequest"] = originalXHR;
}

// Summary
console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
