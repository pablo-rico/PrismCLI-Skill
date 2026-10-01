# Prism MCP server

`prism mcp serve` is a **local MCP server over stdio** that runs inside the prism CLI. The MCP client (Claude Code,
Codex, Claude Desktop, Cursor...) launches it as a subprocess.

- **Tools only.** It has no resources or prompts.
- **The protocol version is negotiated** with the client: from 2024-11-05 to 2026-07-28.
- **There is no remote MCP endpoint.** Prism cannot be added as a URL/HTTP connector (claude.ai web, ChatGPT);
  the CLI must be installed on the machine that runs the client.

## How the tools behave

- They call the production API as the user of the credentials. These are `PRISM_TOKEN` (a personal access token)
  if set, or the session stored by `prism auth login`.
- `project_id` and `workspace_id` are optional. Without them, the user's CLI context is used (`prism project use`,
  `PRISM_PROJECT`...). They accept a full ID, a 4+ character prefix or an exact name.
- Results are the raw API JSON.
- Errors come back as a result with `isError: true` and the text
  `{"error":{"code":"...","message":"...","hint":"...","exit_code":N}}`. The codes are the same as the CLI's
  ([troubleshooting.md](troubleshooting.md)).
- Annotations:
  - read tools have `readOnlyHint`;
  - delete tools have `destructiveHint`, and only exist when the server runs with `--allow-destructive`;
  - none is `openWorldHint`.

## Tools

Parameters marked * are required. Scope is the personal access token scope the tool needs.

### Context, projects and search (scope `read` unless noted)

| Tool | Parameters | Use |
|---|---|---|
| `whoami` | | Signed-in user and their client memberships |
| `list_workspaces` | limit | Workspaces the user can see |
| `list_projects` | workspace_id, limit | Projects of a workspace |
| `get_project` | project_id | One project |
| `list_templates` | workspace_id, limit | Built-in and saved project templates |
| `create_project` (`projects:write`) | workspace_id, name*, description, visibility, template | New project, optionally from a template |
| `search` | q*, workspace_id, types, limit | Full text over tasks, projects, meetings, comments |

### Tasks (scope `read` / `tasks:write`)

| Tool | Parameters | Use |
|---|---|---|
| `list_statuses` | project_id, sprint | **Call first**: the project's columns with key, name, category and task_count |
| `list_tasks` | project_id, status, category, completed, priority, assignee, assignees, unassigned, created_by, tags, custom_fields, sprint, q, due_before, due_after, view, sort, limit | Filtered task list |
| `get_task` | task_id* | Task with assignees and checklist |
| `create_task` | project_id, title*, description, status, priority, assignee_ids, sprint_id, due_date, story_points, parent_id, tags, checklist | Create; added to the active sprint unless sprint_id; parent_id makes a subtask |
| `update_task` | task_id*, title, description, status, priority, due_date, story_points, tags | Edit fields |
| `move_task` | task_id*, status, column_id, sprint_id | Move to another column and/or sprint |
| `assign_task` | task_id*, user_ids*, remove | Assign, or unassign with remove=true |
| `bulk_update_tasks` | project_id, task_ids*, op*, status, priority, sprint_id, due_date, add_assignees, remove_assignees, add_tags, remove_tags | Up to 200 tasks in one transaction (update, archive, unarchive) |
| `list_views` / `create_view` | project_id / project_id, name*, shared, view_type, filters, sort | Saved task filters |
| `list_subtasks` | task_id* | Subtasks (one level) |
| `list_dependencies` | task_id* | blocked_by and blocking |
| `add_dependency` / `remove_dependency` | task_id*, blocked_by_task_id* / task_id*, dependency_id* | Cycles are rejected |
| `list_time_entries` / `log_time` | task_id* / task_id*, minutes or duration, log_date, note | Time tracking; actual hours = sum of entries |
| `time_report` | project_id, user, from, to | Totals per user and task |
| `set_recurrence` | task_id*, freq, interval, weekdays, ends_on, count, clear | Repeating task (completing it creates the next) |
| `list_comments` / `add_comment` | task_id* / task_id*, content*, mentions | Comments; mentions notify users |
| `checklist_list` / `checklist_add` / `checklist_set` | task_id* (+ title* / item_id*, completed*) | Checklist |
| `delete_task`, `delete_comment`, `bulk_delete_tasks` | task_id* / comment_id* / project_id, task_ids* | **Destructive**, only with `--allow-destructive` |

### Boards, automations, meetings, notifications, activity

