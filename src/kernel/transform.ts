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

/** The 5 valid viz:DataType IRIs (§5.3, §6.1.1). */
export const VIZ_DATA_TYPES = {
  Quantitative: "viz:QuantitativeType",
  Nominal: "viz:NominalType",
  Temporal: "viz:TemporalType",
  Boolean: "viz:BooleanType",
  Unknown: "viz:UnknownType",
} as const;

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
// SAS Align (ADR-005, §8, §9.1)
// ---------------------------------------------------------------------------

/**
 * Align a BIBSS CISM to a viz:DatasetSchema.
 *
 * Synchronous. Returns SASResult directly (not a Promise).
 * Never throws — all errors reported as diagnostics.
 */
export function align(
  cism: CISMRoot,
  rawHash: string,
  config?: Partial<SASConfig>,
  snpManifest?: ManifestEntry[],
): SASResult {
  try {
    return alignInner(cism, rawHash, config, snpManifest);
  } catch (_err) {
    return {
      status: "error",
      diagnostics: [makeDiag("SAS-007", "fatal",
        "Unexpected error during alignment.",
        "Check CISM input structure and retry.",
        { error: _err instanceof Error ? _err.message : String(_err) },
      )],
    };
  }
}

function alignInner(
  cism: CISMRoot,
  rawHash: string,
  config?: Partial<SASConfig>,
  snpManifest?: ManifestEntry[],
): SASResult {
  const diagnostics: Diagnostic[] = [];

  // --- Config merging (§7) ---
  const merged: SASConfig = { ...DEFAULT_CONFIG, ...config };
  const scaledThreshold = Math.round(
    merged.consensusThreshold * THRESH_SCALE,
  );

  // --- §9.1 step 1: CISM version validation ---
  if (
    !cism.version ||
    compareSemver(cism.version, "1.3") < 0
  ) {
    return {
      status: "error",
      diagnostics: [makeDiag("SAS-007", "fatal",
        `CISM version "${cism.version || ""}" is below the minimum required version 1.3.`,
        "Upgrade BIBSS to v1.3+ to produce typeDistribution data.",
        { version: cism.version || "" },
      )],
    };
  }

  // --- §9.1 step 2: CISM root structure validation ---
  const root = cism.root;
  const rootValid =
    root != null &&
    (root.kind === "object" ||
      (root.kind === "array" &&
        root.itemType?.kind === "object"));

  if (!rootValid) {
    return {
      status: "error",
      diagnostics: [makeDiag("SAS-013", "fatal",
        "CISM root node must be kind 'object' or kind 'array' with an object itemType.",
        "Check BIBSS output — the root node structure is invalid for SAS processing.",
        { kind: root?.kind ?? "undefined" },
      )],
    };
  }

  // --- §9.1 step 3: Root property extraction ---
  const properties: SchemaEdge[] =
    root.kind === "object"
      ? (root.properties ?? [])
      : (root.itemType!.properties ?? []);

  // --- §5.2: Schema-level metadata ---
  // For array root, totalRows = itemType.occurrences (row count, not the array node's 1)
  const rowNode = root.kind === "object" ? root : root.itemType!;
  const totalRows = cism.sampling?.applied
    ? cism.sampling.inputSize
    : rowNode.occurrences;

  const schema: DatasetSchemaLD = {
    "@context": SAS_CONTEXT,
    "@type": "viz:DatasetSchema",
    "viz:rawInputHash": rawHash,
    "viz:totalRows": totalRows,
    "sas:fandawsAvailable": false,
    "sas:alignmentMode": "standalone",
    "viz:hasField": [],
  };

  if (cism.sampling?.applied) {
    schema["viz:rowsInspected"] = cism.sampling.sampleSize;
  }

  // --- §9.1 step 4: Per-field processing (cascade, §9.1 steps 4–5) ---
  const slugSeen = new Map<string, number>();

  for (const edge of properties) {
    const fieldName = edge.name;
    const node = edge.target;

    // Step 1: Skip non-primitives (§9.2) — object/array → SAS-003
    if (shouldSkipField(node, fieldName, diagnostics)) continue;

    const primitiveType = node.primitiveType ?? "unknown";
    let result: ConsensusResult;

    // Step 1b: Union / all-null → unknown assignment (§6.6)
    const unknownResult = unknownAssignment(node, fieldName, diagnostics);
    if (unknownResult) {
      result = unknownResult;
    } else {
      // Step 2: CISM consistency validation (§6.1.3)
      const validation = validateSchemaNode(node, fieldName, diagnostics);
      if (!validation.valid) {
        result = {
          dataType: VIZ_DATA_TYPES.Unknown,
          consensusScore: "0.000000",
          consensusNumerator: 0,
          consensusDenominator: 0,
          ruleName: "cism-validation-failed",
        };
      } else {
        const dist = node.typeDistribution ?? {};

        // Step 3: Null vocabulary adjustment (§6.4)
        const nullVocab = nullVocabularyReclassification(
          dist, node.occurrences, fieldName,
          merged.nullVocabulary, merged.globalNullVocabulary,
        );
        const effectiveDist = nullVocab.adjusted
          ? nullVocab.typeDistribution
          : dist;
        const effectiveNullCount = effectiveDist["null"] ?? 0;
        const effectiveNonNull = node.occurrences - effectiveNullCount;

        // Step 4/7: Consensus promotion or structural passthrough
        const hasTypedValues = Object.entries(effectiveDist).some(
          ([k, v]) => k !== "null" && v > 0,
        );

        if (hasTypedValues) {
          result = consensusPromotion(
            effectiveDist, effectiveNonNull, fieldName,
            scaledThreshold, merged.minObservationThreshold, diagnostics,
          );
        } else {
          // Step 7: Structural passthrough / Unknown (§6.5, §6.6)
          result = effectiveNonNull > 0
            ? structuralPassthrough(primitiveType, effectiveNonNull)
            : {
                dataType: VIZ_DATA_TYPES.Unknown,
                consensusScore: "0.000000",
                consensusNumerator: 0,
                consensusDenominator: 0,
                ruleName: "structural-passthrough",
              };
        }

        // SAS-008: Null vocab changed consensus winner?
        if (nullVocab.adjusted && hasTypedValues) {
          const origResult = consensusPromotion(
            dist, validation.nonNullTotal, fieldName,
            scaledThreshold, merged.minObservationThreshold, [],
          );
          if (origResult.dataType !== result.dataType) {
            diagnostics.push(makeDiag("SAS-008", "info",
              `Field "${fieldName}": null vocabulary reclassification changed consensus from ${origResult.dataType} to ${result.dataType}.`,
              "Null vocabulary improved type detection.",
              { field: fieldName, beforeType: origResult.dataType, afterType: result.dataType, reclassifiedCount: nullVocab.reclassifiedCount },
            ));
            result = { ...result, ruleName: "null-vocabulary-configured" };
          }
        }

        // Step 5: Temporal detection (§6.2) — only if NominalType
        const temporalOverride = temporalDetection(
          result.dataType, fieldName, primitiveType,
          merged.temporalNamePattern, snpManifest, diagnostics,
        );
        if (temporalOverride) {
          result = {
            ...result,
            dataType: temporalOverride.dataType,
            ruleName: temporalOverride.ruleName,
            numericPrecision: undefined,
          };
        }

        // Step 6: Boolean pair detection (§6.3) — only if still NominalType
        const booleanOverride = booleanPairDetection(
          result.dataType, fieldName, primitiveType, merged.booleanFields,
        );
        if (booleanOverride) {
          result = {
            ...result,
            dataType: booleanOverride.dataType,
            ruleName: booleanOverride.ruleName,
            numericPrecision: undefined,
          };
        }
      }
    }

    // Step 8: SNP manifest annotations (§4.2)
    const annotations = snpAnnotations(fieldName, snpManifest);

    // Step 9: Build DataFieldLD (§5.3)
    const fieldId = assignFieldId(fieldName, slugSeen);
    const field: DataFieldLD = {
      "@id": fieldId,
      "@type": "viz:DataField",
      "viz:fieldName": fieldName,
      "viz:hasDataType": { "@id": result.dataType },
      "viz:consensusScore": result.consensusScore,
      "sas:consensusNumerator": result.consensusNumerator,
      "sas:consensusDenominator": result.consensusDenominator,
      "sas:alignmentRule": result.ruleName,
      "sas:structuralType": primitiveType,
      "sas:fandawsConsulted": false,
    };
    if (result.numericPrecision) {
      field["viz:numericPrecision"] = result.numericPrecision;
    }
    if (annotations?.wasNormalized) field["viz:wasNormalized"] = true;
    if (annotations?.wasPercentage) field["viz:wasPercentage"] = true;

    schema["viz:hasField"].push(field);
  }

  return { status: "ok", schema, diagnostics };
}

