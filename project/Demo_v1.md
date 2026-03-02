# Schema Alignment Service

**Automated Column Type Detection for Data Pipelines**

SAS examines the statistical profile of every column in your dataset and decides what each column actually contains — numbers, dates, categories, booleans, or unknowns — with measurable confidence and full traceability.

---

## The Problem

When data arrives from external sources, column types are ambiguous:

| Column | Raw Values | What is it? |
|--------|-----------|-------------|
| Revenue | `52340`, `18200`, `N/A`, `12.5k`, `91000` | A number? A category code? |
| created_at | `2024-01-15`, `2024-02-28`, `2024-03-10` | A date? Just text? |
| Region | `North America`, `EMEA`, `APAC` | A category? |
| status_flag | `true`, `false`, `Yes`, `No` | A boolean? Mixed text? |

Manual classification doesn't scale and isn't reproducible. Different analysts make different judgment calls. SAS replaces that with a deterministic, evidence-based process.

---

## How It Works

SAS receives a **structural profile** of your data (produced by upstream tools). This profile includes the **type distribution** — a count of how many values in each column are integers, strings, booleans, nulls, etc.

SAS runs a **6-rule cascade** on each column, in order:

| # | Rule | What It Detects | Example |
|---|------|----------------|---------|
| 1 | **Consensus Promotion** | Dominant type reaches 95%+ confidence | 492 out of 497 non-null values are integers → "This is a number" |
| 2 | **Temporal Detection** | Date/time columns via name patterns or upstream evidence | Column named `created_at` → "This is a date" |
| 3 | **Boolean Pair Detection** | Configured true/false mappings | `Yes`/`No` or `T`/`F` pairs → "This is a boolean" |
| 4 | **Null Vocabulary** | Domain-specific null indicators (`N/A`, `Unknown`, `-`) | Reclassifies "N/A" as null before consensus, improving accuracy |
| 5 | **Structural Passthrough** | Falls back to the raw type when no rule matched | Pure string column → "This is a category" |
| 6 | **Unknown Assignment** | All-null or structurally complex columns | Empty column → "Can't determine" |

The first rule that matches wins. Every decision is logged with a diagnostic code.

---

## Before & After: Worked Example

**Input:** A dataset with 500 rows and 3 columns. The upstream profiler tells SAS:

| Column | Type Distribution | Nulls |
|--------|-------------------|-------|
| Region | 500 strings | 0 |
| Revenue | 492 integers, 5 strings, 3 nulls | 3 |
| created_at | 500 strings | 0 |

**SAS Output:**

| Column | SAS Decision | Confidence | Rule Applied | Reasoning |
|--------|-------------|-----------|--------------|-----------|
| Region | **Nominal** (category) | 100.00% | Consensus | 500/500 non-null values are strings |
| Revenue | **Quantitative** (number) | 98.99% | Consensus | 492/497 non-null values are integers |
| created_at | **Temporal** (date) | 100.00% | Temporal Detection | Name matches date/time pattern |

**Revenue detail:** 500 total values minus 3 nulls = 497 non-null. Of those, 492 are integers = 98.99% consensus. This exceeds the 95% threshold, so SAS confidently labels it as a number with integer precision.

---

## Live Demo

The interactive demo is deployed at:

**https://skreen5hot.github.io/SchemaAlignment/**

### How to Use

1. **Open the demo** — The left panel shows a pre-loaded example (the 3-column dataset above)
2. **Click "Align"** — SAS processes the input and shows the typed output in the right panel
3. **Read the diagnostics** — The bottom bar shows what SAS decided and why
4. **Edit the input** — Modify the JSON to test your own data profiles
5. **Click "Reset Example"** — Restores the original example

### Configuration Controls

Two settings above the Align button let you tune SAS behavior:

| Control | Default | What It Does |
|---------|---------|-------------|
| **Min Observations** | 5 | Minimum non-null values required before SAS will make a type decision. Set lower for small datasets. |
| **Consensus Threshold** | 0.95 | The fraction of values that must be the same type for SAS to confidently assign it. Lower = more permissive. |

**Tip for small datasets:** If your data has fewer than 5 rows, set Min Observations to `1` — otherwise all fields will show as "Unknown" because there isn't enough evidence.

---

## Diagnostic Codes

Every SAS decision includes diagnostic codes explaining what happened:

| Code | Level | What It Means | What To Do |
|------|-------|--------------|-----------|
| **SAS-001** | Warning | No type reached 95% confidence. Field assigned as category (safest default). | Review the column — it may have genuinely mixed data types. |
| **SAS-002** | Info | Field is completely empty or structurally complex. Marked as Unknown. | This field has no usable data, or it contains nested objects. |
| **SAS-003** | Info | Nested structure (object/array) detected and skipped. | Flatten nested data before profiling. |
| **SAS-007** | Fatal | Input profile version is too old to process. | Upgrade the upstream profiling tool to v1.3+. |
| **SAS-008** | Info | Null vocabulary adjustment improved type detection. | Custom null indicators helped SAS understand the data better. |
| **SAS-009** | Info | Date/time detected via upstream normalization evidence. | The upstream cleaner already confirmed this is a date. |
| **SAS-010** | Info | Date/time detected via column name pattern (e.g., `created_at`). | Column name suggests temporal data. |
| **SAS-012** | Warning | Too few non-null values to make a confident decision. Marked as Unknown. | The column is mostly empty. Collect more data or lower Min Observations. |
| **SAS-013** | Fatal | Input profile is internally inconsistent (type counts exceed total). | Bug in upstream profiler — check its configuration. |
| **SAS-014** | Warning | Upstream profiler reported an unrecognized type. Treated as text. | Check version compatibility between profiler and SAS. |

---

## Guarantees

| Guarantee | What It Means |
|-----------|--------------|
| **Deterministic** | Run the same data through SAS 100 times — you get byte-identical output every time. No randomness, no time dependency. |
| **Offline-First** | The entire algorithm runs in your browser. Data never leaves your device. No server calls, no cloud dependency. |
| **Pure** | SAS never modifies your input. It never reads environment variables or the system clock. It produces output from input alone. |
| **Tested** | 59 automated tests verify determinism, network isolation, snapshot correctness, and every rule in the cascade. |

---

## What's Next

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Static rule cascade (6 rules), 59 tests, demo site | Complete |
| **Phase 1v2** | Fandaws enrichment — external domain knowledge to improve type decisions | Planned |
| **Phase 2** | API adapters for integration with data pipelines | Planned |

---

## Who Benefits

| Role | Value |
|------|-------|
| **Data Analysts** | Stop guessing what columns contain. SAS tells you with 95%+ confidence, backed by statistical evidence. |
| **Data Engineers** | Deterministic output means reproducible pipelines. No flaky tests, no mystery type assignments. |
| **Privacy Officers** | Runs entirely on the client. Data never leaves the user's device. No phone-home, no cloud dependency. |
| **DevOps** | No database, no message queue, no API keys. Pure JavaScript — deploy anywhere. |
| **Business** | Reduces data quality issues downstream. Catches type misclassifications early, before they break analytics. |
