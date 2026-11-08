# Issue tracker: GitHub

Repository: `lukyanzhukov/ai-for-developers-project-386`.

Product decision maps and implementation tickets live as GitHub issues. Specification preparation is a workflow stage; the approved specification belongs in the implementation ticket. Use the `gh` CLI for tracker operations.

## Workflow and artifacts

Read this section before preparing a specification, publishing tickets, or implementing a feature. It defines the handoff between `/wayfinder`, `/to-spec`, `/to-tickets`, and `/implement-spec`.

| Stage                     | Artifact and completion condition                                                                                                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product decisions         | A wayfinding map indexes questions and their agreed answers. Decisions describe the intended behavior; code delivery is outside the map.                                                                                                                                                                       |
| Specification preparation | A draft in the conversation turns agreed decisions into precise behavior, API requirements, and acceptance criteria. The stage ends when the user approves the specification. No separate specification issue is created.                                                                                      |
| Ticket publication        | Each implementation ticket contains the approved specification of its vertical slice and links to relevant decisions and the API contract. Its title names the delivered behavior, for example “Гость записывается на свободный слот”. An optional parent groups functionality, not specification preparation. |
| Implementation            | Code and PRs deliver the ticket's behavior; automated checks and review provide evidence against its acceptance criteria.                                                                                                                                                                                      |
| User acceptance           | A short, runnable scenario lets the user check the delivered behavior. Record the user's actual result separately from automated verification.                                                                                                                                                                 |

Publish `ready-for-agent` tickets only after their product decisions and specifications are agreed. A fully specified ticket may still wait for another implementation ticket; use native dependencies to express that execution order. An unresolved product question belongs in the decision map or specification draft, not in an agent-ready implementation ticket.

Preparation skills end with a reviewable artifact. Start another stage only when the user requested it; an explicit request for several stages authorizes that sequence without repeated permission questions. Approval of requirements does not by itself authorize implementation or publication to `main`.

### Progress and handoff

At the start of a stage and at meaningful milestones, state: **current stage → result → evidence → what is needed from the user**. If no user action is needed, say what remains and continue within the authorized scope. Prefer delivered behavior over accounts of subagent, worktree, and merge activity.

At delivery, report these outcomes separately:

- **Code:** what is implemented and where it can be reviewed or run.
- **Automated verification:** commands and CI results, including checks not yet run or failing.
- **User acceptance:** a short scenario, expected result, and status: not performed, awaiting the user, passed, or changes requested. Mark it passed only after the user reports that result.

A green CI run, specification approval, and merge permission are evidence for their own stages; none counts as user acceptance. If a ticket requires user acceptance for completion, keep it open until that criterion is met. Otherwise report code completion while explicitly retaining the unperformed acceptance status. A separate acceptance issue is not required.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (open blockers only; 0 means startable). `gh issue view <n> --json blockedBy` also lists closed blockers, so filter it: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: post the explanation with `gh issue comment <number> --body "..."`, then `gh issue close <number>`. On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

File issues only into the user's own repo. Never file into `mattpocock/skills` (the repo these skills come from) unless the user owns it. In a fork, `gh` can default to the upstream parent, so before the first `gh issue create` of a session, check the target with `gh repo view --json nameWithOwner` and confirm it with the user if it is not their repo.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number>`, then `gh pr view <number> --comments` (off a TTY, `--comments` prints only the comments, not the body), and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Publish the artifact appropriate to its stage: decision maps/questions or implementation tickets containing an approved specification. Specification preparation itself produces a draft for review, not an issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under Conventions.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (see **Count open blockers**, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
