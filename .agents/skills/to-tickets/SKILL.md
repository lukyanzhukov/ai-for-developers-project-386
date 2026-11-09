---
name: to-tickets
description: Publish approved specifications as vertical implementation tickets with acceptance criteria and blocking dependencies.
disable-model-invocation: true
---

# To Tickets

Turn an approved specification into **implementation tickets**: tracer-bullet vertical slices, each containing the specification for its behavior and declaring the tickets that **block** it.

Read the project's tracker document's **Workflow and artifacts** section before publication; it defines artifact roles, readiness, design references, and progress/handoff reporting. In this repo it is [docs/agents/issue-tracker.md](../../../docs/agents/issue-tracker.md). If no tracker has been configured, ask the user to run `/setup-matt-pocock-skills`.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

Confirm that the relevant product decisions and specification are approved, reusing recorded approvals. If they are still open, present the missing decisions or draft for review before publishing implementation tickets. Do not assign `ready-for-agent` to an unresolved draft.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a column, retype a shared symbol) whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket; green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work
- **Specification**: the slice's agreed behavior, rules, relevant API inputs/outputs/errors, and acceptance criteria, with links to source decisions and the contract

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown and ticket specifications. Reuse an already approved breakdown when only incorporating decisions the user has since agreed; surface any actual change to scope or dependencies.

### 5. Publish the tickets to the configured tracker

Publish the approved tickets. **How** depends on the tracker `/setup-matt-pocock-skills` configured; the tickets are the same either way, only the shape of the blocking edges changes:

- **Local files** → write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-ticket file template below: one ticket per file, never a single combined file.
- **A real issue tracker (GitHub, Linear, …)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Use native blocking relationships where available. Each body contains the approved specification of its slice. Use an existing feature issue as parent only when it groups the delivered functionality; a decision map or legacy specification-only issue is a source reference, not the implementation parent. Apply `ready-for-agent` to the approved, fully specified tickets; other implementation tickets may still block their execution.

Verify the published bodies, source references, labels, and blocking edges, then report the **frontier**: tickets whose blockers are all done. This completes ticket publication; implementation is the next stage under the tracker workflow.

Do NOT close or modify any parent issue.

<local-ticket-template>

# <NN>: <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer implementation list.

**Specification:** the approved behavior and rules for this slice, relevant API inputs/outputs/errors, and references to product decisions and the contract.

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None (can start immediately)".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

**User acceptance:** the short scenario and expected result; status: not performed.

</local-ticket-template>

<issue-template>

## Parent

A reference to an existing feature parent, if applicable; otherwise omit this section.

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective, not layer-by-layer implementation.

## Specification

The approved behavior and rules of this slice, relevant API inputs/outputs/errors, and references to product decisions and the contract. Include enough detail to implement the slice; a link to a separate specification-only issue is not a substitute.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## User acceptance

The short scenario and expected result. Status: not performed.

## Blocked by

- A reference to each blocking ticket, or "None (can start immediately)". Omit this section when blockers were set as native edges.

</issue-template>

In either form, avoid implementation source-file paths or code snippets: they go stale fast. References to accepted design artifacts belong in the Specification when the tracker workflow requires them. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.