| Tool | Scope | Parameters | Use |
|---|---|---|---|
| `list_sprints` | read | project_id | Sprints, newest first (is_active marks the active one) |
| `get_board` | read | project_id, sprint_id | Kanban columns with their tasks |
| `list_automations` | read | project_id | Automations with trigger, conditions, actions, last run |
| `automation_runs` | read | project_id, automation*, limit | Latest runs: success, error, skipped |
| `create_automation` | projects:write | project_id, automation* | The API body as a JSON object |
| `list_meetings` / `get_meeting` | read | workspace_id, limit / meeting_id* | Meetings with participants, notes, polls |
| `add_meeting_note` | meetings:write | meeting_id*, content* | |
| `create_poll` / `vote_poll` | meetings:write | meeting_id*, question*, options*, allow_multiple / meeting_id*, poll_id*, options* | A vote replaces earlier votes |
| `list_notifications` / `mark_notification_read` | read / notifications:write | unread, limit / notification_id or all | |
| `list_activity` | read | client_id, resource_type, action, since, limit | Audit log of a client |
| `activity_feed` | read | workspace_id, project_id, actor, resource_type, action, limit | Workspace feed the user can see |

**Not available over MCP** (use the CLI): workspaces and members, column and sprint management, attachments,
custom field definitions, CSV exports, saving a project as a template, tokens and sessions, and raw API calls.

## Typical flows

- **"What should I work on?"**: `whoami`, then `list_tasks` with `assignee: "me"`, `sprint: "active"` and
  `completed: false`.
- **Move a task to review**: `list_statuses` to find the review column key, then `move_task` with that status.
- **Triage**: `list_tasks` with `unassigned: true` and `category: ["todo"]`, then `bulk_update_tasks` with
  `op: "update"`, `priority` and `add_assignees`.
- **Sprint status**: `get_board`, or `list_statuses` for the counts per column.
- **Log work**: `log_time` with `duration: "1h30m"` and a note, then `add_comment` if the user wants a summary.

## Server flags

| Flag | Effect |
|---|---|
| (none) | Read and write tools of every toolset, without the delete tools |
| `--read-only` | Read tools only. This plugin registers the server this way |
| `--toolsets a,b` | Only these groups: `context`, `projects`, `tasks`, `automations`, `sprints`, `meetings`, `notifications`, `search`, `activity` |
| `--allow-destructive` | Also the delete tools. Not compatible with `--read-only` |

`prism mcp tools [same flags]` lists what the server would register, with the kind and scope of each tool.

## Register the server in a client

This plugin already registers `prism mcp serve --read-only` in Claude Code and Codex. To enable writes, register
another server, or replace it, with the flags you want.

```bash
# Claude Code
claude mcp add prism-write -- prism mcp serve --toolsets tasks,sprints,search
claude mcp add prism -e PRISM_TOKEN=prism_pat_... -- prism mcp serve --read-only   # with a token

# Codex
codex mcp add prism-write -- prism mcp serve --toolsets tasks,sprints,search
codex mcp add prism --env PRISM_TOKEN=prism_pat_... -- prism mcp serve --read-only
```

Codex `~/.codex/config.toml`:

```toml
[mcp_servers.prism]
command = "prism"
args = ["mcp", "serve", "--read-only"]
env = { PRISM_TOKEN = "prism_pat_..." }
```

Claude Desktop (`claude_desktop_config.json`) and Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "prism": {
      "command": "/opt/homebrew/bin/prism",
      "args": ["mcp", "serve", "--read-only"],
      "env": { "PRISM_TOKEN": "prism_pat_..." }
    }
  }
}
```

- **Desktop apps** don't inherit the shell `PATH`, so give the absolute path from `which prism`.
- **With Node.js**, `"command": "npx", "args": ["-y", "@misoncotech/prism", "mcp", "serve", "--read-only"]` works
  without installing prism.
- **On Windows**, write it as `"command": "cmd", "args": ["/c", "npx", ...]`.

## Tokens for MCP

A personal access token is safer than the user's session: it has scopes, expires and can be revoked without
signing the user out. The user creates it from a signed-in CLI:

```bash
prism auth tokens create --name claude-read  --scope read --expires 30d -q
prism auth tokens create --name claude-tasks --scope read --scope tasks:write --expires 30d -q
prism auth tokens create --name claude-all   --scope read --scope write --expires 30d -q   # every tool
```

| Toolsets | Read | Write |
|---|---|---|
| context, sprints, search, activity | `read` | (read only) |
| tasks | `read` | `tasks:write` |
| projects, automations | `read` | `projects:write` |
| meetings | `read` | `meetings:write` |
| notifications | `read` | `notifications:write` |

Never write a token into a file that is committed (for example a project `.mcp.json`).