/** Create a Diagnostic object (§5.1). */
function makeDiag(
  code: string,
  level: "fatal" | "warning" | "info",
  message: string,
  remediation: string,
  context: Record<string, unknown>,
): Diagnostic {
  return { code, level, message, remediation, context };
}

/**
 * Compare two semver-like version strings (major.minor.patch).
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * Format consensus score as 6-decimal string (§2.6).
 * denominator === 0 → "0.000000".
 */
function formatScore(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.000000";
  return (numerator / denominator).toFixed(6);
}

/** Result of CISM consistency validation (§6.1.3). */
interface ValidationResult {
  valid: boolean;
  nullCount: number;
  nonNullTotal: number;
  typeDistributionSum: number;
}

/**
 * Validate SchemaNode consistency before consensus (§6.1.3).
 *
 * Returns validation result with computed counts.
 * If invalid, caller should assign UnknownType and emit SAS-013.
 */
function validateSchemaNode(
  node: SchemaNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): ValidationResult {
  const occ = node.occurrences;
  const dist = node.typeDistribution ?? {};
  const nullCount = dist["null"] ?? 0;
  const distSum = Object.values(dist).reduce((a, b) => a + b, 0);
  const nonNullTotal = occ - nullCount;

  // Check occurrences >= 0
  if (occ < 0) {
    diagnostics.push(makeDiag("SAS-013", "fatal",
      `Field "${fieldName}" has negative occurrences (${occ}).`,
      "BIBSS produced invalid counts for this field. Check BIBSS version and configuration.",
      { field: fieldName, reason: "negative occurrences", occurrences: occ, typeDistributionSum: distSum },
    ));
    return { valid: false, nullCount, nonNullTotal, typeDistributionSum: distSum };
  }

  // Check sum(typeDistribution) <= occurrences
  if (distSum > occ) {
    diagnostics.push(makeDiag("SAS-013", "fatal",
      `Field "${fieldName}" typeDistribution sum (${distSum}) exceeds occurrences (${occ}).`,
      "BIBSS produced invalid counts for this field. Check BIBSS version and configuration.",
      { field: fieldName, reason: "typeDistribution sum exceeds occurrences", occurrences: occ, typeDistributionSum: distSum },
    ));
    return { valid: false, nullCount, nonNullTotal, typeDistributionSum: distSum };
  }

  // Check nullCount <= occurrences
  if (nullCount > occ) {
    diagnostics.push(makeDiag("SAS-013", "fatal",
      `Field "${fieldName}" null count (${nullCount}) exceeds occurrences (${occ}).`,
      "BIBSS produced invalid counts for this field. Check BIBSS version and configuration.",
      { field: fieldName, reason: "null count exceeds occurrences", occurrences: occ, typeDistributionSum: distSum },
    ));
    return { valid: false, nullCount, nonNullTotal, typeDistributionSum: distSum };
  }

  // Verify nonNullTotal >= 0 (by construction, but explicit)
  if (nonNullTotal < 0) {
    diagnostics.push(makeDiag("SAS-013", "fatal",
      `Field "${fieldName}" has negative nonNullTotal (${nonNullTotal}).`,
      "BIBSS produced invalid counts for this field. Check BIBSS version and configuration.",
      { field: fieldName, reason: "negative nonNullTotal", occurrences: occ, typeDistributionSum: distSum },
    ));
    return { valid: false, nullCount, nonNullTotal, typeDistributionSum: distSum };
  }

  return { valid: true, nullCount, nonNullTotal, typeDistributionSum: distSum };
}

