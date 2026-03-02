/**
 * Kernel Transform Function
 *
 * Pure function: JSON-LD → JSON-LD
 * MUST be deterministic. MUST NOT perform I/O.
 * MUST NOT reference Date, Math.random, fetch, or any non-deterministic API.
 *
 * This is the identity transform — the template's starting point.
 * Consumers replace the transformation logic with their domain-specific rules.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A valid JSON-LD document. MUST include @context. */
export interface JsonLdDocument {
  "@context": string | Record<string, unknown> | Array<string | Record<string, unknown>>;
  [key: string]: unknown;
}

/** Deterministic provenance metadata. No timestamps. */
export interface Provenance {
  "@type": "Provenance";
  kernelVersion: string;
  rulesApplied: string[];
}

/** Uncertainty annotation for unresolved values. */
export interface UncertaintyAnnotation {
  "@type": "Uncertainty";
  status: "deferred" | "assumed" | "unknown";
  reason: string;
  references: string[];
}

/** Successful transform output. */
export interface TransformOutput extends JsonLdDocument {
  provenance: Provenance;
}

/** Error output returned for invalid input. */
export interface TransformError {
  "@context": "https://schema.org";
  "@type": "Error";
  errorCode: string;
  error: string;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// SAS Types — Input (§4.1, §4.2, ADR-003)
// ---------------------------------------------------------------------------

/** Opaque BIBSS inference configuration. SAS passes through, does not inspect. */
export type InferConfig = Record<string, unknown>;

/** CISM structural node (BIBSS v1.3 §9.1). */
export interface SchemaNode {
  kind: "object" | "array" | "primitive" | "union";
  primitiveType?: string;
  typeDistribution?: Record<string, number>;
  occurrences: number;
  nullable?: boolean;
  id?: string;
  properties?: SchemaEdge[];
  itemType?: SchemaNode;
}

/** CISM property edge (BIBSS v1.3 §9.1). */
export interface SchemaEdge {
  name: string;
  target: SchemaNode;
  required?: boolean;
  occurrences?: number;
  totalPopulation?: number;
}

/** BIBSS CISM root document (§4.1). */
export interface CISMRoot {
  version: string;
  generatedAt: string;
  config: InferConfig;
  root: SchemaNode;
  sampling?: {
    applied: boolean;
    inputSize: number;
    sampleSize: number;
    strategy: "strided";
  };
}

/** SNP v1.3 manifest entry (§4.2, ADR-007). */
export interface ManifestEntry {
  rule: string;
  path: string;
  detail?: {
    type?: string;
    originalValue?: string;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Static kernel version. Update when making breaking changes. */
const KERNEL_VERSION = "0.1.0";

/** Integer scale factor for deterministic threshold comparison (§6.1). */
export const THRESH_SCALE = 1_000_000;

// ---------------------------------------------------------------------------
// SAS Types — Output (§5.1, §5.2, §5.3)
// ---------------------------------------------------------------------------

/** Structured diagnostic message (§5.1). */
export interface Diagnostic {
  code: string;
  level: "fatal" | "warning" | "info";
  message: string;
  remediation: string;
  context: Record<string, unknown>;
}

/** viz:DataField JSON-LD object (§5.3). */
export interface DataFieldLD {
  "@id": string;
  "@type": "viz:DataField";
  "viz:fieldName": string;
  "viz:hasDataType": { "@id": string };
  "viz:consensusScore": string;
  "sas:consensusNumerator": number;
  "sas:consensusDenominator": number;
  "sas:alignmentRule": string;
  "sas:structuralType": string;
  "viz:numericPrecision"?: "integer" | "float";
  "viz:wasNormalized"?: true;
  "viz:wasPercentage"?: true;
  "sas:fandawsConsulted"?: boolean;
  [key: string]: unknown;
}

/** viz:DatasetSchema JSON-LD object (§5.2). */
export interface DatasetSchemaLD {
  "@context": Record<string, string>;
  "@type": "viz:DatasetSchema";
  "viz:rawInputHash": string;
  "viz:totalRows": number;
  "viz:rowsInspected"?: number;
  "sas:fandawsAvailable": boolean;
  "sas:alignmentMode": "standalone" | "enriched";
  "viz:hasField": DataFieldLD[];
}

/** Primary output of the align() function (§5.1). */
export interface SASResult {
  status: "ok" | "error";
  schema?: DatasetSchemaLD;
  diagnostics: Diagnostic[];
}

// ---------------------------------------------------------------------------
// SAS Configuration (§7)
// ---------------------------------------------------------------------------

/** SAS runtime configuration (§7). */
export interface SASConfig {
  consensusThreshold: number;
  minObservationThreshold: number;
  temporalNamePattern: RegExp;
  booleanFields: Record<string, [string, string]>;
  nullVocabulary: Record<string, string[]>;
  globalNullVocabulary: string[];
}

/** Default configuration matching §7 defaults. */
export const DEFAULT_CONFIG: SASConfig = {
  consensusThreshold: 0.95,
  minObservationThreshold: 5,
  temporalNamePattern:
    /(?:date|time|timestamp|created|updated|modified|born|died|started|ended|expires?)(?:_at|_on|_time)?$/i,
  booleanFields: {},
  nullVocabulary: {},
  globalNullVocabulary: [],
};

/** JSON-LD @context for viz:DatasetSchema output (§5.2). */
export const SAS_CONTEXT: Record<string, string> = {
  fandaws: "https://schema.fnsr.dev/fandaws/v3#",
  prov: "http://www.w3.org/ns/prov#",
  sas: "https://schema.fnsr.dev/sas/v1#",
  viz: "https://schema.fnsr.dev/ecve/v4#",
};

// ---------------------------------------------------------------------------
// Transform (template — preserved for spec test compatibility)
// ---------------------------------------------------------------------------

/**
 * Pure deterministic transformation.
 *
 * Given a JSON-LD input document, produces a JSON-LD output document.
 * This is the identity transform — the template's starting point.
 * Consumers replace the body with their domain-specific transformation logic.
 *
 * The function never throws for any input. Invalid input produces a
 * well-formed JSON-LD error object with a stable error code.
 *
 * @param input - A value expected to be a valid JSON-LD document
 * @returns A new JSON-LD document (never mutates input)
 */
export function transform(input: unknown): TransformOutput | TransformError {
  // -----------------------------------------------------------------------
  // Input validation — return error objects, never throw
  // -----------------------------------------------------------------------

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return makeError("INVALID_INPUT", "Input must be a non-null, non-array object");
  }

  const doc = input as Record<string, unknown>;

  if (!("@context" in doc)) {
    return makeError("INVALID_CONTEXT", "Input must include an @context property");
  }

  // -----------------------------------------------------------------------
  // Identity transform
  //
  // Deep-clone the input to guarantee immutability, then attach provenance.
  // Replace this section with domain-specific transformation rules.
  // Each rule should be named in rulesApplied for traceability.
  // -----------------------------------------------------------------------

  const output = structuredClone(doc) as JsonLdDocument;

  return {
    ...output,
    provenance: {
      "@type": "Provenance",
      kernelVersion: KERNEL_VERSION,
      rulesApplied: ["identity"],
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeError(errorCode: string, message: string): TransformError {
  return {
    "@context": "https://schema.org",
    "@type": "Error",
    errorCode,
    error: message,
    provenance: {
      "@type": "Provenance",
      kernelVersion: KERNEL_VERSION,
      rulesApplied: [],
    },
  };
}

// ---------------------------------------------------------------------------
// SAS Align — Stub (ADR-005, §8)
// ---------------------------------------------------------------------------

/**
 * Align a BIBSS CISM to a viz:DatasetSchema.
 *
 * Synchronous. Returns SASResult directly (not a Promise).
 * Never throws — all errors reported as diagnostics.
 *
 * Phase 0 stub: returns a minimal valid SASResult.
 * Phase 1 tasks 1.1–1.12 flesh out the implementation.
 */
export function align(
  cism: CISMRoot,
  rawHash: string,
  config?: Partial<SASConfig>,
  snpManifest?: ManifestEntry[],
): SASResult {
  // Phase 0 stub — suppress unused parameter warnings
  void config;
  void snpManifest;

  return {
    status: "ok",
    schema: {
      "@context": SAS_CONTEXT,
      "@type": "viz:DatasetSchema",
      "viz:rawInputHash": rawHash,
      "viz:totalRows": cism.root.occurrences,
      "sas:fandawsAvailable": false,
      "sas:alignmentMode": "standalone",
      "viz:hasField": [],
    },
    diagnostics: [],
  };
}
