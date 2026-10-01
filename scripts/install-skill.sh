#!/bin/sh
# Installs the prism skill without a plugin marketplace by linking it into the
# skill folders of Claude Code (~/.claude/skills) and Codex (~/.agents/skills).
# Usage: scripts/install-skill.sh [--claude] [--codex] [--copy]
#   (no target flag: both; --copy copies instead of linking, so later
#   changes to this repository are not picked up)
set -eu

src="$(cd "$(dirname "$0")/.." && pwd)/plugins/prism/skills/prism"
claude=0 codex=0 copy=0
for arg in "$@"; do
  case "$arg" in
    --claude) claude=1 ;;
    --codex) codex=1 ;;
    --copy) copy=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
[ "$claude" = 0 ] && [ "$codex" = 0 ] && claude=1 codex=1

install_to() {
  dest="$1/prism"
  mkdir -p "$1"
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    echo "$dest already exists; remove it first to reinstall" >&2
    return 1
  fi
  if [ "$copy" = 1 ]; then cp -R "$src" "$dest"; else ln -s "$src" "$dest"; fi
  echo "Installed the prism skill in $dest"
}

[ "$claude" = 1 ] && install_to "$HOME/.claude/skills"
[ "$codex" = 1 ] && install_to "$HOME/.agents/skills"

cat <<'MSG'

The skill teaches the agent to use the prism CLI. To also give it the MCP tools:
  claude mcp add prism -- prism mcp serve --read-only
  codex mcp add prism -- prism mcp serve --read-only
MSG
