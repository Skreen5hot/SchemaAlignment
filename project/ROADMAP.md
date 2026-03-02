# Roadmap

<!--
  This is your project's north star. Structure work into phases with
  explicit scope boundaries. AI agents read this at session start to
  understand what to work on and — critically — what NOT to touch.

  Authoritative spec: project/sas-v2.0.md
  Decisions log: project/DECISIONS.md (ADR-001 through ADR-008)
-->

## Phase 0: Repository Adaptation

**Goal:** Transform the generic JSON-LD Deterministic Service Template into the SAS project scaffold. Update project identity, commit foundation documents, scaffold the `align()` API surface alongside the existing `transform()`, and verify a green baseline — all without breaking existing spec tests.

**Status:** Complete

---

### 0.1 Update Project Identity

**Status:** Complete | **Priority:** High

Update repository metadata to reflect the Schema Alignment Service instead of the generic template.

**Acceptance Criteria:**

- [x] `package.json` `name` → `"schema-alignment-service"`
- [x] `package.json` `description` → `"Schema Alignment Service — deterministic CISM-to-viz:DatasetSchema transformation"`
- [x] `package.json` `keywords` → replace template keywords with: `schema-alignment`, `cism`, `bibss`, `viz`, `json-ld`, `deterministic`
- [x] `npm run build` compiles without errors
- [x] `npm test` passes (no behavioral changes)

---

### 0.2 Scaffold `align()` Stub and SAS Type Shells

**Status:** Complete | **Priority:** High | **Spec:** ADR-003, ADR-005, §4.1, §5.1, §8

Create the `align()` function signature and minimal type interface stubs alongside the existing `transform()`. This gives Phase 1 tasks (1.1–1.3) a starting point to flesh out without breaking existing spec tests.

> **Design note:** The existing `transform()` function and its types (`JsonLdDocument`, `Provenance`, `TransformOutput`, `TransformError`) remain **unchanged** in Phase 0. The spec tests continue to call `transform()` and pass. Phase 1 task 1.14 updates the spec tests to call `align()` directly and removes the `transform()` wrapper. Until then, the two APIs coexist.

**Acceptance Criteria:**

- [x] Minimal type interface stubs defined in `src/kernel/transform.ts`: `CISMRoot`, `SchemaNode`, `SchemaEdge`, `InferConfig`, `ManifestEntry`, `SASResult`, `SASConfig`, `Diagnostic`, `DatasetSchemaLD`, `DataFieldLD`
- [x] Type stubs contain all required fields but use broad types where detailed types aren't needed yet (e.g., `typeDistribution?: Record<string, number>`)
- [x] `align()` function exported with correct Phase 1 signature: `align(cism: CISMRoot, rawHash: string, config?: Partial<SASConfig>, snpManifest?: ManifestEntry[]): SASResult`
- [x] `align()` stub body returns a minimal valid `SASResult`: `{ status: "ok", schema: { /* minimal valid DatasetSchemaLD */ }, diagnostics: [] }` — just enough for type checking and to establish the function shape
- [x] Existing `transform()` function and all its types remain **unchanged** — spec tests continue to pass
- [x] `DEFAULT_CONFIG` constant stub defined with the 6 fields from §7 (values matching spec defaults)
- [x] `THRESH_SCALE` constant defined as `1_000_000`
- [x] `npm run build` compiles without errors
- [x] `npm test` passes (spec tests unmodified, still exercise `transform()`)
- [x] `npm run test:purity` passes

---

### 0.3 Authorize Spec Test Adaptation

**Status:** Complete | **Priority:** Medium | **Spec:** ADR-005, ADR-008

CLAUDE.md §4 prohibits modifying spec tests. However, ADR-005 requires updating them to call `align()` instead of `transform()`. Add a scoped exception via ADR-008 and amend CLAUDE.md.

**Acceptance Criteria:**

- [x] ADR-008 created in `project/DECISIONS.md`: "Spec Test Adaptation Authorized for Template-to-SAS Migration"
  - Scope: imports and function calls updated from `transform()` to `align()`, input fixtures updated from JSON-LD `Thing` to CISM
  - Constraint: test **semantics** (determinism, no-network, snapshot properties) MUST NOT change — only the API surface and fixture data change
  - Trigger: authorized for Phase 1 task 1.14 only
- [x] CLAUDE.md §4 amended with a narrowly scoped exception referencing ADR-008
- [x] `npm run build` compiles without errors

---

### 0.4 Commit Foundation Documents

**Status:** Complete | **Priority:** High

Stage all planning and scaffolding artifacts. Requires Orchestrator approval before commit.

**Acceptance Criteria:**

- [x] `project/sas-v2.0.md` tracked in git (new file)
- [x] `project/SPEC.md` deletion staged
- [x] `project/DECISIONS.md` (ADR-001 through ADR-008) staged
- [x] `project/ROADMAP.md` (Phases 0–4) staged
- [x] `CLAUDE.md` updates staged
- [x] `package.json` identity changes staged
- [x] `src/kernel/transform.ts` (align stub + type shells) staged
- [x] Clean commit with descriptive message — `7bc2aa9`
- [x] **Orchestrator approval obtained before executing commit**

---

### 0.5 Verify Green Baseline

**Status:** Complete | **Priority:** High

Confirm all checks pass before Phase 1 begins. This establishes the known-good starting point.

**Acceptance Criteria:**

- [x] `npm run build` — zero TypeScript errors
- [x] `npm test` — all 3 spec tests pass (determinism, no-network, snapshot)
- [x] `npm run test:purity` — kernel isolation verified
- [x] `git status` — working directory clean (all Phase 0 changes committed)
- [x] `git log` — Phase 0 commit visible: `7bc2aa9`

---

