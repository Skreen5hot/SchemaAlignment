# Architecture Decision Records

<!--
  Log decisions here so they survive between AI sessions.
  An AI agent has no memory of yesterday. This file IS its memory.

  Format: Date | Decision | Context | Consequences
-->

## ADR-001: Use JSON-LD Deterministic Service Template

**Date:** [TODAY]

**Decision:** Adopt the JSON-LD Deterministic Service Template as the base architecture.

**Context:** We need a service that produces deterministic, reproducible transformations on structured data. The template provides a pure kernel with spec tests, layered boundaries (kernel/composition/adapters), and zero runtime dependencies.

**Consequences:**
- All transformation logic lives in `src/kernel/transform.ts` as pure functions
- Kernel MUST NOT perform I/O, reference time, randomness, or environment state
- Infrastructure (HTTP, persistence, scheduling) lives in `src/adapters/`
- Spec tests (determinism, no-network, snapshot, purity) MUST pass before any merge

---

## ADR-002: SAS v2.0 as Authoritative Specification

**Date:** 2026-03-02

**Decision:** `project/sas-v2.0.md` is the authoritative project specification, replacing the template's `project/SPEC.md`.

**Context:** The template ships a placeholder SPEC.md. Our project implements the Schema Alignment Service defined in sas-v2.0.md. The old SPEC.md has been deleted.

**Consequences:**
- All domain logic derives from `project/sas-v2.0.md`
- CLAUDE.md and ROADMAP.md reference sas-v2.0.md instead of SPEC.md
- The template's identity transform and example fixtures will be replaced with SAS-specific types and logic

---

## ADR-003: Define CISM Types Locally in Kernel

**Date:** 2026-03-02

**Decision:** Define `CISMRoot`, `SchemaNode`, `SchemaEdge`, and all SAS-specific TypeScript interfaces locally in the kernel.

**Context:** The SAS spec references BIBSS types (CISMRoot, SchemaNode, etc.) that don't exist in this repo. No shared types package is available. Adding a runtime dependency is prohibited without Orchestrator approval.

**Consequences:**
- All input/output interfaces live in `src/kernel/` as local type definitions
- No external runtime dependency required
- Types must be kept in sync with sas-v2.0.md manually

---

## ADR-004: Defer Fandaws Enrichment to Phase 1v2

**Date:** 2026-03-02

**Decision:** Phase 1 implements the static core only (standalone mode). Fandaws enrichment is deferred to a second iteration.

**Context:** The SAS spec defines two modes: standalone (static rules) and enriched (static + Fandaws). Building and stabilizing the static core first reduces scope and establishes a solid foundation. Fandaws adds complexity (epistemic matrix, type veto, concept resolution) that is better layered on after the core is proven.

**Consequences:**
- Phase 1 implements: consensus promotion, temporal detection, boolean pair (configured), null vocabulary (configured), structural passthrough, unknown assignment
- Phase 1 does NOT implement: FandawsScope interface, type override/veto, epistemic matrix, metric hints
- Output fields will carry `sas:fandawsConsulted: false` and omit all Fandaws annotations
- `align()` signature accepts `fandaws?` parameter but ignores it in Phase 1
- Test cases for Fandaws-specific behavior are deferred

---

## ADR-005: Refactor Template API from `transform()` to `align()`

**Date:** 2026-03-02

**Decision:** Replace the template's `transform(input)` function with the SAS-specified `align(cism, rawHash, config?, snpManifest?, fandaws?)` API.

**Context:** The template provides a generic `transform(input: unknown)` identity function. The SAS spec defines a specific `align()` API with typed parameters (CISMRoot, rawHash, config, etc.) and a structured `SASResult` return type. The spec tests (determinism, snapshot) must be updated to call the new API.

**Consequences:**
- `src/kernel/transform.ts` is rewritten with the `align()` function and SAS types
- Spec tests are updated to exercise `align()` instead of `transform()`
- Example fixtures (`examples/input.jsonld`, `examples/expected-output.jsonld`) are replaced with CISM input and `viz:DatasetSchema` output
- The CLI entry point (`src/kernel/index.ts`) is updated to call `align()`

---

## ADR-006: Consensus Tie-Breaking on Equal Counts

**Date:** 2026-03-02

**Decision:** When two or more types have identical counts and both pass the consensus threshold, select the type that is higher in the BIBSS widening lattice: `string > number > integer > boolean > boolean-encoded-string`.

