# FBO Integration Brief for the SAS Development Team

**From:** Aaron Damiano (Semantic Architect)
**Date:** 2026-03-02
**Re:** FNSR Bridge Ontology (FBO) v1.1 — What it is, how your output maps to it, and what you need to do

---

## What Is FBO and Why Should You Care?

The FNSR Bridge Ontology is a formal OWL 2 DL ontology that grounds the vocabulary your service produces — every `viz:` and `sas:` term in your JSON-LD output — in established upper ontologies: BFO (Basic Formal Ontology), IAO (Information Artifact Ontology), CCO (Common Core Ontologies), and STATO (Statistical Methods Ontology).

In practical terms: when SAS says a field is `viz:QuantitativeType`, FBO says that same assertion is an instance of `fbo:QuantitativeVariable`, which is a subclass of STATO's continuous variable (`STATO:0000251`), which is a subclass of STATO's statistical variable (`STATO:0000258`), which is ultimately grounded in BFO's generically dependent continuant category. This chain means your type assignments are interoperable with any system that speaks BFO/STATO — which includes most biomedical ontologies, federal data standards, and an increasing number of enterprise knowledge graphs.

**The key point: FBO does not change SAS.** It provides a formal semantic interpretation of what SAS already produces. Your JSON-LD output is the source of truth. FBO is the bridge that makes that output legible to the wider ontology ecosystem.

---

## Your Output Is Already Well-Structured for This

The SAS Phase 1 review verified all 6 test outputs against FBO v1.1, and a subsequent kernel code audit identified 6 additional conditional terms (SNP manifest properties, sampling, boolean pair inner properties). The results are clean. All 35 terms in the SAS output vocabulary — including the 6 conditional terms absent from the test corpus — map directly to FBO classes and properties with no ambiguity.