**Phase 0 does NOT:**
- Modify existing spec tests (that's Phase 1 task 1.14)
- Replace example fixtures (that's Phase 1 task 1.14)
- Remove the `transform()` function (that's Phase 1 task 1.14)
- Implement any SAS domain logic (that's Phase 1 tasks 1.1–1.12)
- Add runtime dependencies

---

## Phase 1: Static Core (Standalone Mode)

**Goal:** Replace the template's identity transform with the SAS v2.0 static rule cascade. Produce a working `align()` function that accepts a CISM and returns a `viz:DatasetSchema` JSON-LD graph — without Fandaws enrichment.

**Spec:** [sas-v2.0.md](./sas-v2.0.md)

**Status:** Complete

---

### 1.1 Define Input Types

**Status:** Complete | **Priority:** High | **Spec:** §4.1, §4.2, §4.4

Define all TypeScript interfaces for the inputs SAS consumes.

**Acceptance Criteria:**

- [x] `CISMRoot` interface defined per §4.1 with fields: `version`, `generatedAt`, `config`, `root`, `sampling?`
- [x] `SchemaNode` interface defined with fields: `kind` (`"object"` | `"array"` | `"primitive"` | `"union"`), `primitiveType?`, `typeDistribution?`, `occurrences`, `nullable?`, `id?`, `properties?` (for object kind), `itemType?` (for array kind)
- [x] `SchemaEdge` interface defined with fields: `name`, `target` (SchemaNode), `required?`, `occurrences?`, `totalPopulation?`
- [x] `InferConfig` defined as opaque record (SAS does not inspect it, just passes through)
- [x] `ManifestEntry` interface defined per §4.2 with fields: `rule`, `path`, `detail?` — where `detail` includes at minimum `type?: string` and `originalValue?: string` (see ADR-007)
- [x] All types exported from `src/kernel/transform.ts`
- [x] `npm run build` compiles without errors

---

### 1.2 Define Output Types and Constants

**Status:** Complete | **Priority:** High | **Spec:** §5.1, §5.2, §5.3, §7, §10

Define all TypeScript interfaces for the outputs SAS produces, the configuration surface, and the diagnostic codes.

**Acceptance Criteria:**

- [x] `SASResult` interface: `status` (`"ok"` | `"error"`), `schema?` (DatasetSchemaLD), `diagnostics` (Diagnostic[]) — §5.1
- [x] `Diagnostic` interface: `code`, `level` (`"fatal"` | `"warning"` | `"info"`), `message`, `remediation`, `context` (Record<string, unknown>) — §5.1
- [x] `DatasetSchemaLD` interface with required fields: `@context`, `@type`, `viz:rawInputHash`, `viz:totalRows`, `viz:hasField` and conditional: `viz:rowsInspected`, `sas:fandawsAvailable`, `sas:alignmentMode` — §5.2
- [x] `DataFieldLD` interface with 9 required properties (`@id`, `@type`, `viz:fieldName`, `viz:hasDataType`, `viz:consensusScore`, `sas:consensusNumerator`, `sas:consensusDenominator`, `sas:alignmentRule`, `sas:structuralType`) and conditional properties (`viz:numericPrecision`, `viz:wasNormalized`, `viz:wasPercentage`, `sas:fandawsConsulted`) — §5.3
- [x] `SASConfig` interface with all 6 fields per §7: `consensusThreshold`, `minObservationThreshold`, `temporalNamePattern`, `booleanFields`, `nullVocabulary`, `globalNullVocabulary`
- [x] `DEFAULT_CONFIG` constant matching §7 defaults exactly: `consensusThreshold: 0.95`, `minObservationThreshold: 5`, temporal regex as specified, empty maps/arrays
- [x] `@context` constant object with exact namespace IRIs: `viz`, `sas`, `fandaws`, `prov` — §5.2
- [x] Enumeration of the 5 valid `viz:DataType` values: `viz:QuantitativeType`, `viz:NominalType`, `viz:TemporalType`, `viz:BooleanType`, `viz:UnknownType` — §5.3
- [x] `THRESH_SCALE` constant = `1_000_000` — §6.1
- [x] All types exported from `src/kernel/transform.ts`
- [x] `npm run build` compiles without errors

---

### 1.3 Implement `align()` Entry Point and Input Validation

**Status:** Complete | **Priority:** High | **Spec:** §8, §9.1 steps 1–3, §5.2

Implement the `align()` function signature, config merging, and the two schema-level validation gates.

**Acceptance Criteria:**

- [x] `align(cism, rawHash, config?, snpManifest?)` function exported — §8 (omit `fandaws` parameter until Phase 1v2)
- [x] `align()` is synchronous — returns `SASResult` directly, not a `Promise` — §8
- [x] `align()` **never throws** for any input — all errors returned as diagnostics — §5.1
- [x] Config merging: `Partial<SASConfig>` merged with `DEFAULT_CONFIG`; missing fields get defaults — §7
- [x] `scaledThreshold` computed once: `Math.round(config.consensusThreshold * THRESH_SCALE)` — §6.1
- [x] **CISM version validation (§9.1 step 1):** If `cism.version` is missing or less than `"1.3"` (semver string comparison), return `{ status: "error", diagnostics: [SAS-007] }` with no `schema` — §10 SAS-007
- [x] **CISM root structure validation (§9.1 step 2):** Root node must be `kind: "object"` or `kind: "array"` with an `itemType` of `kind: "object"`. If invalid, return `{ status: "error", diagnostics: [SAS-013 at schema level] }` with no `schema`
- [x] **Root property extraction (§9.1 step 3):** For `kind: "object"` root, use `root.properties`. For `kind: "array"` root, use `root.itemType.properties`. Store as `SchemaEdge[]` for iteration.
- [x] **Schema-level metadata assembly (§5.2):**
  - `viz:rawInputHash` = `rawHash` parameter
  - `viz:totalRows` = root array node's `occurrences`, or `cism.sampling.inputSize` if sampling applied
  - `viz:rowsInspected` = `cism.sampling.sampleSize` if `sampling.applied === true`, else equals `viz:totalRows`, else omitted
  - `sas:fandawsAvailable` = `false` (Phase 1, no Fandaws)
  - `sas:alignmentMode` = `"standalone"` (Phase 1)
- [x] Template's existing `transform()` function removed or replaced — *Note: `transform()` preserved until task 1.14 removes it (spec tests still depend on it); `align()` is the real implementation*
- [x] `npm run build` compiles without errors

---

### 1.4 Implement `normalizeFieldName` and Field IRI Generation

**Status:** Complete | **Priority:** High | **Spec:** §5.5

Implement the deterministic field slug algorithm and collision resolution.

**Acceptance Criteria:**

- [x] `normalizeFieldName(name: string): string` is a named pure function
- [x] Step 1: Unicode NFC normalization applied (`name.normalize("NFC")`)
- [x] Step 2: Convert to lowercase
- [x] Step 3: Replace any character outside `[a-z0-9]` with hyphen `"-"`
- [x] Step 4: Collapse consecutive hyphens to single hyphen
- [x] Step 5: Trim leading and trailing hyphens
- [x] Step 6: If result is empty, return `"field"`
- [x] Output contains only `[a-z0-9\-]` characters
- [x] **Collision resolution:** Track seen slugs across all fields in a single `align()` call. First field keeps bare slug; second duplicate gets `-1`; third gets `-2`, etc. Collision index is 0-indexed from the second occurrence.
- [x] **`@id` format:** `viz:field/{slug}` (with collision suffix if needed)
- [x] Spec examples produce correct output:
  - `"Revenue"` → `viz:field/revenue`
  - `"First Name"` → `viz:field/first-name`
  - `"first_name"` (after `"First Name"`) → `viz:field/first-name-1`
  - `""` → `viz:field/field`
  - `"日付"` (after `""`) → `viz:field/field-1`
- [x] `npm run build` compiles without errors

---

### 1.5 Implement CISM Consistency Validation

**Status:** Complete | **Priority:** High | **Spec:** §6.1.3

Implement the per-field `SchemaNode` invariant checks that run before consensus.

**Acceptance Criteria:**

- [x] Check `occurrences >= 0` — if negative, emit `SAS-013` (field-level fatal)
- [x] Compute `sum(typeDistribution[*])` — if sum exceeds `occurrences`, emit `SAS-013` (field-level fatal)
- [x] Compute `nullCount = typeDistribution["null"] || 0` — if `nullCount > occurrences`, emit `SAS-013` (field-level fatal)
- [x] Verify `nonNullTotal >= 0` (by construction, but explicit check)
- [x] If any SAS-013 emitted for a field: assign `viz:UnknownType`, skip consensus, continue to next field
- [x] **Field-level fatal does NOT set `status: "error"`** — schema is still emitted, other fields processed normally — §5.1
- [x] SAS-013 diagnostic includes context fields: `field`, `reason`, `occurrences`, `typeDistributionSum` — §10
- [x] `npm run build` compiles without errors

---

### 1.6 Implement Consensus Promotion

**Status:** Complete | **Priority:** High | **Spec:** §6.1, §6.1.1, §6.1.2, §9.3

Implement the core consensus algorithm: integer arithmetic threshold check, type mapping, score formatting.

> **Design note:** This function must accept a (possibly adjusted) `typeDistribution` and `nonNullTotal` — not read them directly from the `SchemaNode`. Task 1.9 (null vocabulary) adjusts counts *before* consensus runs. The consensus function must be callable with either original or adjusted counts. See task 1.12 for the wiring order.

**Acceptance Criteria:**

- [x] **Observation threshold check (§6.1):** If `nonNullTotal < minObservationThreshold`, assign `viz:UnknownType`, emit `SAS-012`, skip consensus. SAS-012 context: `field`, `nonNullTotal`, `minObservationThreshold`.
- [x] **Unrecognized typeDistribution keys (§6.1.2):** Any key not in `["integer", "number", "string", "boolean", "boolean-encoded-string", "null"]` is treated as `"string"` for consensus purposes. Emit `SAS-014` with context: `field`, `unknownKey`.
- [x] **`boolean-encoded-string` forward compatibility (§6.1.1, §6.1.2):** `"boolean-encoded-string"` is a recognized key that maps to `viz:BooleanType` per the §6.1.1 mapping table. It exists for forward compatibility with BIBSS v1.4+ which may detect boolean-encoded string columns. BIBSS v1.3 does not produce this key. It must NOT trigger SAS-014 — it is in the recognized key list.
- [x] **Integer threshold check (§6.1):** For each non-null type `T`: `typeDistribution[T] * THRESH_SCALE >= scaledThreshold * nonNullTotal`. Uses JavaScript `Number` arithmetic (safe for nonNullTotal up to ~9 trillion).
- [x] **Consensus winner selection:** Highest-count non-null type that passes threshold. If multiple types pass threshold with equal counts, apply the widening lattice tie-breaker: prefer the wider type (`string` > `number` > `integer` > `boolean` > `boolean-encoded-string`). This ensures determinism at low thresholds. See ADR-006.
- [x] **Type mapping (§6.1.1):**
  - `"integer"` → `viz:QuantitativeType`, `numericPrecision: "integer"`
  - `"number"` → `viz:QuantitativeType`, `numericPrecision: "float"`
  - `"boolean"` → `viz:BooleanType`
  - `"boolean-encoded-string"` → `viz:BooleanType`
  - `"string"` → `viz:NominalType`
  - `"null"` → `viz:UnknownType`
- [x] **Precision override (§6.1.1):** When consensus winner is `"integer"` but BIBSS `primitiveType` was widened to `"number"` or `"string"`, still assign `numericPrecision: "integer"` (consensus winner determines precision, not lattice).
- [x] **No-consensus fallback (§6.1):** If no type passes threshold, assign `viz:NominalType`. Set `viz:consensusScore` to the highest single-type ratio. Emit `SAS-001` with context: `field`, `highestConsensus`, `highestType`.
- [x] **Score formatting (§2.6):** `viz:consensusScore` = `(numerator / denominator).toFixed(6)`. Always a JSON **string** matching `/^\d+\.\d{6}$/`. For denominator === 0, emit `"0.000000"`.
- [x] **Integer companions:** `sas:consensusNumerator` = count of winning type, `sas:consensusDenominator` = `nonNullTotal`. Both JSON integers.
- [x] **`sas:structuralType`** = BIBSS `primitiveType` (recorded before SAS interpretation) — *set by caller via ConsensusResult, not by consensusPromotion itself*
- [x] **Rule name:** `"consensus-promotion"`
- [x] **Threshold boundary correctness (§13.2):**
  - `{ "integer": 19, "string": 1 }`, occ 20, threshold 0.95 → `19 * 1_000_000 = 19_000_000 >= 950_000 * 20 = 19_000_000` → **passes** (exactly at threshold)
  - `{ "integer": 189, "string": 11 }`, occ 200, threshold 0.95 → `189 * 1_000_000 = 189_000_000 >= 950_000 * 200 = 190_000_000` → **fails** (0.945)
- [x] `npm run build` compiles without errors

---

### 1.7 Implement Temporal Detection

**Status:** Complete | **Priority:** Medium | **Spec:** §6.2

Implement name-based temporal heuristic and SNP manifest evidence path.

**Acceptance Criteria:**

- [x] **Trigger condition (§6.2):** Rule applies only when the field's *current* assigned type (after null vocabulary adjustment and consensus) is `viz:NominalType`. If null vocabulary reclassification shifted consensus away from NominalType (e.g., to QuantitativeType), temporal detection does NOT run.
- [x] **SNP evidence path (ADR-007):** If `snpManifest` contains an entry with `detail.type === "date_converted"` and `path === fieldName`: assign `viz:TemporalType` regardless of name matching. Rule name `"temporal-detection-snp-evidence"`, emit `SAS-009` (context: `field`). **Note:** SNP manifest uses `rule: "date-normalization"` with `detail.type: "date_converted"` — match on `detail.type`, not on `rule`.
- [x] **Name-based path:** If `primitiveType` is `"string"` AND current assigned type is `viz:NominalType`: test field name against `config.temporalNamePattern`
  - Match → assign `viz:TemporalType`, rule name `"temporal-detection"`, emit `SAS-010` (context: `field`, `matchedPattern`)
  - No match → field remains `viz:NominalType`
- [x] **SNP evidence takes precedence** over name-match (both produce TemporalType, but SNP evidence is checked first as it's direct evidence — and uses a distinct rule name for provenance)
- [x] Default `temporalNamePattern`: `/(?:date|time|timestamp|created|updated|modified|born|died|started|ended|expires?)(?:_at|_on|_time)?$/i`
- [x] `npm run build` compiles without errors

---

### 1.8 Implement Boolean Pair Detection (Configured)

**Status:** Complete | **Priority:** Medium | **Spec:** §6.3

Implement the configured boolean pair override for string-typed fields.

**Acceptance Criteria:**

- [x] **Trigger condition (§6.3):** Rule applies after temporal detection, only to fields where BIBSS `primitiveType` is `"string"` AND current assigned type is still `viz:NominalType` (not already overridden by temporal or consensus). Numeric or boolean BIBSS types are NOT eligible.
- [x] **Config lookup:** Check if field name (lowercased) exists in `config.booleanFields` (keys also lowercased). Case-insensitive comparison on both sides.
- [x] If matched: assign `viz:BooleanType`. Rule name `"boolean-pair-configured"`.
- [x] If not matched: no change (field continues down the cascade)
- [x] Boolean pair detection from BIBSS `boolean-encoded-string` in `typeDistribution` is handled by consensus promotion (§6.1.1), NOT by this rule — this rule is config-only
- [x] `npm run build` compiles without errors

---

### 1.9 Implement Null Vocabulary Reclassification (Configured)

**Status:** Complete | **Priority:** Medium | **Spec:** §6.4, §9.3

Implement null vocabulary reclassification that adjusts `typeDistribution` counts before consensus runs.

> **CASCADE ORDER — THIS IS LOAD-BEARING:** Null vocabulary reclassification is a **pre-processing step** that modifies the `typeDistribution` counts *before* consensus promotion sees them. It is NOT a post-consensus correction. The execution order in the cascade function (task 1.12) MUST be:
> 1. CISM consistency validation (1.5)
> 2. Null vocabulary reclassification (1.9) — adjusts counts
> 3. Consensus promotion (1.6) — uses adjusted counts
> 4. Temporal detection (1.7) — only if assigned type is NominalType
> 5. Boolean pair detection (1.8) — only if assigned type is still NominalType
> 6. Structural passthrough / Unknown (1.10)
>
> The task numbers reflect implementation order (build the pieces), not cascade execution order (wire the pieces). Task 1.12 defines the wiring.

**Acceptance Criteria:**

- [x] **Sources:** `config.nullVocabulary` (field-specific, keyed by field name case-insensitive) and `config.globalNullVocabulary` (applied to all fields). Field-specific entries and global entries are combined (union).
- [x] **Value matching:** Case-insensitive, whitespace-trimmed comparison of null vocabulary strings
- [x] **Reclassification effect:** When null vocabulary is applied to a field, the `"string"` count in `typeDistribution` is reduced by the number of null vocabulary matches (capped at the actual string count). The `"null"` count is increased by the same amount. Returns an adjusted copy — does NOT mutate the original CISM.
- [x] **Returns adjusted counts:** The function returns the adjusted `typeDistribution`, `nullCount`, and `nonNullTotal` for consensus to consume. It does NOT run consensus itself.
- [x] **SAS-008 diagnostic:** Emitted when reclassification changes the consensus winner (determined after consensus runs on adjusted counts vs. what consensus would have produced on original counts). Context: `field`, `beforeType`, `afterType`, `reclassifiedCount`. — *SAS-008 comparison is the cascade's responsibility (task 1.12); this function provides the adjusted counts and reclassifiedCount needed for that comparison.*
- [x] Rule name: `"null-vocabulary-configured"` (set on the output field when null vocab was applied AND changed the consensus winner) — *applied by cascade (task 1.12)*
- [x] **Spec worked example (§9.3):** `{ "integer": 95, "string": 5 }`, occ 100, all 5 strings are "N/A" → reclassified to `{ "integer": 95, "null": 5 }` → nonNullTotal = 95 → consensus 1.0 → `viz:QuantitativeType`
- [x] `npm run build` compiles without errors

---

### 1.10 Implement Structural Passthrough and Unknown Assignment

**Status:** Complete | **Priority:** Medium | **Spec:** §6.5, §6.6, §9.2

Implement the two fallback rules that handle fields not caught by higher-priority rules.

**Acceptance Criteria:**

- [x] **Structural passthrough (§6.5):** When no prior rule assigned a type, map BIBSS `primitiveType` directly via §6.1.1 table. Set `viz:consensusScore: "1.000000"`, `sas:consensusNumerator` = total count for that type, `sas:consensusDenominator` = nonNullTotal. Rule name: `"structural-passthrough"`.
- [x] **Unknown assignment (§6.6):** When `primitiveType` is `"null"` (all values null) OR node `kind` is `"union"`, assign `viz:UnknownType`. Emit `SAS-002` (context: `field`, `reason`). Rule name: `"unknown-assignment"`. For all-null: `consensusScore: "0.000000"`, numerator: 0, denominator: 0.
- [x] **Nested structure handling (§9.2):** For any top-level `SchemaEdge` whose target `SchemaNode` has `kind: "object"` or `kind: "array"`, skip it (do not produce a `viz:DataField`), emit `SAS-003` (context: `field`, `kind`).
- [x] **Union handling (§9.2):** Top-level `SchemaEdge` with target `kind: "union"` → `viz:UnknownType` via §6.6.
- [x] `npm run build` compiles without errors

---

### 1.11 Implement SNP Manifest Annotations

**Status:** Complete | **Priority:** Medium | **Spec:** §4.2, §5.3, ADR-007

Attach normalization provenance from the optional SNP manifest to output fields.

> **SNP manifest matching (ADR-007):** The SNP manifest `rule` field is the SNP rule name (e.g., `"currency-stripping"`, `"date-normalization"`). The `detail.type` field identifies the specific transformation (e.g., `"currency_stripped"`, `"date_converted"`). SAS matches on `detail.type` and `path`, not on `rule`.

**Acceptance Criteria:**

- [x] If `snpManifest` is provided, for each `viz:DataField`:
  - If manifest contains an entry with `detail.type === "currency_stripped"` and `path === fieldName` → set `viz:wasNormalized: true`
  - If manifest contains an entry where percentage stripping is indicated (check for `detail.type === "percent_stripped"` OR `detail.originalValue` containing a `%` character alongside `detail.type === "currency_stripped"`) and `path === fieldName` → set `viz:wasPercentage: true`
- [x] If `snpManifest` is absent or no entries match a field: `viz:wasNormalized` and `viz:wasPercentage` are **omitted entirely** (not set to false) — §2.6 absent vs null
- [x] Path matching between manifest `path` and `SchemaEdge.name` is exact string match
- [x] `npm run build` compiles without errors

---

### 1.12 Assemble Field Processing Cascade

**Status:** Complete | **Priority:** High | **Spec:** §9.1 steps 4–5, §5.2, §5.3

Wire the individual rule functions into the correct cascade execution order and produce the `DatasetSchemaLD` object.

> **CASCADE EXECUTION ORDER — normative, derived from §9.1 and §9.3:**
>
> For each field (`SchemaEdge`), in CISM property order:
> 1. **Skip non-primitives** (§9.2) — nested object/array → SAS-003, union → §6.6
> 2. **CISM consistency validation** (task 1.5) — if failed → UnknownType, skip remaining steps
> 3. **Null vocabulary adjustment** (task 1.9) — modifies typeDistribution counts before consensus
> 4. **Consensus promotion** (task 1.6) — runs on adjusted counts, produces assigned type
> 5. **Temporal detection** (task 1.7) — only if current assigned type is NominalType
> 6. **Boolean pair detection** (task 1.8) — only if current assigned type is still NominalType
> 7. **Structural passthrough / Unknown** (task 1.10) — only if no prior rule assigned a type
> 8. **SNP manifest annotations** (task 1.11) — attach wasNormalized, wasPercentage
> 9. **Build DataFieldLD** — assign @id via normalizeFieldName (task 1.4)
>
> This order is **not** the task implementation order. Tasks 1.5–1.11 build the individual pieces; this task wires them in the correct execution sequence.

**Acceptance Criteria:**

- [x] **Cascade wired in the order above** — null vocab before consensus, temporal/boolean only after consensus assigns NominalType
- [x] **SAS-008 detection:** Compare what consensus would produce with original counts vs. adjusted counts. If the type changed, emit SAS-008 and set rule name to `"null-vocabulary-configured"`.
- [x] **viz:hasField array** preserves CISM SchemaEdge order — §2.6
- [x] **All @id values in viz:hasField are unique** — §13.3 item 15
- [x] **Every DataField has exactly one viz:hasDataType** — §13.3 item 5
- [x] **Required DataField properties always present:** `@id`, `@type`, `viz:fieldName`, `viz:hasDataType`, `viz:consensusScore`, `sas:consensusNumerator`, `sas:consensusDenominator`, `sas:alignmentRule`, `sas:structuralType` — §5.3
- [x] **Conditional DataField properties** present only when applicable: `viz:numericPrecision` (Quantitative only), `viz:wasNormalized` / `viz:wasPercentage` (SNP manifest only) — §5.3
- [x] **Standalone mode fields:** `sas:fandawsConsulted: false` on every field. No `sas:fandawsMatch` property. — §5.4, ADR-004
- [x] `npm run build` compiles without errors

---

### 1.13 JCS Canonicalization and Serialization

**Status:** Complete | **Priority:** High | **Spec:** §2.6, §9.1 steps 6–7

Ensure the in-memory `DatasetSchemaLD` object is serialized to JCS-canonical bytes.

**Acceptance Criteria:**

- [x] **Key ordering (§2.6):** All JSON objects have keys sorted lexicographically (Unicode code point order). Includes `@context`, each `DataFieldLD`, and all nested objects (e.g., `viz:hasDataType: { "@id": "..." }`).
- [x] **Boolean values:** `true`/`false` serialized as JSON literals, not strings — §2.6
- [x] **Null handling (§2.6):** Absent properties omitted entirely (never set to `null`). Explicit nulls (like `sas:fandawsMatch: null` in enriched mode) use JSON `null`.
- [x] **`stableStringify` in `canonicalize.ts`** produces JCS-equivalent bytes — verify the existing implementation handles nested `@id` objects correctly, update if needed
- [x] **Update CLI entry point (`src/kernel/index.ts`)** to call `align()` instead of `transform()`
- [x] `npm run build` compiles without errors
- [x] `npm run test:purity` passes (kernel imports nothing from adapters/composition)

---

### 1.14 Update Spec Tests and Example Fixtures

**Status:** Complete | **Priority:** High | **Spec:** §13.1, ARCHITECTURE.md

Update the template's 3 spec tests to exercise `align()` instead of `transform()`, and replace example fixtures.

**Acceptance Criteria:**

- [x] **`examples/input.jsonld`** replaced with a representative CISM (based on Appendix B: 3-column CSV with Region/Revenue/created_at)
- [x] **`examples/expected-output.jsonld`** replaced with the expected `viz:DatasetSchema` output for the CISM input in standalone mode (no Fandaws — `sas:fandawsConsulted: false`, no `sas:fandawsMatch`)
- [x] **`tests/determinism.test.ts` updated:**
  - Calls `align(cism, rawHash)` instead of `transform(input)`
  - Test 1: `deepStrictEqual` across two invocations — §13.1
  - Test 2: `stableStringify` produces identical strings — §13.1
  - Test 3: Input immutability (CISM not mutated)
- [x] **`tests/no-network.test.ts` updated:**
  - Calls `align(cism, rawHash)` instead of `transform(input)`
  - Stubs fetch and XMLHttpRequest — unchanged behavior
- [x] **`tests/snapshot.test.ts` updated:**
  - Reads updated `examples/input.jsonld` and `examples/expected-output.jsonld`
  - Calls `align()` instead of `transform()`
  - Compares canonicalized output
- [x] **All 3 spec tests pass:** `npm test` exits 0
- [x] **Purity check passes:** `npm run test:purity` exits 0

---

### 1.15 Write Domain Tests — Consensus and Type Mapping

**Status:** Complete | **Priority:** High | **Spec:** §13.2

Write domain-specific tests for consensus promotion, the core algorithm.

**Acceptance Criteria:**

Test file: `tests/consensus.test.ts`

- [x] **Consensus promotion (integer):** `{ "integer": 95, "string": 5 }`, occ 100 → `viz:QuantitativeType`, consensus `"0.950000"` — §13.2
- [x] **Consensus below threshold:** `{ "integer": 94, "string": 6 }`, occ 100 → `viz:NominalType`, SAS-001 — §13.2
- [x] **Consensus with nulls:** `{ "null": 10, "integer": 85, "string": 5 }`, occ 100 → nonNullTotal 90, consensus 85/90 = 0.944 → `viz:NominalType`, SAS-001 — §13.2
- [x] **Consensus exact threshold:** `{ "integer": 95, "string": 5 }`, occ 100 → consensus exactly 0.95 → **passes** (≥, not >) — §13.2
- [x] **Integer threshold boundary (passes):** `{ "integer": 19, "string": 1 }`, occ 20 → `19 * 1M >= 950K * 20` → passes — §13.2
- [x] **Integer threshold boundary (fails):** `{ "integer": 189, "string": 11 }`, occ 200 → `189M < 190M` → fails — §13.2
- [x] **Consensus tie-breaking (ADR-006):** `{ "integer": 50, "number": 50 }`, occ 100, threshold 0.50 → both pass with equal count → `number` wins (wider in lattice) → `viz:QuantitativeType`, `numericPrecision: "float"`
- [x] **Structural passthrough (integer):** `{ "integer": 100 }`, occ 100 → QuantitativeType, score `"1.000000"`, precision `"integer"` — §13.2
- [x] **Structural passthrough (boolean):** `{ "boolean": 100 }`, occ 100 → BooleanType — §13.2
- [x] **Structural passthrough (string, no temporal):** `{ "string": 100 }`, occ 100, field `"description"` → NominalType — §13.2
- [x] **Numeric precision (integer):** primitiveType `"integer"` → `"integer"` — §13.2
- [x] **Numeric precision (float):** primitiveType `"number"` → `"float"` — §13.2
- [x] **Numeric precision (consensus override):** BIBSS widened to `"number"`, but 98% integer → `"integer"` — §13.2
- [x] **ConsensusScore string format:** Always a JSON string (quoted) matching `/^\d+\.\d{6}$/`. `1.0` emitted as `"1.000000"` — §13.2
- [x] **Numerator/denominator integers:** `sas:consensusNumerator` and `sas:consensusDenominator` present as exact integers — §13.2
- [x] **Min observation (below):** `{ "null": 9997, "integer": 3 }`, occ 10000, min 5 → nonNull 3 < 5 → UnknownType, SAS-012 — §13.2
- [x] **Min observation (at threshold):** `{ "null": 95, "integer": 5 }`, occ 100, min 5 → nonNull 5 >= 5 → proceeds — §13.2
- [x] **Min observation (single):** `{ "null": 9999, "integer": 1 }`, occ 10000 → nonNull 1 < 5 → UnknownType, SAS-012 — §13.2
- [x] **Unknown (all null):** `{ "null": 100 }`, occ 100 → UnknownType, SAS-002 — §13.2
- [x] **Unknown (union):** node kind `"union"` → UnknownType, SAS-002 — §13.2
- [x] **CISM count mismatch:** typeDistribution sum > occurrences → SAS-013, UnknownType — §13.2
- [x] **Unrecognized key:** `{ "custom_type": 50 }` → treated as string, SAS-014 — §13.2
- [x] **boolean-encoded-string recognized:** `{ "boolean-encoded-string": 100 }`, occ 100 → BooleanType, no SAS-014 — §6.1.1, §6.1.2
- [x] `npm test` passes

---

### 1.16 Write Domain Tests — Temporal, Boolean, Null Vocab, Normalization

**Status:** Complete | **Priority:** High | **Spec:** §13.2

Write domain-specific tests for the remaining static rules.

**Acceptance Criteria:**

Test file: `tests/rules.test.ts`

- [x] **Temporal (name match):** field `"created_at"`, primitiveType `"string"` → TemporalType, rule `"temporal-detection"`, SAS-010 — §13.2
- [x] **Temporal (SNP evidence):** manifest with `detail.type: "date_converted"` → TemporalType, rule `"temporal-detection-snp-evidence"`, SAS-009 — §13.2, ADR-007
- [x] **Temporal (no match):** field `"description"`, primitiveType `"string"` → NominalType — §13.2
- [x] **Temporal not triggered after null vocab shift:** field `"created_at"` with `{ "integer": 90, "string": 10 }`, null vocab reclassifies strings → consensus assigns QuantitativeType → temporal detection does NOT run (current type is not NominalType). Verifies SAS-008 fires (winner changed NominalType→QuantitativeType) and SAS-010 absent.
- [x] **Boolean pair (configured):** `booleanFields: { "is_active": ["Y", "N"] }`, field `"is_active"` → BooleanType, rule `"boolean-pair-configured"` — §13.2
- [x] **Boolean pair (not configured):** field `"is_active"`, no config → NominalType — §13.2
- [x] **Null vocabulary (field-specific):** `nullVocabulary: { "result": ["N/A"] }`, field with `{ "integer": 90, "string": 10 }` → reclassify, consensus rises → QuantitativeType, SAS-008 — §13.2
- [x] **Null vocab cascade order:** Null vocab adjusts counts, then consensus runs on adjusted counts — not the other way around. Verify by checking that the consensus numerator/denominator reflect the adjusted nonNullTotal (90/90, not 90/100).
- [x] **SNP currency annotation:** manifest with `detail.type: "currency_stripped"` → `viz:wasNormalized: true` — §13.2, ADR-007
- [x] **SNP percentage annotation:** manifest with percentage indicator → `viz:wasPercentage: true` — §13.2, ADR-007
- [x] **Nested structure skipped:** CISM with nested object property → SAS-003 — §13.2
- [x] `npm test` passes

---

### 1.17 Write Domain Tests — Output Structure and Invariants

**Status:** Complete | **Priority:** High | **Spec:** §13.2, §13.3

Write tests validating the output JSON-LD structure, field IRI normalization, and property-based invariants.

**Acceptance Criteria:**

Test file: `tests/output.test.ts`

- [x] **Field IRI normalization:** `"Revenue"` → `viz:field/revenue`, `"First Name"` → `viz:field/first-name` — §13.2
- [x] **Field IRI collision:** Two fields normalizing to same slug → second gets `-1` suffix — §13.2
- [x] **Raw hash propagation:** `rawHash` appears as `viz:rawInputHash` in output — §13.2
- [x] **JCS canonicalization:** Output keys are lexicographically sorted — §13.2
- [x] **SASResult status on fatal:** CISM version `"1.0"` → `status: "error"`, schema absent, SAS-007 — §13.2
- [x] **Schema-level fatal (SAS-007):** version `"1.0"` → `status: "error"`, no schema, SAS-007 in diagnostics — §13.2
- [x] **Field-level fatal (SAS-013):** One field has count mismatch → that field UnknownType, but `status: "ok"`, schema present, other fields intact — §13.2
- [x] **Property invariant 1 (§13.3):** `align()` terminates and never throws for any valid CISM
- [x] **Property invariant 2:** status is `"ok"` or `"error"`
- [x] **Property invariant 3:** If `"ok"`, every primitive SchemaEdge produces exactly one DataField (nested/array edges skipped per §9.2)
- [x] **Property invariant 4:** If `"error"`, schema absent, at least one fatal diagnostic
- [x] **Property invariant 5:** Every DataField has exactly one `viz:hasDataType`
- [x] **Property invariant 6:** Every `viz:consensusScore` matches `/^\d+\.\d{6}$/` and is in `["0.000000", "1.000000"]`
- [x] **Property invariant 7:** `numerator <= denominator`, both non-negative integers
- [x] **Property invariant 8:** Every DataField has `sas:alignmentRule` string
- [x] **Property invariant 11:** Output `viz:rawInputHash` equals input `rawHash`
- [x] **Property invariant 12:** If `nonNullTotal < minObservationThreshold`, type is UnknownType
- [x] **Property invariant 14:** `viz:hasField` preserves CISM SchemaEdge order
- [x] **Property invariant 15:** All `@id` values in `viz:hasField` are unique
- [x] `npm test` passes

---

### 1.18 Final Validation and Stabilization

**Status:** Complete | **Priority:** High

End-to-end verification that all pieces work together.

**Acceptance Criteria:**

- [x] `npm run build` — zero TypeScript errors
- [x] `npm test` — all spec tests (determinism, no-network, snapshot) pass
- [x] `npm test` — all domain tests (consensus, rules, output) pass
- [x] `npm run test:purity` — kernel imports nothing from adapters/composition
- [x] Kernel contains no references to `Date.now()`, `new Date()`, `Math.random()`, `crypto.getRandomValues()`, `process.env`, `fetch`, `XMLHttpRequest`
- [x] Example fixtures (`input.jsonld`, `expected-output.jsonld`) match actual `align()` output byte-for-byte (verified by snapshot test)
- [x] ROADMAP.md updated: all Phase 1 tasks marked complete
- [x] DECISIONS.md updated with any new decisions made during implementation

---

### 1.19 GitHub Pages Demo Site

**Status:** Complete | **Priority:** Medium

Interactive demo for non-technical SMEs. Deployed via GitHub Pages CI/CD.

**Acceptance Criteria:**

- [x] `esbuild` added as devDependency, `build:demo` script added to `package.json`
- [x] `site/index.html` created with two-panel layout (input + output)
- [x] `site/demo.ts` imports kernel directly, bundles for browser via esbuild
- [x] `.github/workflows/pages.yml` deploys to GitHub Pages on push to main
- [x] `npm run build:demo` produces `site/dist/demo.js` (23.6kb, 21ms)
- [x] Demo loads Appendix B fixture, "Align" produces correct output
- [x] `npm run build` still passes (no regressions)
- [x] `npm test` still passes (59/59)

### 1.20 Configuration-in-Output (`sas:activeConfig`)

**Status:** Complete | **Priority:** High

Include active alignment configuration in every SAS output for auditability and reproducibility (ADR-010).

**Acceptance Criteria:**

- [x] `sas:activeConfig` block present in every SAS output
- [x] All five config properties present, including when values equal defaults
- [x] Config values in output match the config passed to `align()` — byte-identical after JCS
- [x] JCS key ordering correct (`sas:activeConfig` sorts between `@type` and `sas:alignmentMode`)
- [x] Existing tests pass after snapshot regeneration
- [x] 4 new config-presence invariant tests pass (63/63 total)
- [x] `npm run build` still passes (no regressions)
- [x] `npm run test:purity` still passes

---

**NOT in scope for Phase 1:**
- Fandaws enrichment (§6.7): type override, type veto, epistemic matrix, metric hints, FandawsScope interface — deferred to Phase 1v2 (ADR-004)
- §13.3 invariants 9–10, 13 (Fandaws-specific) — deferred to Phase 1v2
- Adapters (HTTP, persistence, orchestration) — Phase 2
- Composition layer (Concepts, Synchronizations) — Phase 3
- Deployment — Phase 4

**Decisions Made:**
- sas-v2.0.md is the authoritative spec (ADR-002)
- CISM types defined locally in kernel (ADR-003)
- Fandaws deferred to Phase 1v2 (ADR-004)
- Template API refactored from `transform()` to `align()` (ADR-005)
- Consensus tie-breaking on equal counts uses widening lattice (ADR-006)
- SNP manifest matching uses `detail.type`, not `rule` (ADR-007)
- Spec test adaptation authorized for template-to-SAS migration (ADR-008)
- Active config included in SAS output for auditability (ADR-010)

---

## Phase 1v2: Fandaws Enrichment Layer

**Goal:** Add Fandaws enrichment to the static core: `FandawsScope` interface, field-to-concept resolution (§6.7.1), type override/veto (§6.7.2–§6.7.3), epistemic matrix (§6.7.5), null vocabulary override (§6.7.4), metric pre-matching (§6.7.6).

**Status:** Not Started

<!-- Define sub-tasks when Phase 1 static core is stable. -->

**Implementation notes for Phase 1v2 planning:**

- **Fandaws tie-breaker sort is mandatory for determinism (§6.7.1):** When `resolveTerm` returns multiple concepts, SAS MUST sort them lexicographically by `id` before selecting the first. This defensive tie-breaker ensures byte-identical output even if the caller's `FandawsScope` implementation returns concepts in nondeterministic order (e.g., hash-map iteration). The sort is a safety net — a well-behaved scope already returns concepts in priority order (context → user → global), but SAS does not trust this. This MUST be tested with a shuffled-order `FandawsScope` mock.
- The `align()` signature already reserves the `fandaws?` parameter (Phase 1 ignores it). Phase 1v2 activates it.
- §13.3 invariants 9–10 and 13 apply once Fandaws is active.

**NOT in scope:**
- Modifying static core rule behavior
- Adding runtime dependencies

---

## Phase 2: Build Adapters

**Goal:** Expose the kernel through infrastructure adapters.

**Status:** Not Started

<!-- Define sub-tasks when Phase 1v2 is complete. -->

**NOT in scope:**
- Modifying the kernel
- Adding runtime dependencies to the kernel

---

## Phase 3: Composition Layer

**Goal:** Orchestrate multiple Concepts and Synchronizations around the kernel.

**Status:** Not Started

<!-- Define sub-tasks when Phase 2 is complete. -->

---

## Phase 4: Deployment

**Goal:** Deploy the service to its target environment.

**Status:** Not Started

<!-- Define sub-tasks when Phase 3 is complete. -->
