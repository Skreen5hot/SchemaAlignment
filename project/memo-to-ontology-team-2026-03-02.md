# Memorandum: SAS Term Registry Update & BridgeOntology.ttl Reconciliation

**From:** SAS Development Team
**To:** FBO Ontology Team
**Date:** 2026-03-02
**Re:** Registry expanded to 35 terms; TTL reconciliation; two minor corrections

---

## 1. Summary

A kernel code audit of `src/kernel/transform.ts` identified **6 additional SAS output terms** not present in the original 29-term registry. The registry has been updated to **35 entries** (18 `viz:` + 17 `sas:`).

Cross-referencing the updated registry against `BridgeOntology.ttl` (FBO v1.1) confirms that **all 35 terms are already mapped in the TTL**. The ontology implementation is complete and ahead of the registry documentation. Two minor corrections to TTL comments are requested below.

---

## 2. New Terms Added to Registry

The original registry was built empirically from 6 SME test outputs. The kernel code audit found 6 conditional terms that were absent from those tests because the optional inputs that trigger them were not exercised.

### Group 1 — SNP Manifest Properties (V16, V17)

These appear on `viz:DataField` when the optional SNP manifest (SAS spec §4.2) records normalization activity for a field.

| Registry # | SAS Term | TTL Mapping | TTL Line |
|---|---|---|---|
| V16 | `viz:wasNormalized` | `fbo:wasNormalized` (annotation property) | 922 |
| V17 | `viz:wasPercentage` | `fbo:wasPercentage` (annotation property) | 929 |

**Already in TTL:** Yes. Typed as `owl:AnnotationProperty` per DL-006. No action required.

### Group 2 — Sampling Property (V18)

Appears on `viz:DatasetSchema` when CISM `sampling.applied` is `true`.

| Registry # | SAS Term | TTL Mapping | TTL Line |
|---|---|---|---|
| V18 | `viz:rowsInspected` | `fbo:hasRowsInspected` (data property) | 836 |

**Already in TTL:** Yes. No action required.

### Group 3 — Boolean Pair Inner Properties (S15, S16, S17)

These appear inside `sas:booleanPairs` array entries when boolean pair mappings are configured.

| Registry # | SAS Term | TTL Mapping | TTL Line |
|---|---|---|---|
| S15 | `sas:fieldName` | `fbo:forFieldName` (data property on `fbo:BooleanPairMapping`) | 886 |
| S16 | `sas:trueValue` | `fbo:hasTrueValue` (data property on `fbo:BooleanPairMapping`) | 894 |
| S17 | `sas:falseValue` | `fbo:hasFalseValue` (data property on `fbo:BooleanPairMapping`) | 902 |

**Already in TTL:** Yes, including the `fbo:BooleanPairMapping` class (line 565) and `fbo:hasBooleanPairMapping` object property (line 725). No action required.

---

## 3. Corrections Requested

### 3.1 — `fbo:hasAlignmentMode` known values (TTL line 948)

**Current:** `Known values: 'standalone', 'full-pipeline'`
**Correct:** `Known values: 'standalone', 'enriched'`

