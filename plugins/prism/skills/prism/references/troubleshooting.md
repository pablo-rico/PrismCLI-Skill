# Prism errors and how to react

The CLI exits with these codes. In machine mode it writes one JSON object to stderr:
`{"error":{code,message,exit_code,http_status,request_id,details,hint}}`. MCP tools return the same object with
`isError: true`.

| Exit | Codes | Meaning | What to do |
|---|---|---|---|
| 0 | | Success | |
| 1 | | Generic error | Read `message` |
| 2 | `USAGE_ERROR` | Bad flags or arguments, an ambiguous reference, or a missing `--yes` | Fix the call. For ambiguity, pick an ID from `error.details.candidates`. An unknown status lists the valid ones |
| 3 | `NOT_AUTHENTICATED`, `TOKEN_EXPIRED`, `SESSION_REVOKED` | No or invalid credentials | See [setup.md](setup.md#2-is-it-authenticated). Do not loop |
| 4 | `NOT_FOUND` | The resource does not exist or the user cannot see it | Re-list and resolve the reference again |
| 5 | `FORBIDDEN`, `INSUFFICIENT_SCOPE`, `SESSION_REQUIRED`, `APPROVAL_REQUIRED` | No permission | `INSUFFICIENT_SCOPE`: the token needs `error.details.required_scope`. `SESSION_REQUIRED`: use a browser login, not a token. `APPROVAL_REQUIRED`: the column needs the `task.approve` permission |
| 6 | `VALIDATION_ERROR`, `CONFLICT`, `DEPENDENCY_CYCLE`... | Invalid data or a conflict | Read `message` / `details` and correct the input |
| 7 | `RATE_LIMITED` | Too many requests, after the CLI's own retries | Wait (`Retry-After`) and try once more |
| 8 | `NETWORK_ERROR` | API unreachable or timeout | See "Network" below |
| 9 | `SERVER_ERROR` | API failure | Retry later. Report `request_id` to the user |

## Common situations

**`prism: command not found`, or the MCP server does not start.** The CLI is not installed, or it is not on the
`PATH` of the app that launches it. Install it ([setup.md](setup.md#1-is-the-cli-installed)). For desktop apps, use
the absolute path in the MCP config, or `npx -y @misoncotech/prism`.

**`warning: ignoring api_url ...`.** An old `api_url` is stored in the profile. It is harmless; the user can clear it
with `prism config unset api_url`.

**`credentials ... belong to <host>` (exit 3).** The stored session was created for another server. Run
`prism auth login` again.

**The login page says the code does not work.** Codes expire after about 10 minutes and work once. Run
`prism auth login` again.

**A write tool is missing over MCP.** The server runs with `--read-only` (the plugin default) or a narrow
`--toolsets`. Use the CLI for that write, or register a write-enabled server ([mcp.md](mcp.md#server-flags)).
`prism mcp tools` lists what a set of flags registers.

**`no project selected` / `no workspace selected` (exit 2).** Pass `-p` / `-w`, or `project_id` / `workspace_id`
over MCP. Find the IDs with `prism project list` or `list_projects`.

## Network (exit 8)

- **Check reachability:** `prism doctor` checks the API and prints the URL it uses.
- **Codex sandbox:** Codex may run commands with network access disabled, and then every `prism` call fails with
  exit 8. Ask the user to approve the command with network access, or to enable network for the sandbox
  (`sandbox_workspace_write.network_access = true` in `~/.codex/config.toml`).
- **Credential store:** a sandbox may also block the OS keychain. If `auth status` cannot read the stored login,
  use `PRISM_TOKEN`.

## Retrying safely

- **The CLI retries** transient failures by itself (429, 5xx, network) before it exits.
- **Rerunning a mutating command yourself:** pass the same `--idempotency-key` so the API does not apply it twice.
- **MCP write tools:** check the current state with a read tool before retrying them.