/** Result of consensus promotion (§6.1). */
interface ConsensusResult {
  dataType: string;
  consensusScore: string;
  consensusNumerator: number;
  consensusDenominator: number;
  ruleName: string;
  numericPrecision?: "integer" | "float";
}

/** Recognized typeDistribution keys (§6.1.2). */
const RECOGNIZED_DIST_KEYS = new Set([
  "integer", "number", "string", "boolean", "boolean-encoded-string", "null",
]);

/** Widening lattice rank for tie-breaking (ADR-006). Higher = wider. */
const WIDENING_LATTICE: Record<string, number> = {
  "string": 5,
  "number": 4,
  "integer": 3,
  "boolean": 2,
  "boolean-encoded-string": 1,
};

/** Maps typeDistribution keys to viz:DataType and optional precision (§6.1.1). */
const TYPE_MAP: Record<string, { dataType: string; precision?: "integer" | "float" }> = {
  "integer": { dataType: VIZ_DATA_TYPES.Quantitative, precision: "integer" },
  "number": { dataType: VIZ_DATA_TYPES.Quantitative, precision: "float" },
  "boolean": { dataType: VIZ_DATA_TYPES.Boolean },
  "boolean-encoded-string": { dataType: VIZ_DATA_TYPES.Boolean },
  "string": { dataType: VIZ_DATA_TYPES.Nominal },
  "null": { dataType: VIZ_DATA_TYPES.Unknown },
};