The SAS kernel typedef ([transform.ts:173](src/kernel/transform.ts#L173)) defines `sas:alignmentMode` as `"standalone" | "enriched"`. The value `"full-pipeline"` does not exist in any SAS output. Please update the `rdfs:comment` on `fbo:hasAlignmentMode`.

### 3.2 — `fbo:producedByRule` known values (TTL line 802)

**Current comment lists 5 values:**
`'consensus-promotion', 'temporal-detection', 'boolean-pair-configured', 'null-vocabulary-configured', 'unknown-assignment'`

**Complete list from kernel (8 values):**
`'consensus-promotion', 'temporal-detection', 'temporal-detection-snp-evidence', 'boolean-pair-configured', 'null-vocabulary-configured', 'structural-passthrough', 'unknown-assignment', 'cism-validation-failed'`

Detail for the 3 missing values (from kernel source, for Phase 2 ABox and Phase 3 test authoring):

| Rule Value | Assigns | FBO Variable Type | Diagnostic | Trigger Condition |
|---|---|---|---|---|
| `'temporal-detection-snp-evidence'` | `viz:TemporalType` | `fbo:TemporalVariable` | SAS-009 (info) | SNP manifest contains entry with `path === fieldName` and `detail.type === "date_converted"`. Checked before name-pattern heuristic. |
| `'structural-passthrough'` | Per `primitiveType` via TYPE_MAP | Varies (see below) | None | All non-null typed values were eliminated (e.g., by null vocabulary reclassification). Falls back to BIBSS `primitiveType` mapping. If `nonNullTotal > 0`, score = 1.000000; if `nonNullTotal === 0`, assigns `viz:UnknownType` with score 0.000000. |
| `'cism-validation-failed'` | `viz:UnknownType` | `fbo:IndeterminateVariable` | SAS-013 (fatal) | CISM consistency check fails: negative occurrences, `typeDistribution` sum exceeds occurrences, or null count exceeds occurrences. Score = 0.000000, numerator = 0, denominator = 0. |

**CQ-12 implication for `'cism-validation-failed'`:** This is a second path to `fbo:IndeterminateVariable` alongside `'unknown-assignment'`. CQ-12 ("which fields could not be typed?") must account for both rule values. The distinction: `'unknown-assignment'` means "no evidence available" (all-null or union kind); `'cism-validation-failed'` means "evidence was present but internally inconsistent" (upstream profiler bug).

**`'structural-passthrough'` type mapping:** The assigned type depends on `primitiveType`:
- `"string"` → `viz:NominalType` (`fbo:NominalVariable`)
- `"integer"` → `viz:QuantitativeType` / precision `"integer"` (`fbo:QuantitativeVariable`)
- `"number"` → `viz:QuantitativeType` / precision `"float"` (`fbo:QuantitativeVariable`)
- `"boolean"` → `viz:BooleanType` (`fbo:BooleanVariable`)
- unrecognized key → falls back to `viz:NominalType` (`fbo:NominalVariable`)

This rule fires only when no non-null typed values remain in the type distribution after null vocabulary adjustment — a rare edge case where all string values were reclassified to null but the field still has non-null non-string values, or where the type distribution was empty to begin with. It does NOT fire for normal fields that simply lack consensus (those get `'consensus-promotion'` with SAS-001).

Please update the `rdfs:comment` on `fbo:producedByRule` to include all 8 values.

---

## 4. STATO IRI Confirmation

DL-002 correctly identifies that `STATO:0000255` ("between group comparison objective") is NOT the binary/dichotomous variable class. The TTL correctly uses `STATO:0000090` (line 390).

The original SAS Term Registry (as produced by the FBO team) already used `STATO:0000090` in the V6 row — the correction from DL-002 was applied during registry authoring. The stale `STATO:0000255` reference existed only in the SAS v2.0 spec text (§5.9), which predates DL-002. We have noted this for the next spec revision.

No action required from the ontology team. This is informational.

---

## 5. Updated Counts

| Category | Before | After |
|---|---|---|
| Total registry entries | 29 | 35 |
| `viz:` terms | 15 | 18 |
| `sas:` terms | 14 | 17 |
| Mapped in TTL | 29 | 35 |
| TTL gaps remaining | 0 | 0 |
| TTL comment corrections | — | 2 |

---

## 6. Attachments

The following documents have been updated in `project/`:

| Document | Status |
|---|---|
| `sas-term-registry-for-fbo.md` | Updated to 35 terms. Gap analysis will be revised to reflect TTL completeness. |
| `fbo-integration-brief-for-sas-team.md` | Pending update to 35-term tables. |
| `BridgeOntology.ttl` | Two comment corrections requested (§3.1, §3.2 above). |
| `FBO-decision-log.md` | No changes needed. DL-002 already documents the STATO correction. |

---

## 7. Acknowledgment

The BridgeOntology.ttl implementation is thorough. All 6 newly-identified terms were already present in the TTL — the gap-fill sections (Step 1.5, annotation properties block) covered them before this registry update was performed. The decision log (particularly DL-002, DL-006, DL-009) demonstrates careful attention to OWL 2 DL correctness. The two requested corrections are comment-level only; no axioms or class structures need to change.
