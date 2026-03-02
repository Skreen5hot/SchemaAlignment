# FBO Decision Log

Tracks IRI corrections, design decisions, and deviations from the FBO v1.1 specification discovered during implementation.

---

## DL-001: IAO Assertion Class IRI Mismatch

**Date:** 2026-03-02
**Severity:** Critical (would cause incorrect class hierarchy)
**Spec Reference:** §4.4, §5.8

**Spec says:** `fbo:EvidencedTypeAssertion rdfs:subClassOf IAO:assertion (IAO:0000034)`
**Actual in our IAO import (iao.owl, 2022-11-07 release):** `obo:IAO_0000034` is labeled "time trigger" — a subclass of IAO_0000001, part of the PlanAndPlannedProcess branch. It is NOT an assertion class.

**Root cause:** The IAO import file does not contain a standalone "assertion" class. The spec's reference to IAO:0000034 as "assertion" appears to be based on a different IAO version or an external IAO documentation source that does not match the local import.

**Resolution:** Define a local intermediate class `fbo:InferenceAssertion` as `rdfs:subClassOf obo:IAO_0000030` (information content entity). `fbo:EvidencedTypeAssertion` subclasses `fbo:InferenceAssertion`. This preserves the Aristotelian genus-differentia structure ("an inference assertion that...") and provides a single re-parenting point.

**Future action:** When a corrected IAO import provides the actual assertion class, re-parent `fbo:InferenceAssertion` under it.

---

## DL-002: STATO Binary Variable IRI Mismatch

**Date:** 2026-03-02
**Severity:** Critical (would cause incorrect STATO alignment)
**Spec Reference:** §4.1, §5.9

**Spec says:** `fbo:BooleanVariable owl:equivalentClass STATO:0000255 (binary variable)`
**Actual in our STATO import (stato.owl, 2025-02-23 release):** `obo:STATO_0000255` is labeled "between group comparison objective" — a subclass of OBI_0000675. It has nothing to do with binary/dichotomous variables.

**Correct class:** `obo:STATO_0000090` ("dichotomous variable") — defined as a categorical variable with exactly 2 categories. Hierarchy: `STATO_0000090 rdfs:subClassOf STATO_0000087 (polychotomous variable) rdfs:subClassOf STATO_0000252 (categorical variable)`.

