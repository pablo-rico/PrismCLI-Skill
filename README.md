# Prism skills for Claude and Codex

Lets Claude (Claude Code, Claude Desktop, claude.ai) and OpenAI Codex work in [Prism](https://prism.misoncotech.com):
projects, tasks, subtasks, dependencies, sprints, boards, time tracking, automations, meetings and notifications.

The `prism` plugin contains:

- **The `prism` skill.** It teaches the agent to use the [prism CLI](https://github.com/misoncotech/prism-cli),
  the Prism MCP tools, or both:
  - which interface to pick;
  - the setup and login checks;
  - safe-operation rules;
  - CLI recipes;
  - the MCP tool catalog with parameters and token scopes;
  - error handling.
- **The Prism MCP server** (`prism mcp serve --read-only`), registered for you in Claude Code and Codex.

## Requirements

- **The prism CLI**, installed and signed in on the same machine. MCP runs locally over stdio: there is no remote
  Prism MCP endpoint.
  ```bash
  npm install -g @misoncotech/prism     # or: brew install misoncotech/tap/prism
  prism auth login                      # approve the device at prism.misoncotech.com/device
  ```
- **Optionally, a personal access token for agents.** Export it as `PRISM_TOKEN` in the environment that starts
  the client:
  ```bash
  prism auth tokens create --name agent --scope read --scope tasks:write --expires 30d -q
  ```

## Install

### Claude Code (plugin: skill + MCP)

```text
/plugin marketplace add misoncotech/prism-skills
/plugin install prism@misoncotech
```

Or from a shell: `claude plugin marketplace add misoncotech/prism-skills` and then
`claude plugin install prism@misoncotech`.

### Codex (plugin: skill + MCP)

```bash
codex plugin marketplace add misoncotech/prism-skills
codex plugin add prism@misoncotech
```

### Skill only (Claude Code and Codex, no marketplace)

```bash
git clone https://github.com/misoncotech/prism-skills && cd prism-skills
scripts/install-skill.sh            # links into ~/.claude/skills and ~/.agents/skills (--claude / --codex / --copy)
claude mcp add prism -- prism mcp serve --read-only    # optional: the MCP tools
codex mcp add prism -- prism mcp serve --read-only
```

### claude.ai and Claude Desktop

1. Run `make package`. It writes `dist/prism-skill.zip`.
2. Upload the zip in **Settings → Capabilities → Skills**.
3. For the MCP tools in Claude Desktop, add the server to `claude_desktop_config.json`. See
   [references/mcp.md](plugins/prism/skills/prism/references/mcp.md#register-the-server-in-a-client).

claude.ai on the web cannot run local MCP servers, so the skill there can only explain Prism, not act on it.

## Write access over MCP

The plugin registers the MCP server read-only, so an agent can't change data through MCP unless you allow it.
Writes still work through the CLI, which the skill teaches. To also expose MCP write tools, add a second server:

```bash
claude mcp add prism-write -- prism mcp serve --toolsets tasks,sprints,search
codex mcp add prism-write -- prism mcp serve --toolsets tasks,sprints,search
```

Delete tools are only available with `--allow-destructive`.

## Layout

```text
.claude-plugin/marketplace.json     Claude Code marketplace
.agents/plugins/marketplace.json    Codex marketplace
plugins/prism/
  .claude-plugin/plugin.json        Claude Code plugin manifest
  .codex-plugin/plugin.json         Codex plugin manifest
  .mcp.json                         MCP server: prism mcp serve --read-only
  skills/prism/
    SKILL.md                        entry point (loaded when the task is about Prism)
    agents/openai.yaml              Codex display metadata
    references/                     setup, cli, mcp, troubleshooting (loaded on demand)
scripts/                            validate.mjs, install-skill.sh, package-skill.sh
```

## Development

```bash
make validate    # marketplaces, manifests, skill frontmatter and links (+ claude plugin validate)
make package     # dist/prism-skill.zip
```

- **Keep both manifests in sync.** Bump `version` in `plugins/prism/.claude-plugin/plugin.json` and
  `.codex-plugin/plugin.json` together; `validate` checks that they match.
- **Test local changes.** Load the plugin without installing it with `claude --plugin-dir plugins/prism`, or add the
  repository path as a marketplace (`codex plugin marketplace add .`).
- **Check new commands and tools.** When the CLI gains commands or MCP tools, verify them with `prism schema` and
  `prism mcp tools`, and update the references.
