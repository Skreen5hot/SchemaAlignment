/**
 * Demo Entry Point — Browser
 *
 * Imports the kernel directly (transform.ts + canonicalize.ts).
 * Wires the HTML UI to align() for interactive CISM → viz:DatasetSchema demos.
 * Bundled by esbuild into site/dist/demo.js.
 */

import { align } from "../src/kernel/transform.js";
import type { CISMRoot, Diagnostic } from "../src/kernel/transform.js";
import { stableStringify } from "../src/kernel/canonicalize.js";

// ---------------------------------------------------------------------------
// Embedded Appendix B fixture (examples/input.jsonld)
// ---------------------------------------------------------------------------

const DEFAULT_CISM: CISMRoot = {
  version: "1.3",
  generatedAt: "2026-03-01T00:00:00.000Z",
  config: {
    requiredThreshold: 1,
    emptyStringAsNull: true,
    sampleSize: 2000,
    maxSizeWarning: 10485760,
  },
  root: {
    id: "#",
    kind: "array",
    occurrences: 1,
    itemType: {
      id: "#/[]",
      kind: "object",
      occurrences: 500,
      properties: [
        {
          name: "Region",
          target: {
            id: "#/[]/Region",
            kind: "primitive",
            primitiveType: "string",
            occurrences: 500,
            nullable: false,
            typeDistribution: { string: 500 },
          },
          required: true,
          occurrences: 500,
          totalPopulation: 500,
        },
        {
          name: "Revenue",
          target: {
            id: "#/[]/Revenue",
            kind: "primitive",
            primitiveType: "string",
            occurrences: 500,
            nullable: true,
            typeDistribution: { "null": 3, integer: 492, string: 5 },
          },
          required: true,
          occurrences: 500,
          totalPopulation: 500,
        },
        {
          name: "created_at",
          target: {
            id: "#/[]/created_at",
            kind: "primitive",
            primitiveType: "string",
            occurrences: 500,
            nullable: false,
            typeDistribution: { string: 500 },
          },
          required: true,
          occurrences: 500,
          totalPopulation: 500,
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const inputEl = document.getElementById("cism-input") as HTMLTextAreaElement;
const outputEl = document.getElementById("sas-output") as HTMLElement;
const diagEl = document.getElementById("diagnostics") as HTMLElement;
const alignBtn = document.getElementById("align-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;

// ---------------------------------------------------------------------------
// Initialize with default example
// ---------------------------------------------------------------------------

inputEl.value = JSON.stringify(DEFAULT_CISM, null, 2);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

alignBtn.addEventListener("click", async () => {
  const raw = inputEl.value.trim();

  // Parse input
  let cism: CISMRoot;
  try {
    cism = JSON.parse(raw);
  } catch (e) {
    outputEl.textContent = "";
    diagEl.innerHTML = renderError("Invalid JSON: " + (e instanceof Error ? e.message : String(e)));
    return;
  }

  // Compute hash via Web Crypto
  const rawHash = await computeHash(raw);

  // Run kernel (synchronous, never throws)
  const result = align(cism, rawHash);

  // Render output
  outputEl.textContent = stableStringify(result, true);
  outputEl.classList.remove("output-placeholder");

  // Render diagnostics
  diagEl.innerHTML = renderDiagnostics(result.diagnostics);
});

resetBtn.addEventListener("click", () => {
  inputEl.value = JSON.stringify(DEFAULT_CISM, null, 2);
  outputEl.innerHTML = '<span class="output-placeholder">Click Align to see the result.</span>';
  diagEl.innerHTML = '<div class="diag-empty">No diagnostics yet.</div>';
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function computeHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "sha256:" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function renderDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return '<div class="diag-empty">No diagnostics.</div>';
  }
  return diagnostics
    .map(
      (d) =>
        `<div class="diag diag-${escapeAttr(d.level)}">` +
        `<span class="diag-code">${escapeHtml(d.code)}</span>` +
        `<span class="diag-level">${escapeHtml(d.level)}</span>` +
        `${escapeHtml(d.message)}` +
        `</div>`,
    )
    .join("");
}

function renderError(msg: string): string {
  return `<div class="diag diag-fatal"><span class="diag-code">PARSE</span><span class="diag-level">error</span>${escapeHtml(msg)}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/[^a-z0-9-]/gi, "");
}