/**
 * Consensus promotion algorithm (§6.1, §6.1.1, §6.1.2, ADR-006).
 *
 * Accepts (possibly adjusted) typeDistribution and nonNullTotal — not the
 * raw SchemaNode — so null vocabulary (task 1.9) can modify counts first.
 *
 * Pure function. Appends diagnostics to the provided array.
 */
function consensusPromotion(
  typeDistribution: Record<string, number>,
  nonNullTotal: number,
  fieldName: string,
  scaledThreshold: number,
  minObservationThreshold: number,
  diagnostics: Diagnostic[],
): ConsensusResult {
  // --- Fold unrecognized keys into "string" (§6.1.2) ---
  const adjusted: Record<string, number> = {};
  for (const [key, count] of Object.entries(typeDistribution)) {
    if (key === "null") continue; // null excluded from consensus candidates
    if (!RECOGNIZED_DIST_KEYS.has(key)) {
      diagnostics.push(makeDiag("SAS-014", "warning",
        `Field "${fieldName}" has unrecognized typeDistribution key "${key}". Treating as "string".`,
        "This may indicate a newer BIBSS version. Update SAS if this key should be handled differently.",
        { field: fieldName, unknownKey: key },
      ));
      adjusted["string"] = (adjusted["string"] ?? 0) + count;
    } else {
      adjusted[key] = (adjusted[key] ?? 0) + count;
    }
  }

  // --- Observation threshold check (§6.1) ---
  if (nonNullTotal < minObservationThreshold) {
    diagnostics.push(makeDiag("SAS-012", "warning",
      `Field "${fieldName}" has insufficient non-null observations (${nonNullTotal}) for consensus. Minimum required: ${minObservationThreshold}.`,
      "Increase sample size or lower minObservationThreshold if this field is expected to have few values.",
      { field: fieldName, nonNullTotal, minObservationThreshold },
    ));
    return {
      dataType: VIZ_DATA_TYPES.Unknown,
      consensusScore: "0.000000",
      consensusNumerator: 0,
      consensusDenominator: nonNullTotal,
      ruleName: "consensus-promotion",
    };
  }

  // --- Integer threshold check for each candidate type (§6.1) ---
  const passing: { key: string; count: number }[] = [];
  let highestCount = 0;
  let highestKey = "";

  for (const [key, count] of Object.entries(adjusted)) {
    // Track overall highest for no-consensus fallback
    if (
      count > highestCount ||
      (count === highestCount &&
        (WIDENING_LATTICE[key] ?? 0) > (WIDENING_LATTICE[highestKey] ?? 0))
    ) {
      highestCount = count;
      highestKey = key;
    }
    // Integer threshold: count * THRESH_SCALE >= scaledThreshold * nonNullTotal
    if (count * THRESH_SCALE >= scaledThreshold * nonNullTotal) {
      passing.push({ key, count });
    }
  }

  // --- Winner selection (§6.1, ADR-006) ---
  if (passing.length > 0) {
    // Sort: count descending, then widening lattice descending for tie-break
    passing.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (WIDENING_LATTICE[b.key] ?? 0) - (WIDENING_LATTICE[a.key] ?? 0);
    });
    const winner = passing[0];
    const mapping = TYPE_MAP[winner.key] ?? TYPE_MAP["string"];
    return {
      dataType: mapping.dataType,
      consensusScore: formatScore(winner.count, nonNullTotal),
      consensusNumerator: winner.count,
      consensusDenominator: nonNullTotal,
      ruleName: "consensus-promotion",
      numericPrecision: mapping.precision,
    };
  }

  // --- No-consensus fallback → NominalType, SAS-001 (§6.1) ---
  const highestRatio = formatScore(highestCount, nonNullTotal);
  diagnostics.push(makeDiag("SAS-001", "warning",
    `Field "${fieldName}" has no type consensus above threshold. Highest: "${highestKey}" at ${highestRatio}.`,
    "Consider adjusting consensusThreshold or inspecting the data for mixed-type issues.",
    { field: fieldName, highestConsensus: highestRatio, highestType: highestKey },
  ));
  return {
    dataType: VIZ_DATA_TYPES.Nominal,
    consensusScore: highestRatio,
    consensusNumerator: highestCount,
    consensusDenominator: nonNullTotal,
    ruleName: "consensus-promotion",
  };
}