**Resolution:** `fbo:BooleanVariable owl:equivalentClass obo:STATO_0000090`. This correctly entails that BooleanVariable is a categorical variable (via STATO's own hierarchy), which matches the spec's intent.

---

## DL-003: has_input / has_output Not in BFO

**Date:** 2026-03-02
**Severity:** Medium (would cause unresolved property references)
**Spec Reference:** §6.2–6.6

**Spec says:** `BFO:has_input`, `BFO:has_output` used in process class restrictions.
**Actual:** BFO 2020 does not define `has_input` or `has_output`. These properties are defined in CCO's Extended Relation Ontology:
- `cco:ont00001921` = "has input" (rdfs:subPropertyOf `obo:BFO_0000057` has_participant)
- `cco:ont00001986` = "has output" (rdfs:subPropertyOf `obo:BFO_0000057` has_participant)

**Resolution:** Use the CCO properties. They are subproperties of BFO's `has_participant`, so all BFO-level reasoning about participation is preserved.

---

## DL-004: Provenance Chain Axiom Weakened for Standalone Mode

**Date:** 2026-03-02
**Severity:** High (Phase 3 blocker — standalone mode test would produce phantom inferences)
**Spec Reference:** §8.4, §9.2

**Spec says:** Every SemanticSchema must trace through NormalizedDataset:
```
fbo:SemanticSchema SubClassOf:
  fbo:derivedFrom some (fbo:StructuralSchema
    and (fbo:derivedFrom some (fbo:NormalizedDataset
      and (fbo:derivedFrom some fbo:RawDataset))))
```

**Problem:** Standalone mode (§9.2) has no NormalizationProcess and no NormalizedDataset. Under OWL's open-world assumption, HermiT would silently infer a phantom NormalizedDataset to satisfy the axiom, corrupting CQ-04 results.

**Resolution:** Weaken axiom to disjunction allowing both full-pipeline and standalone chains:
```
fbo:SemanticSchema SubClassOf:
  fbo:derivedFrom some (fbo:StructuralSchema
    and (fbo:derivedFrom some (
      (fbo:NormalizedDataset and (fbo:derivedFrom some fbo:RawDataset))
      or fbo:RawDataset)))
```

---

## DL-005: fbo:InferenceAssertion Intermediate Class

**Date:** 2026-03-02
**Severity:** Design improvement
**Spec Reference:** §4.4

**Rationale:** The spec's intent is that EvidencedTypeAssertion IS ontologically an assertion — "a sentence intended to be interpreted as true or false, with evidence." Subclassing directly under IAO_0000030 (ICE) loses this assertion semantics. The intermediate class `fbo:InferenceAssertion` preserves the genus and provides a single re-parenting point when the IAO import is corrected.

---

## DL-006: Annotation Properties for Pipeline Metadata Flags

**Date:** 2026-03-02
**Severity:** Design decision
**Spec Reference:** §5, §7, SAS Term Registry Group C

**Context:** Five boolean/string metadata properties (`fbo:wasNormalized`, `fbo:wasPercentage`, `fbo:fandawsConsulted`, `fbo:hasAlignmentMode`, `fbo:fandawsAvailable`) are typed as `owl:AnnotationProperty` rather than `owl:DatatypeProperty`.

**Rationale:** (1) None participate in any of the 16 competency questions — they carry pipeline metadata that is never the target of a class restriction or SPARQL filter in the spec. (2) The spec treats them as metadata annotations on individuals. (3) As annotation properties, they do not increase reasoner workload or interact with OWL 2 DL restrictions.

**Future action:** If future CQs or axioms require reasoning over these values, promote to `owl:DatatypeProperty` with appropriate domain/range.

---

## DL-007: fbo:isOutputOf and fbo:isInputTo Linked to CCO Property Hierarchy

**Date:** 2026-03-02
**Severity:** Medium (orphan properties not grounded in upper ontology)
**Spec Reference:** §7.1

**Problem:** `fbo:isOutputOf` and `fbo:isInputTo` were defined as standalone object properties with no `rdfs:subPropertyOf` link to CCO or BFO. This made them "orphan" properties disconnected from the realist property hierarchy.

**Resolution:** Added:
- `fbo:isOutputOf rdfs:subPropertyOf cco:ont00001816` ("is output of", inverse of CCO has_output, subPropertyOf BFO participates_in)
- `fbo:isInputTo rdfs:subPropertyOf cco:ont00001841` ("is input of", inverse of CCO has_input, subPropertyOf BFO participates_in)

This ensures that any triple using `fbo:isOutputOf` or `fbo:isInputTo` entails BFO-level participation, preserving upward compatibility with BFO/CCO reasoning.

---

## DL-008: Measurement Data Property Shortcut Acknowledged

**Date:** 2026-03-02
**Severity:** Design documentation
**Spec Reference:** §7.2

**Context:** `fbo:hasEvidenceStrength`, `fbo:hasConsensusNumerator`, and `fbo:hasConsensusDenominator` attach scalar measurement values directly to `fbo:EvidencedTypeAssertion` rather than routing through the full CCO measurement pattern (Act of Measuring → Measurement ICE → value specification → scalar).

**Rationale:** The shortcut is justified because FBO's `fbo:ConsensusComputation` already subclasses `cco:ont00000345` (Act of Measuring) and `fbo:TypeDistribution` subclasses `cco:ont00001070` (Measurement ICE). The structural alignment to CCO is preserved at the class level; the scalar attachment is a pragmatic simplification for SPARQL query efficiency (CQ-02, CQ-08, CQ-11).

**Future action:** If CCO adopts a standardized value specification pattern for measurement ICEs, consider migrating these data properties to that pattern.

---

## DL-009: Removed Global Domain from fbo:governedBy (Domain Poisoning)

**Date:** 2026-03-02
**Severity:** Critical (silent reasoner misclassification)
**Spec Reference:** §6.5, §7.1

**Problem:** `fbo:governedBy` declared `rdfs:domain fbo:FNSRProcess`. However, `fbo:ConsensusComputation` — which subclasses `cco:ont00000345` (Act of Measuring), NOT `fbo:FNSRProcess` — also uses `governedBy` via a local existential restriction. Under OWL's open-world assumption, the global domain acts as an inference rule: any individual using `governedBy` is inferred to be an `fbo:FNSRProcess`. This silently coerces `ConsensusComputation` into the `FNSRProcess` hierarchy, breaking BFO/CCO alignment and polluting the class graph.

**Secondary issue:** The global domain also implies that processes like `NormalizationProcess` could theoretically take a `governedBy` link to an alignment configuration, which is semantically nonsensical for the FNSR pipeline.

**Resolution:** Removed `rdfs:domain fbo:FNSRProcess` entirely from `fbo:governedBy`. Domain constraint is now enforced exclusively through local class-level restrictions (`owl:someValuesFrom`) on `fbo:SemanticAlignmentProcess` and `fbo:ConsensusComputation`. This is the standard OBO/CCO pattern for properties used across multiple branches of the BFO hierarchy.

---

*End of decision log. Update as new decisions are made during implementation.*
