---
name: prism
description: Work in Prism, MisoncoTech's project management app (workspaces, projects, tasks, subtasks, dependencies, sprints, kanban boards, time tracking, automations, meetings, polls, notifications, search, customers/CRM with contacts, notes and CSV/Excel import, and the workspace noticeboard of announcements and incidents) through the `prism` CLI or the Prism MCP tools (list_tasks, get_board, create_task, list_customers...). Use when the user mentions Prism or asks to list, create, update, move, assign, comment on or close tasks, check a sprint or board, log time, take meeting notes, manage or import customers, or post or resolve noticeboard incidents in Prism, and to install, log in to, configure or troubleshoot the prism CLI or its MCP server.
---

# Prism

Prism is reached in two ways. Both act as the signed-in user, against the production API
(`https://apiprism.misoncotech.com`), with that user's permissions:

- **MCP tools** from the `prism` MCP server: `list_tasks`, `get_task`, `create_task`, `move_task`, `get_board`...
  Their names may carry a client prefix, such as `mcp__prism__list_tasks`.
- **The `prism` CLI**, run from a shell.

## 1. Pick the interface

1. **The Prism MCP tools are available**: use them. They take structured arguments and return the API JSON.
2. **No MCP tools, but you can run shell commands**: use the CLI with `--json`.
3. **The task needs something MCP does not cover**: use the CLI. That includes workspaces, column and sprint
   management, attachments, CSV exports, customer imports and deletions, editing or deleting noticeboard entries,
   project templates saved from a project, changing a project's teams (`prism project update --team`,
   `prism team projects`), tokens, sessions and raw API calls (`prism api`).
4. **A write tool you need is missing**: the server may run with `--read-only`, which is the default of this
   plugin. Use the CLI for the write, or ask the user to enable writes (see [references/mcp.md](references/mcp.md)).
5. **Neither works** (`prism` not found, or exit 3 not authenticated): follow
   [references/setup.md](references/setup.md). Ask the user to do the steps that need them: installing, approving
   the login in the browser, or creating a token.

## 2. Check the setup first (CLI)

```bash
prism auth status --json          # exit 3: not logged in -> references/setup.md
prism workspace current --json    # default client/workspace/project and where each comes from
```

With MCP, call `whoami`, then `list_workspaces` / `list_projects` when you need IDs.

## 3. Rules for both interfaces

1. **Resolve IDs before acting.** Workspaces, projects, tasks, users and meetings take full IDs. Names and 4+
   character ID prefixes also work but can be ambiguous; tasks also take their key (`PRM-12`). Pass the project and workspace explicitly (`-p`/`-w`, or
   `project_id`/`workspace_id`) instead of relying on saved context.
2. **Never assume task statuses.** A status is a column of that project, and every project has its own. Discover
   them first with `prism column list -p <project> --json` or the `list_statuses` tool. "Is it done?" is the
   category, which is the same everywhere: `todo`, `in_progress`, `review` or `done`. A task in a `review` column
   is open and only a reviewer (`task.review`, and one of its reviewers if it has any) takes it out: approve or
   request changes (`prism task review approve|changes`, or `approve_review` / `request_changes`), never `move`.
3. **Destructive operations need the user's explicit request.** This covers deleting tasks, comments, columns,
   sprints or projects, revoking, and bulk deletes. In the CLI, add `--yes` only after the user asked for that
   deletion, and preview other risky changes with `--dry-run`. Over MCP, delete tools only exist with
   `--allow-destructive`.
4. **Keep outputs small.** In the CLI use `--fields`, `--jq` or `-q` (IDs only). Over MCP use `limit` and the
   filters.
5. **Report what changed.** Give the task title, its ID and the new status, so the user can find it in the App
   (`https://prism.misoncotech.com`).
6. **Work out the next step from the error code**, not by retrying blindly. See
   [references/troubleshooting.md](references/troubleshooting.md).
7. **Customers are not clients.** A *client* (`prism client`) is the organization that owns the workspaces; the
   companies a workspace works for are *customers* (`prism customer`, the CRM). Publishing on the noticeboard
   notifies the whole workspace: only do it when the user asked for it.

## 4. CLI essentials

```bash
prism task mine -w $WS --json --fields id,title,priority,column_name           # my tasks
prism task list -p $P --sprint active --open --json --fields id,title,status,assignees
T=$(prism task create "Fix login redirect" -p $P --priority high --assignee me -q)
prism task move $T --status in_progress          # a column key, name or ID of that project
prism task comment add $T "Root cause: expired cookie" -q
prism task time log $T 1h30m --note "Code review"
prism board show -p $P --summary                 # tasks per column in the active sprint
prism search "login" -w $WS --type task --json
prism customer list -w $WS --mine --json --fields id,name,status,tax_id    # customers (CRM)
prism noticeboard list -w $WS --kind incident --status open --json         # open incidents
prism task to-review -w $WS --json --fields id,key,title,reviewers           # my review queue
prism task review approve PRM-12                 # or: prism task review changes PRM-12 -m "Add tests"
prism github runs -p $P --status failure --json  # GitHub Actions; logs: prism github log <run> <job>
```

Commands follow `prism <resource> <action>`. For full recipes, see [references/cli.md](references/cli.md):
subtasks, dependencies, recurrence, bulk changes, views, review, automations, sprints, roadmaps, GitHub Actions,
meetings, polls, customers (contacts, notes, import, export), the noticeboard, exports and `prism api`. When unsure, `prism schema` lists every command with its flags, scopes and output fields.

## 5. MCP essentials

- `project_id` and `workspace_id` are optional when the user has a default context. They accept an ID, a prefix
  or a name.
- Typical flow: `list_statuses`, then `list_tasks` (with filters), then `get_task`, then `move_task`,
  `update_task` or `add_comment`. Review: `list_tasks_to_review`, then `approve_review` or `request_changes`.
- `task_id` accepts a key (`PRM-12`) without a project.
- A failed tool returns `isError` with `{"error":{"code","message","hint"}}`. Read `code`, as in the CLI.

Tool catalog, parameters, scopes and setup for each client: [references/mcp.md](references/mcp.md).