/** Result of a post-consensus rule override (temporal, boolean pair). */
interface RuleOverride {
  dataType: string;
  ruleName: string;
}

/**
 * Temporal detection (§6.2).
 *
 * Applies only when currentType is NominalType. Checks SNP evidence first,
 * then name-based heuristic. Returns override or null if no match.
 */
function temporalDetection(
  currentType: string,
  fieldName: string,
  primitiveType: string,
  temporalNamePattern: RegExp,
  snpManifest: ManifestEntry[] | undefined,
  diagnostics: Diagnostic[],
): RuleOverride | null {
  // Only applies to NominalType fields
  if (currentType !== VIZ_DATA_TYPES.Nominal) return null;

  // --- SNP evidence path (ADR-007) ---
  if (snpManifest) {
    for (const entry of snpManifest) {
      if (entry.path === fieldName && entry.detail?.type === "date_converted") {
        diagnostics.push(makeDiag("SAS-009", "info",
          `Field "${fieldName}" identified as temporal via SNP manifest evidence.`,
          "SNP date normalization was applied to this field.",
          { field: fieldName },
        ));
        return {
          dataType: VIZ_DATA_TYPES.Temporal,
          ruleName: "temporal-detection-snp-evidence",
        };
      }
    }
  }

  // --- Name-based heuristic (§6.2) ---
  if (primitiveType === "string" && temporalNamePattern.test(fieldName)) {
    diagnostics.push(makeDiag("SAS-010", "info",
      `Field "${fieldName}" identified as temporal via name pattern match.`,
      "Field name matches the configured temporal name pattern.",
      { field: fieldName, matchedPattern: temporalNamePattern.source },
    ));
    return {
      dataType: VIZ_DATA_TYPES.Temporal,
      ruleName: "temporal-detection",
    };
  }

  return null;
}

/**
 * Boolean pair detection — configured (§6.3).
 *
 * Applies after temporal detection, only to string-typed NominalType fields.
 * Checks config.booleanFields for a case-insensitive field name match.
 */
