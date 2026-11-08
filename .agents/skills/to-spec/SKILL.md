---
name: to-spec
description: "Turn agreed product decisions and the current conversation into a specification draft for user review, before implementation tickets are published."
disable-model-invocation: true
---

This skill produces a specification draft from agreed product decisions and codebase context. Synthesize what is already known; do not conduct a new product interview or invent answers to open questions.

Read the project's tracker document's **Workflow and artifacts** section for artifact roles, stage boundaries, and progress/handoff reporting. In this repo it is [docs/agents/issue-tracker.md](../../../docs/agents/issue-tracker.md). If another repo has no configured tracker document, ask the user to run `/setup-matt-pocock-skills`.

## Process

1. Read the conversation and any referenced decisions or source artifacts. Explore the repo if its current state is not already known. Use the domain glossary throughout the draft and respect relevant ADRs.

2. Identify the agreed behavior, constraints, API requirements, and unresolved decisions. Link existing decision answers where useful. Mark any unresolved behavior explicitly; it prevents the draft being handed off as ready for implementation.

3. Describe the testing seams. Reuse ones the user has already approved. Propose any new seams as part of this draft for review, distinguishing automated checks from the user's acceptance scenario.

4. Present the draft using the template below in the conversation, or update the draft location explicitly requested by the user. Ask for specification approval only if it has not already been given. Do not create a specification issue or apply a triage label at this stage. After approval, hand the draft to `/to-tickets` only if that next stage is authorized.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A numbered list covering the agreed user behavior. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

Cover distinct scenarios and edge cases without repeating the same requirement for every field.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)
- A short user acceptance scenario with its expected result; this is a plan, not a claim that acceptance has happened

## Acceptance Criteria

Observable outcomes that make the specification ready to become implementation tickets, including success, invalid data, and relevant conflicts. Distinguish acceptance requirements from any unresolved product questions.

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
