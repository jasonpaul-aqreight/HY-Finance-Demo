> ⚠️ **This file is a documentation-authoring scaffold, not a specification.**
> Implementers (human or agent) building the AI Insight engine should **ignore this file** — it is the empty 8-part skeleton used when writing docs `01`–`10`. It contains no engine contract, no behavior, and no acceptance check. Excluded from any production / implementation bundle.

# NN — {Layer name}

> **Classification:** Engine | Domain Pack | Spine
> **Enables:** {what a reader can build after this doc}
> **Read after:** {prior doc numbers this depends on}

---

## 1. Purpose

One paragraph: what this layer is, why it exists, and what the reader will be able to build after this document. State the layer's single responsibility.

## 2. Prerequisites

The exact docs (by number) and concepts the reader must have absorbed first. If this doc assumes a contract defined elsewhere, name the doc and the contract. List the external dependencies (libraries, services) this layer touches, by role — not version. Version specifics go inline, flagged.

## 3. Concept & Contract

**Stack-neutral and domain-neutral.** Describe the layer as an idea, independent of Next.js / React / Postgres / OpenRouter and independent of finance. State:

- The **inputs** the layer accepts (as abstract contracts).
- The **outputs** / guarantees it produces.
- The **invariants** it must never violate.
- Where the boundary sits with adjacent layers.

A reader should be able to re-implement this layer on a different stack from this section alone.

## 4. Data contracts

Every data shape that crosses this layer's boundary: persisted schemas, in-memory types, request/response payloads, and any read contract on data this layer does not own. Give field names, types, nullability, and meaning. Mark which contracts are **owned** by this layer vs **consumed** from elsewhere.

## 5. Behavior & flow

The concrete runtime behavior, step by step, on the actual stack. Include the happy path and the ordering guarantees. Use a numbered sequence or a box/arrow diagram. This is where stack-true build instruction lives. Flag every stack-version-sensitive step with **`[VERSION-SENSITIVE]`** and state the exact assumption (e.g. "assumes Next.js App Router route handlers; on Pages Router this becomes an API route").

## 6. Rules & edge cases

Enumerate every rule, guard, failure mode, and edge case the implementer must handle: concurrency, idempotency, partial failure, empty/missing inputs, auth, timeouts, retries, fallbacks. For each: the trigger, the required behavior, and why.

## 7. Reference Implementation

The concrete build, mapped to this repo's source as traceability — file paths and exported symbol names with a one-line responsibility each. Include the key code shapes (signatures, SQL DDL, prompt skeletons) inline so the doc stands alone without source access. Source paths are evidence, not a substitute for the spec above them.

## 8. Verification checkpoint

A concrete, runnable acceptance check proving the layer was built correctly: setup, action, expected observable result. **Definition of Done:** a developer who has read only docs `00..NN`, with no access to this repo's source, can build this layer and pass this checkpoint.

---

<!-- AUTHORING RULES (delete this block in the finished doc):
- Concept & Contract (§3) is stack/domain-neutral; everything below is stack-true.
- Flag stack/version assumptions with [VERSION-SENSITIVE] and state the assumption.
- No process metadata: no "Build N", "Session N", dates, audit notes, or rewrite history.
- The doc must stand alone — a reader with no source access builds the layer from it.
- Domain Pack docs are finance-specific by design; Engine/Spine docs must not hardcode finance.
-->