function booleanPairDetection(
  currentType: string,
  fieldName: string,
  primitiveType: string,
  booleanFields: Record<string, [string, string]>,
): RuleOverride | null {
  if (currentType !== VIZ_DATA_TYPES.Nominal) return null;
  if (primitiveType !== "string") return null;

  const lowerName = fieldName.toLowerCase();
  for (const key of Object.keys(booleanFields)) {
    if (key.toLowerCase() === lowerName) {
      return {
        dataType: VIZ_DATA_TYPES.Boolean,
        ruleName: "boolean-pair-configured",
      };
    }
  }

  return null;
}

/** Result of null vocabulary reclassification (§6.4). */
interface NullVocabResult {
  adjusted: boolean;
  typeDistribution: Record<string, number>;
  reclassifiedCount: number;
}

/**
 * Null vocabulary reclassification (§6.4, §9.3).
 *
 * Pre-processing step: adjusts typeDistribution counts BEFORE consensus.
 * Moves string counts to null when null vocabulary is configured.
 * Returns an adjusted copy — never mutates the input.
 *
 * SAS-008 detection (before/after consensus comparison) is the cascade's
 * responsibility (task 1.12), not this function's.
 */
function nullVocabularyReclassification(
  typeDistribution: Record<string, number>,
  occurrences: number,
  fieldName: string,
  nullVocabulary: Record<string, string[]>,
  globalNullVocabulary: string[],
): NullVocabResult {
  // --- Combine field-specific and global vocabulary ---
  const lowerName = fieldName.toLowerCase();
  let fieldVocab: string[] = [];
  for (const key of Object.keys(nullVocabulary)) {
    if (key.toLowerCase() === lowerName) {
      fieldVocab = nullVocabulary[key];
      break;
    }
  }

  // Deduplicate combined vocab (case-insensitive, trimmed)
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const v of [...fieldVocab, ...globalNullVocabulary]) {
    const normalized = v.trim().toLowerCase();
    if (normalized !== "" && !seen.has(normalized)) {
      seen.add(normalized);
      combined.push(normalized);
    }
  }

  // No vocabulary configured → no adjustment
  if (combined.length === 0) {
    return { adjusted: false, typeDistribution, reclassifiedCount: 0 };
  }

  const stringCount = typeDistribution["string"] ?? 0;

  // No strings to reclassify → no adjustment
  if (stringCount === 0) {
    return { adjusted: false, typeDistribution, reclassifiedCount: 0 };
  }

  // Reclassify all strings as null (§9.3: SAS has no value-level data,
  // trusts caller configuration). Capped at actual string count.
  const reclassifiedCount = stringCount;
  const adjusted: Record<string, number> = { ...typeDistribution };
  adjusted["string"] = 0;
  adjusted["null"] = (adjusted["null"] ?? 0) + reclassifiedCount;

  // Suppress unused — occurrences available for future validation
  void occurrences;

  return { adjusted: true, typeDistribution: adjusted, reclassifiedCount };
}

/**
 * Check if a field should be skipped (§9.2).
 *
 * Nested object/array fields are not mapped to viz:DataField.
 * Emits SAS-003 for skipped fields. Returns true if skipped.
 */
function shouldSkipField(
  node: SchemaNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): boolean {
  if (node.kind === "object" || node.kind === "array") {
    diagnostics.push(makeDiag("SAS-003", "info",
      `Field "${fieldName}" is a nested ${node.kind} structure. Skipped in v2.0.`,
      "Flatten nested data before pipeline ingestion.",
      { field: fieldName, kind: node.kind },
    ));
    return true;
  }
  return false;
}

/**
 * Unknown assignment (§6.6).
 *
 * Applies when primitiveType is "null" (all values null) or node kind is
 * "union". Returns a ConsensusResult with UnknownType, or null if not applicable.
 */