The `sas:activeConfig` addition deserves specific mention. Before it existed, the SAS output was an `fbo:EvidencedTypeAssertion` disconnected from the `fbo:AlignmentConfiguration` that governed it — a provenance gap that actually caused incorrect findings in the first SME review (the reviewer assumed default config because the output didn't say otherwise). With `sas:activeConfig` present, every output is now self-describing, and the FBO mapping is complete.

---

## The Complete Term Mapping

There are 35 terms in the SAS output vocabulary. Every one has an FBO mapping. Here is the authoritative table.

### `viz:` Namespace — Semantic Output (18 terms)

| SAS Term | Role | FBO Mapping | FBO Type |
|---|---|---|---|
| `viz:DatasetSchema` | `@type` on root schema | `fbo:SemanticSchema` | Class |
| `viz:DataField` | `@type` on each field | `fbo:DataField` + `fbo:EvidencedTypeAssertion` | Classes (FBO separates the field from its type assertion) |
| `viz:NominalType` | `@id` in `hasDataType` | `fbo:NominalVariable` ≡ STATO categorical variable | Individual |
| `viz:QuantitativeType` | `@id` in `hasDataType` | `fbo:QuantitativeVariable` ⊑ STATO continuous variable | Individual |
| `viz:TemporalType` | `@id` in `hasDataType` | `fbo:TemporalVariable` (FBO extension — STATO has no temporal type) | Individual |
| `viz:BooleanType` | `@id` in `hasDataType` | `fbo:BooleanVariable` ≡ STATO dichotomous variable | Individual |
| `viz:UnknownType` | `@id` in `hasDataType` | `fbo:IndeterminateVariable` | Individual |
| `viz:field/{slug}` | `@id` on each DataField | Individual IRI for `fbo:DataField` instance | IRI pattern |
| `viz:hasField` | key (schema → fields) | `fbo:hasField` | Object property |
| `viz:hasDataType` | key (field → type) | `fbo:assertsVariableType` | Object property (functional) |
| `viz:fieldName` | key (string) | `fbo:hasFieldName` | Data property |
| `viz:consensusScore` | key (6-decimal string) | `fbo:hasEvidenceStrength` | Data property (xsd:decimal) |
| `viz:totalRows` | key (integer) | `fbo:hasTotalRows` | Data property |
| `viz:rawInputHash` | key (sha256:...) | `fbo:hasRawInputHash` | Data property |
| `viz:numericPrecision` | key (conditional) | `fbo:hasNumericPrecision` | Data property (only on QuantitativeType fields) |
| `viz:wasNormalized` | key (conditional) | `fbo:wasNormalized` | Annotation property (only when SNP manifest records currency stripping) |
| `viz:wasPercentage` | key (conditional) | `fbo:wasPercentage` | Annotation property (only when SNP manifest records percentage stripping) |
| `viz:rowsInspected` | key (conditional) | `fbo:hasRowsInspected` | Data property (only when sampling is applied) |

### `sas:` Namespace — Process Metadata (17 terms)

| SAS Term | Role | FBO Mapping | FBO Type |
|---|---|---|---|
| `sas:AlignmentConfiguration` | `@type` in activeConfig | `fbo:AlignmentConfiguration` ⊑ IAO directive information entity | Class |
| `sas:activeConfig` | key (schema-level) | `fbo:governedBy` (process → config link) | Object property |
| `sas:alignmentRule` | key per field | `fbo:producedByRule` | Data property |
| `sas:consensusNumerator` | key per field | `fbo:hasConsensusNumerator` | Data property |
| `sas:consensusDenominator` | key per field | `fbo:hasConsensusDenominator` | Data property |
| `sas:structuralType` | key per field | `fbo:hasStructuralType` | Data property |
| `sas:fandawsConsulted` | key per field | `fbo:fandawsConsulted` | Annotation property |
| `sas:alignmentMode` | key (schema-level) | `fbo:hasAlignmentMode` | Annotation property |
| `sas:fandawsAvailable` | key (schema-level) | `fbo:fandawsAvailable` | Annotation property |
| `sas:consensusThreshold` | key in activeConfig | `fbo:hasConsensusThreshold` | Data property |
| `sas:minObservationThreshold` | key in activeConfig | `fbo:hasMinObservationThreshold` | Data property |
| `sas:nullVocabulary` | key in activeConfig | `fbo:hasNullVocabulary` | Data property (multi-valued) |
| `sas:booleanPairs` | key in activeConfig | `fbo:hasBooleanPairMapping` → `fbo:BooleanPairMapping` | Object property + class |
| `sas:temporalNamePattern` | key in activeConfig | `fbo:hasTemporalNamePattern` | Data property |
| `sas:fieldName` | key in booleanPairs entries | `fbo:forFieldName` | Data property (on `fbo:BooleanPairMapping`) |
| `sas:trueValue` | key in booleanPairs entries | `fbo:hasTrueValue` | Data property (on `fbo:BooleanPairMapping`) |
| `sas:falseValue` | key in booleanPairs entries | `fbo:hasFalseValue` | Data property (on `fbo:BooleanPairMapping`) |

### Diagnostic Codes

SAS diagnostics (SAS-001 through SAS-014) are not individually modeled as OWL classes. FBO treats them as string-coded annotations on the `fbo:SemanticAlignmentProcess`. The diagnostic code vocabulary is documented in FBO §10 as an enumerated annotation value set. No changes needed to your diagnostic emission logic.

---

## What FBO Expects from SAS Output — The Contract

FBO's Phase 2 worked examples and competency questions (SPARQL queries) are written against your output format. Here are the structural invariants FBO relies on. Your Phase 1 test suite already passes all of these.

**Invariant 1: Every field has exactly one type assertion.** `viz:hasDataType` must contain exactly one `@id` reference. FBO maps this to a functional property (`fbo:assertsVariableType`) with exact cardinality 1.

**Invariant 2: Consensus score equals numerator divided by denominator.** `viz:consensusScore` = `sas:consensusNumerator` / `sas:consensusDenominator` within floating-point precision. FBO's CQ-11 competency question validates this.

**Invariant 3: Numerator is less than or equal to denominator.** Always. FBO uses `xsd:nonNegativeInteger` for both.

**Invariant 4: Consensus score is in [0.0, 1.0].** FBO's `fbo:hasEvidenceStrength` is `xsd:decimal` with this range constraint documented (not formally restricted in OWL because OWL 2 DL range restrictions on datatypes are limited, but validated via SPARQL).

**Invariant 5: Nulls are excluded from the consensus denominator.** The denominator counts non-null observations only. FBO's `fbo:TypeDistribution` separately tracks total observations (including null) via `fbo:hasTotalObservations`.

**Invariant 6: Nested structures are skipped, not processed.** Arrays and objects produce SAS-003 diagnostics and no DataField entries. FBO has no class for nested structures — they're outside scope.

**Invariant 7: `sas:activeConfig` is present and complete.** Every output must include the full configuration block. FBO maps this to `fbo:AlignmentConfiguration` and all five config properties must be present: `consensusThreshold`, `minObservationThreshold`, `nullVocabulary`, `booleanPairs`, `temporalNamePattern`.

---

## What You Need to Do Now

**Nothing.** Your Phase 1 output format is FBO-compatible as-is. No code changes are required. FBO is a downstream interpretation layer — it reads your output, it doesn't change it.

---

## What Changes in the Future (Phase 4: Namespace Migration)

Eventually, the `viz:` and `sas:` namespace prefixes will be replaced with `fbo:` IRIs in a future SAS major version (v3.0). This is FBO Phase 4 and it is documentation-only at this stage. Here is the preview:

The `@context` block in your JSON-LD output currently reads:

```json
"@context": {
  "fandaws": "https://schema.fnsr.dev/fandaws/v3#",
  "prov": "http://www.w3.org/ns/prov#",
  "sas": "https://schema.fnsr.dev/sas/v1#",
  "viz": "https://schema.fnsr.dev/ecve/v4#"
}
```

After migration, it would read:

```json
"@context": {
  "fbo": "https://ontology.fnsr.dev/fbo/",
  "prov": "http://www.w3.org/ns/prov#"
}
```

And terms like `viz:hasDataType` would become `fbo:assertsVariableType`, `sas:consensusNumerator` would become `fbo:hasConsensusNumerator`, and so on per the mapping table above.

This is not happening now. When it does, the full mapping document will be provided as part of the SAS v3.0 specification, and backward compatibility (hard migration vs. `owl:equivalentProperty` aliases) will be decided at that time. The current `viz:`/`sas:` prefixes are stable and will not change in any v2.x release.

---

## One Design Note Worth Knowing

FBO models your output differently than you produce it in one specific structural way: in SAS output, the type assertion and the field are the same JSON object (the entries in `viz:hasField`). In FBO, they are two separate individuals — a `fbo:DataField` and an `fbo:EvidencedTypeAssertion` — linked by `obo:IAO_0000136` (is_about). FBO separates them because ontologically, a field and a claim about that field are different things. A field exists in the data; an assertion about what type that field is exists in the SAS output.

This separation is invisible to you. Your JSON-LD output doesn't need to change to accommodate it. The FBO ABox (Phase 2) creates the two individuals from your single JSON object during instantiation.

Similarly, `sas:activeConfig` is embedded inside the schema object in your output. FBO models it as a separate `fbo:AlignmentConfiguration` individual linked to the `fbo:SemanticAlignmentProcess` via `fbo:governedBy`. Again, this is a modeling difference that doesn't affect your output format.

---

## Reference Documents

| Document | Purpose |
|---|---|
| **SAS Term Registry** (`sas-term-registry-for-fbo.md`) | Exhaustive list of all 35 terms with mappings and gap analysis |
| **FBO Spec v1.1** (`FNSR_Bridge_Ontology_Spec_v1.1.md`) | Full specification — 1400 lines, 14 competency questions |
| **FBO TBox** (`src/BridgeOntology.ttl`) | The OWL ontology file — 1128 lines, Phase 1 complete |
| **FBO Decision Log** (`docs/decision-log.md`) | IRI corrections and design decisions (9 entries) |
| **SAS Phase 1 Review v2** (`sas-phase1-review-v2.md`) | Verification of all 6 test outputs against FBO |

---

## Questions?

If you need to add a new term to SAS output (a new diagnostic code, a new field-level property, a new config parameter), notify the FBO team so the term can be added to the registry and mapped before release. The registry is the contract between SAS and FBO — if it's not in the registry, FBO doesn't know about it.

If you're unsure whether a proposed change to SAS output format would break FBO compatibility, check the 7 invariants listed above. If it satisfies all 7, it's compatible. If you're adding a new property that doesn't appear in the registry, it won't break FBO — it just won't be bridged until the registry is updated.
