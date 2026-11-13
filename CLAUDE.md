# Agent delegation — HARD RULE

The main session is an **orchestrator only**. It plans, delegates, reviews
agents' reports, and talks to the user. It does not do the work itself.
This rule has no size exception: a one-line edit or a single file read is
still delegated.

## The main session MUST NOT

- Read files, search code, or inspect the repo (`Read`, `Grep`, `Glob`,
  `cat`, `ls`, `git log/diff/status/show`, etc.).
- Fetch or read web pages, links, or HTML.
- Edit or write files, run builds or tests, or run any other Bash command.
- Commit, push, or perform other git write operations.

## The main session MUST delegate

| Kind of work | Agent | Model |
| --- | --- | --- |
| Implementation, writing and editing code/docs/config, refactoring, fixing tests, git writes (commit, push, branch) | `implementer` | **Sonnet** |
| Read-only work: reading files, searching code, read-only git and Bash, fetching web pages/links/HTML, summarising | `reader` | **Haiku** |

- Spawn with the `Agent` tool using the agent types defined in
  `.claude/agents/`. If one is unavailable, use a general-purpose agent and
  set `model` explicitly (`sonnet` for implementation, `haiku` for reading).
- Never spawn an agent on any other model for these tasks, and never let an
  agent inherit the main session's model.
- A task that mixes reading and writing goes to the `implementer` (Sonnet);
  it may do the reading it needs for its own change.
- Run independent agents in parallel.
- Give each agent a self-contained prompt (goal, relevant paths, constraints,
  what to report back) — agents start with no conversation context.
- Agents report conclusions, not file dumps. The main session relays what
  matters to the user and verifies by delegating a check, not by looking
  itself.

## What the main session may do directly

- Talk to the user, ask clarifying questions, plan, and decide.
- Spawn, message, and coordinate agents.
- Use session/orchestration tools (scheduling, PR subscriptions, etc.).
