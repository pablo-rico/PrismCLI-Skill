#!/bin/sh
# Zips the prism skill for upload to claude.ai (Settings > Capabilities > Skills)
# or the Claude API. Output: dist/prism-skill.zip
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/dist"
rm -f "$root/dist/prism-skill.zip"
cd "$root/plugins/prism/skills"
zip -qr "$root/dist/prism-skill.zip" prism -x '*.DS_Store'
echo "$root/dist/prism-skill.zip"
