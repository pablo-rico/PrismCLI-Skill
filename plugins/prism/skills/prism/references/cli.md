# prism CLI reference for agents

Commands follow `prism <resource> <action> [args] [flags]`. `prism <command> --help` shows examples, and
`prism schema [command]` gives the machine-readable catalog. It lists every command with its args, flags (type,
enum, required, `values_from`), `mutating`, `destructive`, the PAT `scopes` it needs and `output_fields`.

## Output and input

| Need | Flag |
|---|---|
| JSON (the raw API `data`; lists are arrays) | `--json` or `-o json` |
| One JSON object per line (streaming lists) | `-o jsonl` |
| Only full IDs, one per line, to chain commands | `-q` |
| Fewer fields, to save tokens | `--fields id,title,status` (dotted paths allowed) |
| Extract without an external `jq` | `--jq '.[] \| select(.priority=="urgent") \| .id'` |
| More results / all pages | `--limit N`, `--all` |
| Preview a mutating request as `{method,url,body}` | `--dry-run` |
| Long text from a file or stdin | `--description-file notes.md`, `--description-file -` |
| Context for one command | `-w <workspace>`, `-p <project>`, `--client <client>` |

- The CLI never prompts without a TTY.
- Destructive commands exit 2 unless you pass `--yes`. Only pass it when the user asked for that deletion.
- In machine mode, stderr carries exactly one JSON error object: `{"error":{code,message,exit_code,http_status,request_id,details,hint}}`.

## References

- **Full IDs** are always safe.
- **4+ character ID prefixes and exact names** also work, but are ambiguous when several match (exit 2, with
  candidates in `error.details.candidates`).
- **`me`** works wherever a user is expected (`--assignee me`, `--actor me`).
- **Statuses** are per-project columns. Pass a column key (stable), its name or its ID to `--status`. Discover
  them with `prism column list -p $P --json --fields key,name,category,task_count`.
- **Priorities:** `low`, `medium`, `high`, `urgent`.
- **Dates:** `YYYY-MM-DD` or RFC 3339.
- **Durations:** `45`, `90m`, `1h30m`, `1.5h`.

## Context

```bash
prism workspace list --json --fields id,name
prism project list -w $WS --json --fields id,name,visibility
prism workspace use $WS; prism project use $P   # saved defaults (prefer explicit -w/-p in scripts)
prism workspace current --json                  # what is selected and where it comes from
```

## Tasks

```bash
prism task mine -w $WS --json --fields id,title,priority,column_name
prism task list -p $P --sprint active --open --json --fields id,title,status,status_name,assignees
prism task list -p $P --assignee me --tag backend --priority high,urgent --due-before 2026-10-31 --json
prism task list -p $P --unassigned --category todo --json --fields id,title
prism task list -p $P --completed --json --fields id,title,completed_at
prism task show $T --json

T=$(prism task create "Fix login redirect" -p $P --priority high --assignee me --description-file notes.md -q)
prism task update $T --title "Fix login redirect on Safari" --priority urgent --due 2026-10-15
prism task move $T --status in_progress
prism task assign $T me ana@example.com
prism task unassign $T ana@example.com
prism task archive $T
prism task delete $T --yes                      # only when the user asked for it
```

`task list` filters: `--status`, `--category`, `--open`, `--completed`, `--priority`, `--assignee`,
`--unassigned`, `--created-by`, `--tag`, `--cf <fieldId>=<value>`, `--sprint active|none|<id>`, `--q`,
`--due-before`, `--due-after`, `--view`, `--sort`. Check `prism task list --help` for the exact spelling.

## Subtasks, dependencies, recurrence and time

```bash
prism task subtask add $T "Write migration" --assignee me -q
prism task subtask list $T --json --fields id,title,completed
prism task update $OTHER --parent $T             # or --no-parent to detach it (one level only)

prism task dep add $T --blocked-by $OTHER        # a cycle fails: 409 DEPENDENCY_CYCLE (exit 6)
prism task dep list $T --json                    # {blocked_by: [...], blocking: [...]}
prism task dep remove $T $OTHER --yes        # the dependency ID or the task on the other side

prism task recur set $T --freq weekly --weekday mon,thu --until 2026-12-31
prism task recur clear $T                        # completing a recurring task creates the next one

prism task time log $T 1h30m --note "Code review"
prism task time list $T --json
prism time report -p $P --user me --from 2026-09-01 --json --jq '.total_minutes'
```

## Comments, checklist and attachments

```bash
prism task comment add $T "Root cause: expired cookie domain" -q
prism task comment add $T "@Ana please review" --mention ana@example.com -q
prism task comment list $T --json --fields id,author,content,created_at
prism task checklist add $T "Add regression test" "Update docs"
prism task checklist check $T 1
prism task attachment upload $T ./screenshot.png
prism task attachment download $T <attachment> -O ./downloads/
```

## Views and bulk changes

Saved views and `--filter` keys use the task list query names:
- `q`, `assignee`, `unassigned`, `priority`, `tags`, `status`, `category`, `sprint`;
- `due_before`, `due_after`, `created_by`, `completed`, `cf.<fieldId>`.

Write list values comma-separated. A bulk change covers at most 200 tasks and applies all or nothing.

```bash
prism view create "My open bugs" -p $P --assignee me --tag bug --open      # --shared for the whole project
prism task list -p $P --view "My open bugs" --json --fields id,title,status
prism task bulk update -p $P --filter priority=low --filter sprint=active --backlog --dry-run
prism task bulk archive -p $P --view "Done this sprint" -q
```

## Board, columns and sprints

