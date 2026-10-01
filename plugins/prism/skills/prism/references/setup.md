# Setting up Prism for an agent

Run the checks yourself. Ask the user for the steps only they can do: installing software, approving the login in
the browser, or creating and sharing a token.

## 1. Is the CLI installed?

```bash
prism version     # "release build"
```

If `prism` is not found, ask the user to install it. Any of these works:

```bash
npm install -g @misoncotech/prism          # Windows, macOS, Linux (Node.js 18+)
brew install misoncotech/tap/prism         # macOS, Linux
go install github.com/misoncotech/prism-cli@latest
```

There are also archives on the GitHub releases of `misoncotech/prism-cli`. `npx @misoncotech/prism <args>` runs it
without installing it.

Release builds only talk to the production API. `--api-url` / `PRISM_API_URL` pointing elsewhere fail with exit 2,
and that is expected.

## 2. Is it authenticated?

```bash
prism auth status --json      # exit 0: signed in (shows host, user, credential kind, expiry); exit 3: not signed in
```

Pick one way to sign in:

- **Browser login, for the user's own machine:** `prism auth login`. It prints a one-time code and opens
  `https://prism.misoncotech.com/device?code=...`. The user checks the code and clicks Approve, and the CLI then
  stores a session that renews itself.
  - From an agent shell, run `prism auth login --no-browser` and give the user the code and the link.
  - The command waits until the user approves, up to 10 minutes.
- **Personal access token, preferred for agents and CI:** the user runs this in a signed-in terminal and gives
  you the token, which is only shown once:
  ```bash
  prism auth tokens create --name my-agent --scope read --scope tasks:write --expires 30d -q
  ```
  Use it as `PRISM_TOKEN=prism_pat_...`. It takes precedence over the stored session and is never refreshed.
  Token management, sessions, password and billing need a browser session and fail with `SESSION_REQUIRED` when
  called with a token.

Never print, log or commit a token. Never ask the user for their password: use the browser login or a token.

## 3. Context

```bash
prism workspace list --json --fields id,name
prism project list -w <workspace> --json --fields id,name
prism workspace current --json
```

Prefer passing `-w` / `-p` on each command. `prism workspace use` / `prism project use` save defaults for the user,
so only use them when the user asks for it.

## 4. MCP server

The Prism plugin for Claude Code and Codex registers `prism mcp serve --read-only` by itself. It needs the CLI
installed (step 1) and authenticated (step 2): either the stored login or `PRISM_TOKEN` in the client's
environment.

To register it by hand, with write tools or with a token, see [mcp.md](mcp.md#register-the-server-in-a-client).
After changing MCP settings the client must reload: restart Claude Desktop, or run `/mcp` in Claude Code.

## 5. Health check

```bash
prism doctor --json   # target API, credential store, API reachability, clock skew, identity and token scopes
```

`--profile` is a flag of `prism`, not of `make`.