**Context:** §6.1 says "highest-count non-null type that passes threshold" but does not define behavior when counts are equal. With the default threshold of 0.95, ties that both pass are near-impossible (each type would need ≥95%). But `SASConfig.consensusThreshold` is configurable — at thresholds ≤0.50, equal-count ties become possible (e.g., `{ "integer": 50, "number": 50 }`, occ 100, threshold 0.50). Without a deterministic tie-breaker, output depends on `Object.keys` iteration order, breaking the §2.2 determinism contract.

**Consequences:**
- The widening lattice tie-breaker is deterministic and consistent with BIBSS's structural conservatism (wider type is the safer default)
- This is a spec gap — SAS v2.0 does not define this case. This ADR serves as the normative decision until the spec is updated.
- Implementation: when selecting the consensus winner from types that pass threshold, sort candidates by count descending, then by lattice position descending (string=5, number=4, integer=3, boolean=2, boolean-encoded-string=1). First element wins.

---

## ADR-007: SNP Manifest Matching Uses `detail.type`, Not `rule`

**Date:** 2026-03-02

**Decision:** When matching SNP manifest entries to fields, use `detail.type` for classification (e.g., `"currency_stripped"`, `"date_converted"`) and `path` for field matching. The manifest `rule` field (e.g., `"currency-stripping"`, `"date-normalization"`) identifies the SNP rule that fired but is not used for SAS matching logic.

**Context:** The SAS spec §4.2 describes manifest matching at a high level. The SNP v1.3 spec defines the actual manifest structure: `rule` is the SNP rule name (hyphenated, gerund form), while `detail.type` is the specific transformation applied. SAS needs `detail.type` to distinguish currency stripping from percentage stripping (both produced by the `"currency-stripping"` rule in SNP §4.5) and to identify date conversions (`detail.type: "date_converted"` from the `"date-normalization"` rule).

**Consequences:**
- Temporal detection (§6.2) checks: `manifest.detail?.type === "date_converted"` and `manifest.path === fieldName`
- Currency annotation: `manifest.detail?.type === "currency_stripped"` → `viz:wasNormalized: true`
- Percentage annotation: detected by checking if the original value in `manifest.detail` contained a `%` symbol, or by a `detail.type` of `"percent_stripped"` if SNP emits it distinctly. Implementation should check for both `"percent_stripped"` and presence of `%` in `detail.originalValue`.
- Field matching: `manifest.path === SchemaEdge.name` (exact string match)

---

## ADR-008: Spec Test Adaptation Authorized for Template-to-SAS Migration

**Date:** 2026-03-02

**Decision:** The three spec tests (`tests/determinism.test.ts`, `tests/no-network.test.ts`, `tests/snapshot.test.ts`) may be modified once to migrate from the template's `transform()` API to the SAS `align()` API.

**Context:** CLAUDE.md §4 prohibits modifying spec tests to prevent accidental weakening of the architectural contract. However, ADR-005 requires replacing `transform()` with `align()`, which means the spec tests must be updated to call the new function with CISM inputs instead of JSON-LD `Thing` inputs. Without this exception, the spec tests would be permanently locked to a function that no longer exists.

**Scope:**
- Update imports: `transform` → `align`, `JsonLdDocument` → `CISMRoot`
- Update function calls: `transform(input)` → `align(cism, rawHash)`
- Update inline test fixtures: JSON-LD `Thing` → minimal CISM object
- Update example fixtures: `examples/input.jsonld` → CISM, `examples/expected-output.jsonld` → `viz:DatasetSchema`

**Constraints — MUST NOT change:**
- Test **semantics**: determinism (same input → same output), no-network (kernel makes no network calls), snapshot (output matches expected fixture)
- Test **structure**: each test still verifies its architectural property
- Test **pass/fail criteria**: tests still exit 0 on pass, 1 on fail
- Test runner (`tests/run-tests.ts`): no modifications

**Trigger:** This authorization applies to Phase 1 task 1.14 only. Any subsequent spec test modifications require Orchestrator approval.

**Consequences:**
- Phase 1 task 1.14 can proceed without conflicting with CLAUDE.md §4
- CLAUDE.md §4 amended with a reference to this ADR
- After task 1.14, the spec test prohibition is fully reinstated