```bash
prism board show -p $P --summary                 # task count per column in the active sprint
prism board show -p $P --json --jq '.columns[] | {name, category, tasks: [.tasks[].title]}'
prism column create "QA" -p $P --category in_progress
prism column delete qa -p $P --move-to review --yes   # a column with tasks needs --move-to
prism sprint current -p $P --json
prism sprint create "Sprint 12" -p $P --start 2026-10-01 --end 2026-10-14 --from active -q
prism sprint close <sprint> -p $P
```

## Projects, templates and automations

```bash
prism project create "Mobile app" -w $WS --template scrum -q    # builtin:scrum|kanban|bugs or a saved one
prism template list -w $WS --json
prism template save -p $P --name "Client onboarding" --include-tasks -q

prism automation create "Thank on done" -p $P --trigger status_changed --trigger-config to_category=done \
  --action 'add_comment:{"content":"Thanks!"}' -q
prism automation runs "Thank on done" -p $P --json --fields created_at,status,task_title,error
prism automation update "Thank on done" -p $P --disable
```

## Customers (CRM)

Customers are the companies a workspace works for: tax details, contacts (one primary), an internal owner and a
dated notes history. They are **not** clients (`prism client` is the organization that owns workspaces).
Members read them, editors write them (`customers:write`), guests cannot see them. Reference a customer by exact
name, tax ID or ID; a contact by name, email or ID. A name or tax ID already used in the workspace fails with
`CUSTOMER_EXISTS` (exit 6) and the hint names the existing customer.

```bash
prism customer list -w $WS --search acme --status active --mine --json --fields id,name,tax_id,owner
prism customer show "Acme Corp" -w $WS --json          # contacts and linked projects
C=$(prism customer create "Acme Corp" -w $WS --tax-id B12345678 --email hello@acme.test --owner me -q)
prism customer update $C -w $WS --status active --website ""     # an empty value clears a field; --no-owner
prism customer contact add $C "Laura Gómez" -w $WS --email laura@acme.test --job-title CTO --primary
prism customer note add $C "Call: renewal in March" -w $WS
prism customer note list $C -w $WS --json --fields body,author,created_at
prism project update -p $P --customer "Acme Corp"      # link a project; --no-customer unlinks it
prism customer delete $C -w $WS --yes                  # only when the user asked for it
```

Imports (CSV or .xlsx, up to 5 MB and 5,000 rows) never guess the columns: preview the file, show the user the
columns and the suggested mapping, and import with the mapping they confirm. Only mapped columns are imported;
one must be `name`. Fields: `name`, `status`, `tax_id`, `email`, `phone`, `website`, `address`, `city`,
`postal_code`, `country`, `notes`, `owner_email`, `contact_name`, `contact_email`, `contact_phone`,
`contact_job_title`.

```bash
prism customer import-preview clientes.xlsx -w $WS     # columns, examples and a suggested import line
prism customer import clientes.xlsx -w $WS --map 'Razón social=name' --map CIF=tax_id --map '#4=contact_email' --json
# --map 'Header=field' (case-insensitive) or '#N=field' (1-based); --no-header, --sheet, --default-status
```

The result lists `created`, `skipped` (already existing: `duplicate_name`, `duplicate_tax_id`,
`duplicate_in_file`), `errors` (`missing_name`, `invalid_status`, `invalid_email`) and `warnings` by row.

## Noticeboard

Each workspace has a noticeboard of announcements, incidents and notes (Markdown). Only workspace admins post,
edit, pin and delete, and **every post notifies all members**. Editors resolve and reopen incidents and create
their task. Reference an entry by exact title or ID.

```bash
prism noticeboard list -w $WS --kind incident --status open --json --fields id,title,severity,task
prism noticeboard list -w $WS --highlights                 # pinned entries and open incidents (dashboard)
I=$(prism noticeboard post "Payments API down" -w $WS --kind incident --severity high --body-file incident.md -q)
prism noticeboard task $I -w $WS -p $P --assignee me       # task with priority from severity; needs tasks:write
prism noticeboard resolve $I -w $WS                        # or reopen
prism noticeboard edit $I -w $WS --pinned=false            # editing does not notify
```

## Meetings, notifications, search and activity

```bash
M=$(prism meeting create "Sprint review" -w $WS --start 2026-10-14T15:00:00Z -q)
prism meeting note add $M "Decided to ship on Friday"
prism meeting poll create $M --question "Ship on Friday?" --option Yes --option No -q
prism meeting poll vote $M 1 --option Yes

prism notification list --unread --json --fields id,title,type
prism notification read --all

prism search "login" -w $WS --type task --json
prism search "rollback" -w $WS --type comment --json --fields task_id,snippet

prism activity feed -w $WS --project $P --actor me --limit 20 --json --fields created_at,action,resource_title
```

## Exports

The API generates the CSV. The CLI never overwrites a file without `--force`.

```bash
prism export tasks -p $P --open --assignee me -O mine.csv
prism export time -p $P --from 2026-09-01 --to 2026-09-30 -O -
prism export customers -w $WS --status active -O customers.csv   # same as `prism customer export`
```

## Anything else: `prism api`

```bash
prism api /auth/me
prism api POST /tasks/$T/comments -f content="Hello"
prism api /projects/$P/tasks --paginate --jq '.[].title'
```

`prism api` adds authentication, retries and the `/api/v1` prefix. Use it only when no dedicated command exists.

## Retries and idempotency

- The CLI retries transient failures by itself.
- POST and PATCH requests carry an `Idempotency-Key`. If you rerun a whole command after a timeout, pass the same
  `--idempotency-key <key>` to avoid duplicates.
