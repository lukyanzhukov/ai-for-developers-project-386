---
name: implement-spec
description: "Implement ready tickets containing approved specifications on one integration branch; report automated verification and user acceptance separately."
disable-model-invocation: true
---

Implement the approved specifications contained in the provided implementation tickets. A preparation draft or decision map is a source of context, not an implementation ticket.

Read the project's tracker document's **Workflow and artifacts** section for readiness, stage boundaries, and progress/handoff reporting. In this repo it is [docs/agents/issue-tracker.md](../../../docs/agents/issue-tracker.md). If no tracker has been configured, ask the user to run `/setup-matt-pocock-skills`.

The goal is the requested ticket graph implemented on one **integration branch**, with evidence against each ticket's specification. Resolve tickets according to their actual completion criteria, keeping the user's acceptance status explicit.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Start every subagent with a fresh context window.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the ticket specifications and product decision references to understand the task graph. Reuse their recorded approvals and testing seams. Check for unresolved product decisions before starting; do not make them silently during coding. State the current stage, intended deliverable, and verification plan.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch. If the tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one). Reference the implementation tickets and mark them as closing only where their completion criteria are met; do not create a specification parent issue.

4. Use a fresh **implementer subagent** for each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. Fix all issues raised by the code review in a single fresh **implementer subagent**.

8. If a draft PR exists, mark it ready for review. Otherwise, resolve tickets whose completion criteria are met the way the tracker closes work. Report code readiness, automated verification with commands/CI links, and user acceptance separately under the tracker workflow. Provide a short runnable acceptance scenario with expected results. A green CI run does not establish that the user tried the feature; record unperformed or pending acceptance honestly. Keep any ticket with an unmet required acceptance criterion open.

9. Clean up all **implementer subagent** worktrees.
