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

**Status:** In Progress

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

**Status:** Awaiting Orchestrator Approval | **Priority:** High

Stage all planning and scaffolding artifacts. Requires Orchestrator approval before commit.

**Acceptance Criteria:**

- [ ] `project/sas-v2.0.md` tracked in git (new file)
- [ ] `project/SPEC.md` deletion staged
- [ ] `project/DECISIONS.md` (ADR-001 through ADR-008) staged
- [ ] `project/ROADMAP.md` (Phases 0–4) staged
- [ ] `CLAUDE.md` updates staged
- [ ] `package.json` identity changes staged
- [ ] `src/kernel/transform.ts` (align stub + type shells) staged
- [ ] Clean commit with descriptive message
- [ ] **Orchestrator approval obtained before executing commit**

---

### 0.5 Verify Green Baseline

**Status:** Not Started | **Priority:** High

Confirm all checks pass before Phase 1 begins. This establishes the known-good starting point.

**Acceptance Criteria:**

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm test` — all 3 spec tests pass (determinism, no-network, snapshot)
- [ ] `npm run test:purity` — kernel isolation verified
- [ ] `git status` — working directory clean (all Phase 0 changes committed)
- [ ] `git log` — Phase 0 commit visible with correct message

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

**Status:** Not Started

---

### 1.1 Define Input Types

**Status:** Not Started | **Priority:** High | **Spec:** §4.1, §4.2, §4.4

Define all TypeScript interfaces for the inputs SAS consumes.

**Acceptance Criteria:**

- [ ] `CISMRoot` interface defined per §4.1 with fields: `version`, `generatedAt`, `config`, `root`, `sampling?`
- [ ] `SchemaNode` interface defined with fields: `kind` (`"object"` | `"array"` | `"primitive"` | `"union"`), `primitiveType?`, `typeDistribution?`, `occurrences`, `nullable?`, `id?`, `properties?` (for object kind), `itemType?` (for array kind)
- [ ] `SchemaEdge` interface defined with fields: `name`, `target` (SchemaNode), `required?`, `occurrences?`, `totalPopulation?`
- [ ] `InferConfig` defined as opaque record (SAS does not inspect it, just passes through)
- [ ] `ManifestEntry` interface defined per §4.2 with fields: `rule`, `path`, `detail?` — where `detail` includes at minimum `type?: string` and `originalValue?: string` (see ADR-007)
- [ ] All types exported from `src/kernel/transform.ts`
- [ ] `npm run build` compiles without errors

---

### 1.2 Define Output Types and Constants

**Status:** Not Started | **Priority:** High | **Spec:** §5.1, §5.2, §5.3, §7, §10

Define all TypeScript interfaces for the outputs SAS produces, the configuration surface, and the diagnostic codes.

**Acceptance Criteria:**

- [ ] `SASResult` interface: `status` (`"ok"` | `"error"`), `schema?` (DatasetSchemaLD), `diagnostics` (Diagnostic[]) — §5.1
- [ ] `Diagnostic` interface: `code`, `level` (`"fatal"` | `"warning"` | `"info"`), `message`, `remediation`, `context` (Record<string, unknown>) — §5.1
- [ ] `DatasetSchemaLD` interface with required fields: `@context`, `@type`, `viz:rawInputHash`, `viz:totalRows`, `viz:hasField` and conditional: `viz:rowsInspected`, `sas:fandawsAvailable`, `sas:alignmentMode` — §5.2
- [ ] `DataFieldLD` interface with 9 required properties (`@id`, `@type`, `viz:fieldName`, `viz:hasDataType`, `viz:consensusScore`, `sas:consensusNumerator`, `sas:consensusDenominator`, `sas:alignmentRule`, `sas:structuralType`) and conditional properties (`viz:numericPrecision`, `viz:wasNormalized`, `viz:wasPercentage`, `sas:fandawsConsulted`) — §5.3
- [ ] `SASConfig` interface with all 6 fields per §7: `consensusThreshold`, `minObservationThreshold`, `temporalNamePattern`, `booleanFields`, `nullVocabulary`, `globalNullVocabulary`
- [ ] `DEFAULT_CONFIG` constant matching §7 defaults exactly: `consensusThreshold: 0.95`, `minObservationThreshold: 5`, temporal regex as specified, empty maps/arrays
- [ ] `@context` constant object with exact namespace IRIs: `viz`, `sas`, `fandaws`, `prov` — §5.2
- [ ] Enumeration of the 5 valid `viz:DataType` values: `viz:QuantitativeType`, `viz:NominalType`, `viz:TemporalType`, `viz:BooleanType`, `viz:UnknownType` — §5.3
- [ ] `THRESH_SCALE` constant = `1_000_000` — §6.1
- [ ] All types exported from `src/kernel/transform.ts`
- [ ] `npm run build` compiles without errors

---

### 1.3 Implement `align()` Entry Point and Input Validation

**Status:** Not Started | **Priority:** High | **Spec:** §8, §9.1 steps 1–3, §5.2

Implement the `align()` function signature, config merging, and the two schema-level validation gates.

**Acceptance Criteria:**

- [ ] `align(cism, rawHash, config?, snpManifest?)` function exported — §8 (omit `fandaws` parameter until Phase 1v2)
- [ ] `align()` is synchronous — returns `SASResult` directly, not a `Promise` — §8
- [ ] `align()` **never throws** for any input — all errors returned as diagnostics — §5.1
- [ ] Config merging: `Partial<SASConfig>` merged with `DEFAULT_CONFIG`; missing fields get defaults — §7
- [ ] `scaledThreshold` computed once: `Math.round(config.consensusThreshold * THRESH_SCALE)` — §6.1
- [ ] **CISM version validation (§9.1 step 1):** If `cism.version` is missing or less than `"1.3"` (semver string comparison), return `{ status: "error", diagnostics: [SAS-007] }` with no `schema` — §10 SAS-007
- [ ] **CISM root structure validation (§9.1 step 2):** Root node must be `kind: "object"` or `kind: "array"` with an `itemType` of `kind: "object"`. If invalid, return `{ status: "error", diagnostics: [SAS-013 at schema level] }` with no `schema`
- [ ] **Root property extraction (§9.1 step 3):** For `kind: "object"` root, use `root.properties`. For `kind: "array"` root, use `root.itemType.properties`. Store as `SchemaEdge[]` for iteration.
- [ ] **Schema-level metadata assembly (§5.2):**
  - `viz:rawInputHash` = `rawHash` parameter
  - `viz:totalRows` = root array node's `occurrences`, or `cism.sampling.inputSize` if sampling applied
  - `viz:rowsInspected` = `cism.sampling.sampleSize` if `sampling.applied === true`, else equals `viz:totalRows`, else omitted
  - `sas:fandawsAvailable` = `false` (Phase 1, no Fandaws)
  - `sas:alignmentMode` = `"standalone"` (Phase 1)
- [ ] Template's existing `transform()` function removed or replaced
- [ ] `npm run build` compiles without errors

---

### 1.4 Implement `normalizeFieldName` and Field IRI Generation

**Status:** Not Started | **Priority:** High | **Spec:** §5.5

Implement the deterministic field slug algorithm and collision resolution.

**Acceptance Criteria:**

- [ ] `normalizeFieldName(name: string): string` is a named pure function
- [ ] Step 1: Unicode NFC normalization applied (`name.normalize("NFC")`)
- [ ] Step 2: Convert to lowercase
- [ ] Step 3: Replace any character outside `[a-z0-9]` with hyphen `"-"`
- [ ] Step 4: Collapse consecutive hyphens to single hyphen
- [ ] Step 5: Trim leading and trailing hyphens
- [ ] Step 6: If result is empty, return `"field"`
- [ ] Output contains only `[a-z0-9\-]` characters
- [ ] **Collision resolution:** Track seen slugs across all fields in a single `align()` call. First field keeps bare slug; second duplicate gets `-1`; third gets `-2`, etc. Collision index is 0-indexed from the second occurrence.
- [ ] **`@id` format:** `viz:field/{slug}` (with collision suffix if needed)
- [ ] Spec examples produce correct output:
  - `"Revenue"` → `viz:field/revenue`
  - `"First Name"` → `viz:field/first-name`
  - `"first_name"` (after `"First Name"`) → `viz:field/first-name-1`
  - `""` → `viz:field/field`
  - `"日付"` (after `""`) → `viz:field/field-1`
- [ ] `npm run build` compiles without errors

---

### 1.5 Implement CISM Consistency Validation

**Status:** Not Started | **Priority:** High | **Spec:** §6.1.3

Implement the per-field `SchemaNode` invariant checks that run before consensus.

**Acceptance Criteria:**

- [ ] Check `occurrences >= 0` — if negative, emit `SAS-013` (field-level fatal)
- [ ] Compute `sum(typeDistribution[*])` — if sum exceeds `occurrences`, emit `SAS-013` (field-level fatal)
- [ ] Compute `nullCount = typeDistribution["null"] || 0` — if `nullCount > occurrences`, emit `SAS-013` (field-level fatal)
- [ ] Verify `nonNullTotal >= 0` (by construction, but explicit check)
- [ ] If any SAS-013 emitted for a field: assign `viz:UnknownType`, skip consensus, continue to next field
- [ ] **Field-level fatal does NOT set `status: "error"`** — schema is still emitted, other fields processed normally — §5.1
- [ ] SAS-013 diagnostic includes context fields: `field`, `reason`, `occurrences`, `typeDistributionSum` — §10
- [ ] `npm run build` compiles without errors

---

### 1.6 Implement Consensus Promotion

**Status:** Not Started | **Priority:** High | **Spec:** §6.1, §6.1.1, §6.1.2, §9.3

Implement the core consensus algorithm: integer arithmetic threshold check, type mapping, score formatting.

> **Design note:** This function must accept a (possibly adjusted) `typeDistribution` and `nonNullTotal` — not read them directly from the `SchemaNode`. Task 1.9 (null vocabulary) adjusts counts *before* consensus runs. The consensus function must be callable with either original or adjusted counts. See task 1.12 for the wiring order.

**Acceptance Criteria:**

- [ ] **Observation threshold check (§6.1):** If `nonNullTotal < minObservationThreshold`, assign `viz:UnknownType`, emit `SAS-012`, skip consensus. SAS-012 context: `field`, `nonNullTotal`, `minObservationThreshold`.
- [ ] **Unrecognized typeDistribution keys (§6.1.2):** Any key not in `["integer", "number", "string", "boolean", "boolean-encoded-string", "null"]` is treated as `"string"` for consensus purposes. Emit `SAS-014` with context: `field`, `unknownKey`.
- [ ] **`boolean-encoded-string` forward compatibility (§6.1.1, §6.1.2):** `"boolean-encoded-string"` is a recognized key that maps to `viz:BooleanType` per the §6.1.1 mapping table. It exists for forward compatibility with BIBSS v1.4+ which may detect boolean-encoded string columns. BIBSS v1.3 does not produce this key. It must NOT trigger SAS-014 — it is in the recognized key list.
- [ ] **Integer threshold check (§6.1):** For each non-null type `T`: `typeDistribution[T] * THRESH_SCALE >= scaledThreshold * nonNullTotal`. Uses JavaScript `Number` arithmetic (safe for nonNullTotal up to ~9 trillion).
- [ ] **Consensus winner selection:** Highest-count non-null type that passes threshold. If multiple types pass threshold with equal counts, apply the widening lattice tie-breaker: prefer the wider type (`string` > `number` > `integer` > `boolean` > `boolean-encoded-string`). This ensures determinism at low thresholds. See ADR-006.
- [ ] **Type mapping (§6.1.1):**
  - `"integer"` → `viz:QuantitativeType`, `numericPrecision: "integer"`
  - `"number"` → `viz:QuantitativeType`, `numericPrecision: "float"`
  - `"boolean"` → `viz:BooleanType`
  - `"boolean-encoded-string"` → `viz:BooleanType`
  - `"string"` → `viz:NominalType`
  - `"null"` → `viz:UnknownType`
- [ ] **Precision override (§6.1.1):** When consensus winner is `"integer"` but BIBSS `primitiveType` was widened to `"number"` or `"string"`, still assign `numericPrecision: "integer"` (consensus winner determines precision, not lattice).
- [ ] **No-consensus fallback (§6.1):** If no type passes threshold, assign `viz:NominalType`. Set `viz:consensusScore` to the highest single-type ratio. Emit `SAS-001` with context: `field`, `highestConsensus`, `highestType`.
- [ ] **Score formatting (§2.6):** `viz:consensusScore` = `(numerator / denominator).toFixed(6)`. Always a JSON **string** matching `/^\d+\.\d{6}$/`. For denominator === 0, emit `"0.000000"`.
- [ ] **Integer companions:** `sas:consensusNumerator` = count of winning type, `sas:consensusDenominator` = `nonNullTotal`. Both JSON integers.
- [ ] **`sas:structuralType`** = BIBSS `primitiveType` (recorded before SAS interpretation)
- [ ] **Rule name:** `"consensus-promotion"`
- [ ] **Threshold boundary correctness (§13.2):**
  - `{ "integer": 19, "string": 1 }`, occ 20, threshold 0.95 → `19 * 1_000_000 = 19_000_000 >= 950_000 * 20 = 19_000_000` → **passes** (exactly at threshold)
  - `{ "integer": 189, "string": 11 }`, occ 200, threshold 0.95 → `189 * 1_000_000 = 189_000_000 >= 950_000 * 200 = 190_000_000` → **fails** (0.945)
- [ ] `npm run build` compiles without errors

---

### 1.7 Implement Temporal Detection

**Status:** Not Started | **Priority:** Medium | **Spec:** §6.2

Implement name-based temporal heuristic and SNP manifest evidence path.

**Acceptance Criteria:**

- [ ] **Trigger condition (§6.2):** Rule applies only when the field's *current* assigned type (after null vocabulary adjustment and consensus) is `viz:NominalType`. If null vocabulary reclassification shifted consensus away from NominalType (e.g., to QuantitativeType), temporal detection does NOT run.
- [ ] **SNP evidence path (ADR-007):** If `snpManifest` contains an entry with `detail.type === "date_converted"` and `path === fieldName`: assign `viz:TemporalType` regardless of name matching. Rule name `"temporal-detection-snp-evidence"`, emit `SAS-009` (context: `field`). **Note:** SNP manifest uses `rule: "date-normalization"` with `detail.type: "date_converted"` — match on `detail.type`, not on `rule`.
- [ ] **Name-based path:** If `primitiveType` is `"string"` AND current assigned type is `viz:NominalType`: test field name against `config.temporalNamePattern`
  - Match → assign `viz:TemporalType`, rule name `"temporal-detection"`, emit `SAS-010` (context: `field`, `matchedPattern`)
  - No match → field remains `viz:NominalType`
- [ ] **SNP evidence takes precedence** over name-match (both produce TemporalType, but SNP evidence is checked first as it's direct evidence — and uses a distinct rule name for provenance)
- [ ] Default `temporalNamePattern`: `/(?:date|time|timestamp|created|updated|modified|born|died|started|ended|expires?)(?:_at|_on|_time)?$/i`
- [ ] `npm run build` compiles without errors

---

### 1.8 Implement Boolean Pair Detection (Configured)

**Status:** Not Started | **Priority:** Medium | **Spec:** §6.3

Implement the configured boolean pair override for string-typed fields.

**Acceptance Criteria:**

- [ ] **Trigger condition (§6.3):** Rule applies after temporal detection, only to fields where BIBSS `primitiveType` is `"string"` AND current assigned type is still `viz:NominalType` (not already overridden by temporal or consensus). Numeric or boolean BIBSS types are NOT eligible.
- [ ] **Config lookup:** Check if field name (lowercased) exists in `config.booleanFields` (keys also lowercased). Case-insensitive comparison on both sides.
- [ ] If matched: assign `viz:BooleanType`. Rule name `"boolean-pair-configured"`.
- [ ] If not matched: no change (field continues down the cascade)
- [ ] Boolean pair detection from BIBSS `boolean-encoded-string` in `typeDistribution` is handled by consensus promotion (§6.1.1), NOT by this rule — this rule is config-only
- [ ] `npm run build` compiles without errors

---

### 1.9 Implement Null Vocabulary Reclassification (Configured)

**Status:** Not Started | **Priority:** Medium | **Spec:** §6.4, §9.3

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

- [ ] **Sources:** `config.nullVocabulary` (field-specific, keyed by field name case-insensitive) and `config.globalNullVocabulary` (applied to all fields). Field-specific entries and global entries are combined (union).
- [ ] **Value matching:** Case-insensitive, whitespace-trimmed comparison of null vocabulary strings
- [ ] **Reclassification effect:** When null vocabulary is applied to a field, the `"string"` count in `typeDistribution` is reduced by the number of null vocabulary matches (capped at the actual string count). The `"null"` count is increased by the same amount. Returns an adjusted copy — does NOT mutate the original CISM.
- [ ] **Returns adjusted counts:** The function returns the adjusted `typeDistribution`, `nullCount`, and `nonNullTotal` for consensus to consume. It does NOT run consensus itself.
- [ ] **SAS-008 diagnostic:** Emitted when reclassification changes the consensus winner (determined after consensus runs on adjusted counts vs. what consensus would have produced on original counts). Context: `field`, `beforeType`, `afterType`, `reclassifiedCount`.
- [ ] Rule name: `"null-vocabulary-configured"` (set on the output field when null vocab was applied AND changed the consensus winner)
- [ ] **Spec worked example (§9.3):** `{ "integer": 95, "string": 5 }`, occ 100, all 5 strings are "N/A" → reclassified to `{ "integer": 95, "null": 5 }` → nonNullTotal = 95 → consensus 1.0 → `viz:QuantitativeType`
- [ ] `npm run build` compiles without errors

---

### 1.10 Implement Structural Passthrough and Unknown Assignment

**Status:** Not Started | **Priority:** Medium | **Spec:** §6.5, §6.6, §9.2

Implement the two fallback rules that handle fields not caught by higher-priority rules.

**Acceptance Criteria:**

- [ ] **Structural passthrough (§6.5):** When no prior rule assigned a type, map BIBSS `primitiveType` directly via §6.1.1 table. Set `viz:consensusScore: "1.000000"`, `sas:consensusNumerator` = total count for that type, `sas:consensusDenominator` = nonNullTotal. Rule name: `"structural-passthrough"`.
- [ ] **Unknown assignment (§6.6):** When `primitiveType` is `"null"` (all values null) OR node `kind` is `"union"`, assign `viz:UnknownType`. Emit `SAS-002` (context: `field`, `reason`). Rule name: `"unknown-assignment"`. For all-null: `consensusScore: "0.000000"`, numerator: 0, denominator: 0.
- [ ] **Nested structure handling (§9.2):** For any top-level `SchemaEdge` whose target `SchemaNode` has `kind: "object"` or `kind: "array"`, skip it (do not produce a `viz:DataField`), emit `SAS-003` (context: `field`, `kind`).
- [ ] **Union handling (§9.2):** Top-level `SchemaEdge` with target `kind: "union"` → `viz:UnknownType` via §6.6.
- [ ] `npm run build` compiles without errors

---

### 1.11 Implement SNP Manifest Annotations

**Status:** Not Started | **Priority:** Medium | **Spec:** §4.2, §5.3, ADR-007

Attach normalization provenance from the optional SNP manifest to output fields.

> **SNP manifest matching (ADR-007):** The SNP manifest `rule` field is the SNP rule name (e.g., `"currency-stripping"`, `"date-normalization"`). The `detail.type` field identifies the specific transformation (e.g., `"currency_stripped"`, `"date_converted"`). SAS matches on `detail.type` and `path`, not on `rule`.

**Acceptance Criteria:**

- [ ] If `snpManifest` is provided, for each `viz:DataField`:
  - If manifest contains an entry with `detail.type === "currency_stripped"` and `path === fieldName` → set `viz:wasNormalized: true`
  - If manifest contains an entry where percentage stripping is indicated (check for `detail.type === "percent_stripped"` OR `detail.originalValue` containing a `%` character alongside `detail.type === "currency_stripped"`) and `path === fieldName` → set `viz:wasPercentage: true`
- [ ] If `snpManifest` is absent or no entries match a field: `viz:wasNormalized` and `viz:wasPercentage` are **omitted entirely** (not set to false) — §2.6 absent vs null
- [ ] Path matching between manifest `path` and `SchemaEdge.name` is exact string match
- [ ] `npm run build` compiles without errors

---

### 1.12 Assemble Field Processing Cascade

**Status:** Not Started | **Priority:** High | **Spec:** §9.1 steps 4–5, §5.2, §5.3

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

- [ ] **Cascade wired in the order above** — null vocab before consensus, temporal/boolean only after consensus assigns NominalType
- [ ] **SAS-008 detection:** Compare what consensus would produce with original counts vs. adjusted counts. If the type changed, emit SAS-008 and set rule name to `"null-vocabulary-configured"`.
- [ ] **viz:hasField array** preserves CISM SchemaEdge order — §2.6
- [ ] **All @id values in viz:hasField are unique** — §13.3 item 15
- [ ] **Every DataField has exactly one viz:hasDataType** — §13.3 item 5
- [ ] **Required DataField properties always present:** `@id`, `@type`, `viz:fieldName`, `viz:hasDataType`, `viz:consensusScore`, `sas:consensusNumerator`, `sas:consensusDenominator`, `sas:alignmentRule`, `sas:structuralType` — §5.3
- [ ] **Conditional DataField properties** present only when applicable: `viz:numericPrecision` (Quantitative only), `viz:wasNormalized` / `viz:wasPercentage` (SNP manifest only) — §5.3
- [ ] **Standalone mode fields:** `sas:fandawsConsulted: false` on every field. No `sas:fandawsMatch` property. — §5.4, ADR-004
- [ ] `npm run build` compiles without errors

---

### 1.13 JCS Canonicalization and Serialization

**Status:** Not Started | **Priority:** High | **Spec:** §2.6, §9.1 steps 6–7

Ensure the in-memory `DatasetSchemaLD` object is serialized to JCS-canonical bytes.

**Acceptance Criteria:**

- [ ] **Key ordering (§2.6):** All JSON objects have keys sorted lexicographically (Unicode code point order). Includes `@context`, each `DataFieldLD`, and all nested objects (e.g., `viz:hasDataType: { "@id": "..." }`).
- [ ] **Boolean values:** `true`/`false` serialized as JSON literals, not strings — §2.6
- [ ] **Null handling (§2.6):** Absent properties omitted entirely (never set to `null`). Explicit nulls (like `sas:fandawsMatch: null` in enriched mode) use JSON `null`.
- [ ] **`stableStringify` in `canonicalize.ts`** produces JCS-equivalent bytes — verify the existing implementation handles nested `@id` objects correctly, update if needed
- [ ] **Update CLI entry point (`src/kernel/index.ts`)** to call `align()` instead of `transform()`
- [ ] `npm run build` compiles without errors
- [ ] `npm run test:purity` passes (kernel imports nothing from adapters/composition)

---

### 1.14 Update Spec Tests and Example Fixtures

**Status:** Not Started | **Priority:** High | **Spec:** §13.1, ARCHITECTURE.md

Update the template's 3 spec tests to exercise `align()` instead of `transform()`, and replace example fixtures.

**Acceptance Criteria:**

- [ ] **`examples/input.jsonld`** replaced with a representative CISM (based on Appendix B: 3-column CSV with Region/Revenue/created_at)
- [ ] **`examples/expected-output.jsonld`** replaced with the expected `viz:DatasetSchema` output for the CISM input in standalone mode (no Fandaws — `sas:fandawsConsulted: false`, no `sas:fandawsMatch`)
- [ ] **`tests/determinism.test.ts` updated:**
  - Calls `align(cism, rawHash)` instead of `transform(input)`
  - Test 1: `deepStrictEqual` across two invocations — §13.1
  - Test 2: `stableStringify` produces identical strings — §13.1
  - Test 3: Input immutability (CISM not mutated)
- [ ] **`tests/no-network.test.ts` updated:**
  - Calls `align(cism, rawHash)` instead of `transform(input)`
  - Stubs fetch and XMLHttpRequest — unchanged behavior
- [ ] **`tests/snapshot.test.ts` updated:**
  - Reads updated `examples/input.jsonld` and `examples/expected-output.jsonld`
  - Calls `align()` instead of `transform()`
  - Compares canonicalized output
- [ ] **All 3 spec tests pass:** `npm test` exits 0
- [ ] **Purity check passes:** `npm run test:purity` exits 0

---

### 1.15 Write Domain Tests — Consensus and Type Mapping

**Status:** Not Started | **Priority:** High | **Spec:** §13.2

Write domain-specific tests for consensus promotion, the core algorithm.

**Acceptance Criteria:**

Test file: `tests/consensus.test.ts`

- [ ] **Consensus promotion (integer):** `{ "integer": 95, "string": 5 }`, occ 100 → `viz:QuantitativeType`, consensus `"0.950000"` — §13.2
- [ ] **Consensus below threshold:** `{ "integer": 94, "string": 6 }`, occ 100 → `viz:NominalType`, SAS-001 — §13.2
- [ ] **Consensus with nulls:** `{ "null": 10, "integer": 85, "string": 5 }`, occ 100 → nonNullTotal 90, consensus 85/90 = 0.944 → `viz:NominalType`, SAS-001 — §13.2
- [ ] **Consensus exact threshold:** `{ "integer": 95, "string": 5 }`, occ 100 → consensus exactly 0.95 → **passes** (≥, not >) — §13.2
- [ ] **Integer threshold boundary (passes):** `{ "integer": 19, "string": 1 }`, occ 20 → `19 * 1M >= 950K * 20` → passes — §13.2
- [ ] **Integer threshold boundary (fails):** `{ "integer": 189, "string": 11 }`, occ 200 → `189M < 190M` → fails — §13.2
- [ ] **Consensus tie-breaking (ADR-006):** `{ "integer": 50, "number": 50 }`, occ 100, threshold 0.50 → both pass with equal count → `number` wins (wider in lattice) → `viz:QuantitativeType`, `numericPrecision: "float"`
- [ ] **Structural passthrough (integer):** `{ "integer": 100 }`, occ 100 → QuantitativeType, score `"1.000000"`, precision `"integer"` — §13.2
- [ ] **Structural passthrough (boolean):** `{ "boolean": 100 }`, occ 100 → BooleanType — §13.2
- [ ] **Structural passthrough (string, no temporal):** `{ "string": 100 }`, occ 100, field `"description"` → NominalType — §13.2
- [ ] **Numeric precision (integer):** primitiveType `"integer"` → `"integer"` — §13.2
- [ ] **Numeric precision (float):** primitiveType `"number"` → `"float"` — §13.2
- [ ] **Numeric precision (consensus override):** BIBSS widened to `"number"`, but 98% integer → `"integer"` — §13.2
- [ ] **ConsensusScore string format:** Always a JSON string (quoted) matching `/^\d+\.\d{6}$/`. `1.0` emitted as `"1.000000"` — §13.2
- [ ] **Numerator/denominator integers:** `sas:consensusNumerator` and `sas:consensusDenominator` present as exact integers — §13.2
- [ ] **Min observation (below):** `{ "null": 9997, "integer": 3 }`, occ 10000, min 5 → nonNull 3 < 5 → UnknownType, SAS-012 — §13.2
- [ ] **Min observation (at threshold):** `{ "null": 95, "integer": 5 }`, occ 100, min 5 → nonNull 5 >= 5 → proceeds — §13.2
- [ ] **Min observation (single):** `{ "null": 9999, "integer": 1 }`, occ 10000 → nonNull 1 < 5 → UnknownType, SAS-012 — §13.2
- [ ] **Unknown (all null):** `{ "null": 100 }`, occ 100 → UnknownType, SAS-002 — §13.2
- [ ] **Unknown (union):** node kind `"union"` → UnknownType, SAS-002 — §13.2
- [ ] **CISM count mismatch:** typeDistribution sum > occurrences → SAS-013, UnknownType — §13.2
- [ ] **Unrecognized key:** `{ "custom_type": 50 }` → treated as string, SAS-014 — §13.2
- [ ] **boolean-encoded-string recognized:** `{ "boolean-encoded-string": 100 }`, occ 100 → BooleanType, no SAS-014 — §6.1.1, §6.1.2
- [ ] `npm test` passes

---

### 1.16 Write Domain Tests — Temporal, Boolean, Null Vocab, Normalization

**Status:** Not Started | **Priority:** High | **Spec:** §13.2

Write domain-specific tests for the remaining static rules.

**Acceptance Criteria:**

Test file: `tests/rules.test.ts`

- [ ] **Temporal (name match):** field `"created_at"`, primitiveType `"string"` → TemporalType, rule `"temporal-detection"`, SAS-010 — §13.2
- [ ] **Temporal (SNP evidence):** manifest with `detail.type: "date_converted"` → TemporalType, rule `"temporal-detection-snp-evidence"`, SAS-009 — §13.2, ADR-007
- [ ] **Temporal (no match):** field `"description"`, primitiveType `"string"` → NominalType — §13.2
- [ ] **Temporal not triggered after null vocab shift:** field with `{ "integer": 95, "string": 5 }`, null vocab reclassifies strings → consensus assigns QuantitativeType → temporal detection does NOT run (current type is not NominalType)
- [ ] **Boolean pair (configured):** `booleanFields: { "is_active": ["Y", "N"] }`, field `"is_active"` → BooleanType, rule `"boolean-pair-configured"` — §13.2
- [ ] **Boolean pair (not configured):** field `"is_active"`, no config → NominalType — §13.2
- [ ] **Null vocabulary (field-specific):** `nullVocabulary: { "result": ["N/A"] }`, field with `{ "integer": 95, "string": 5 }` → reclassify, consensus rises → QuantitativeType, SAS-008 — §13.2
- [ ] **Null vocab cascade order:** Null vocab adjusts counts, then consensus runs on adjusted counts — not the other way around. Verify by checking that the consensus numerator/denominator reflect the adjusted nonNullTotal.
- [ ] **SNP currency annotation:** manifest with `detail.type: "currency_stripped"` → `viz:wasNormalized: true` — §13.2, ADR-007
- [ ] **SNP percentage annotation:** manifest with percentage indicator → `viz:wasPercentage: true` — §13.2, ADR-007
- [ ] **Nested structure skipped:** CISM with nested object property → SAS-003 — §13.2
- [ ] `npm test` passes

---

### 1.17 Write Domain Tests — Output Structure and Invariants

**Status:** Not Started | **Priority:** High | **Spec:** §13.2, §13.3

Write tests validating the output JSON-LD structure, field IRI normalization, and property-based invariants.

**Acceptance Criteria:**

Test file: `tests/output.test.ts`

- [ ] **Field IRI normalization:** `"Revenue"` → `viz:field/revenue`, `"First Name"` → `viz:field/first-name` — §13.2
- [ ] **Field IRI collision:** Two fields normalizing to same slug → second gets `-1` suffix — §13.2
- [ ] **Raw hash propagation:** `rawHash` appears as `viz:rawInputHash` in output — §13.2
- [ ] **JCS canonicalization:** Output keys are lexicographically sorted — §13.2
- [ ] **SASResult status on fatal:** CISM version `"1.0"` → `status: "error"`, schema absent, SAS-007 — §13.2
- [ ] **Schema-level fatal (SAS-007):** version `"1.0"` → `status: "error"`, no schema, SAS-007 in diagnostics — §13.2
- [ ] **Field-level fatal (SAS-013):** One field has count mismatch → that field UnknownType, but `status: "ok"`, schema present, other fields intact — §13.2
- [ ] **Property invariant 1 (§13.3):** `align()` terminates and never throws for any valid CISM
- [ ] **Property invariant 2:** status is `"ok"` or `"error"`
- [ ] **Property invariant 3:** If `"ok"`, every primitive SchemaEdge produces exactly one DataField (nested/array edges skipped per §9.2)
- [ ] **Property invariant 4:** If `"error"`, schema absent, at least one fatal diagnostic
- [ ] **Property invariant 5:** Every DataField has exactly one `viz:hasDataType`
- [ ] **Property invariant 6:** Every `viz:consensusScore` matches `/^\d+\.\d{6}$/` and is in `["0.000000", "1.000000"]`
- [ ] **Property invariant 7:** `numerator <= denominator`, both non-negative integers
- [ ] **Property invariant 8:** Every DataField has `sas:alignmentRule` string
- [ ] **Property invariant 11:** Output `viz:rawInputHash` equals input `rawHash`
- [ ] **Property invariant 12:** If `nonNullTotal < minObservationThreshold`, type is UnknownType
- [ ] **Property invariant 14:** `viz:hasField` preserves CISM SchemaEdge order
- [ ] **Property invariant 15:** All `@id` values in `viz:hasField` are unique
- [ ] `npm test` passes

---

### 1.18 Final Validation and Stabilization

**Status:** Not Started | **Priority:** High

End-to-end verification that all pieces work together.

**Acceptance Criteria:**

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm test` — all spec tests (determinism, no-network, snapshot) pass
- [ ] `npm test` — all domain tests (consensus, rules, output) pass
- [ ] `npm run test:purity` — kernel imports nothing from adapters/composition
- [ ] Kernel contains no references to `Date.now()`, `new Date()`, `Math.random()`, `crypto.getRandomValues()`, `process.env`, `fetch`, `XMLHttpRequest`
- [ ] Example fixtures (`input.jsonld`, `expected-output.jsonld`) match actual `align()` output byte-for-byte (verified by snapshot test)
- [ ] ROADMAP.md updated: all Phase 1 tasks marked complete
- [ ] DECISIONS.md updated with any new decisions made during implementation

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