function unknownAssignment(
  node: SchemaNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): ConsensusResult | null {
  if (node.kind === "union") {
    diagnostics.push(makeDiag("SAS-002", "info",
      `Field "${fieldName}" has union kind. Assigned UnknownType.`,
      "Field contains no typed data. Verify data source.",
      { field: fieldName, reason: "union" },
    ));
    return {
      dataType: VIZ_DATA_TYPES.Unknown,
      consensusScore: "0.000000",
      consensusNumerator: 0,
      consensusDenominator: 0,
      ruleName: "unknown-assignment",
    };
  }

  if (node.primitiveType === "null") {
    diagnostics.push(makeDiag("SAS-002", "info",
      `Field "${fieldName}" is all null. Assigned UnknownType.`,
      "Field contains no typed data. Verify data source.",
      { field: fieldName, reason: "all-null" },
    ));
    return {
      dataType: VIZ_DATA_TYPES.Unknown,
      consensusScore: "0.000000",
      consensusNumerator: 0,
      consensusDenominator: 0,
      ruleName: "unknown-assignment",
    };
  }

  return null;
}

/**
 * Structural passthrough (§6.5).
 *
 * Fallback: maps BIBSS primitiveType directly via §6.1.1 table.
 * Used when no higher-priority rule assigned a type.
 */
function structuralPassthrough(
  primitiveType: string,
  nonNullTotal: number,
): ConsensusResult {
  const mapping = TYPE_MAP[primitiveType] ?? TYPE_MAP["string"];
  return {
    dataType: mapping.dataType,
    consensusScore: formatScore(nonNullTotal, nonNullTotal),
    consensusNumerator: nonNullTotal,
    consensusDenominator: nonNullTotal,
    ruleName: "structural-passthrough",
    numericPrecision: mapping.precision,
  };
}

/** SNP manifest annotation flags for a single field (§4.2, §5.3). */
interface SnpAnnotations {
  wasNormalized?: true;
  wasPercentage?: true;
}

/**
 * Extract SNP manifest annotations for a field (§4.2, §5.3, ADR-007).
 *
 * Scans the manifest for entries matching `path === fieldName` (exact match).
 * - `detail.type === "currency_stripped"` → wasNormalized: true
 * - `detail.type === "percent_stripped"` → wasPercentage: true
 * - `detail.type === "currency_stripped"` AND originalValue contains "%" → wasPercentage: true
 *
 * Returns undefined if no annotations apply (properties omitted per §2.6).
 */
function snpAnnotations(
  fieldName: string,
  snpManifest: ManifestEntry[] | undefined,
): SnpAnnotations | undefined {
  if (!snpManifest) return undefined;

  let wasNormalized = false;
  let wasPercentage = false;

  for (const entry of snpManifest) {
    if (entry.path !== fieldName) continue;
    const detailType = entry.detail?.type;

    if (detailType === "currency_stripped") {
      wasNormalized = true;
      // Check if originalValue contains "%" (currency+percentage combo)
      if (
        typeof entry.detail?.originalValue === "string" &&
        entry.detail.originalValue.includes("%")
      ) {
        wasPercentage = true;
      }
    }

    if (detailType === "percent_stripped") {
      wasPercentage = true;
    }
  }

  if (!wasNormalized && !wasPercentage) return undefined;

  const result: SnpAnnotations = {};
  if (wasNormalized) result.wasNormalized = true;
  if (wasPercentage) result.wasPercentage = true;
  return result;
}

/**
 * Deterministic field slug algorithm (§5.5).
 *
 * 1. Unicode NFC normalization
 * 2. Lowercase
 * 3. Replace non-[a-z0-9] with hyphen
 * 4. Collapse consecutive hyphens
 * 5. Trim leading/trailing hyphens
 * 6. Empty → "field"
 */
export function normalizeFieldName(name: string): string {
  let slug = name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  if (slug === "") slug = "field";
  return slug;
}

/**
 * Assign a unique `@id` for a field, resolving collisions (§5.5).
 *
 * Tracks seen slugs via the provided Map. First occurrence keeps
 * the bare slug; subsequent duplicates get `-1`, `-2`, etc.
 *
 * @returns `viz:field/{slug}` or `viz:field/{slug}-{n}`
 */
export function assignFieldId(
  name: string,
  seen: Map<string, number>,
): string {
  const slug = normalizeFieldName(name);
  const count = seen.get(slug) ?? 0;
  seen.set(slug, count + 1);
  const suffix = count === 0 ? "" : `-${count}`;
  return `viz:field/${slug}${suffix}`;
}
