#!/usr/bin/env node
// Checks the marketplaces, plugin manifests and skills of this repository.
// Usage: node scripts/validate.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const fail = (msg) => errors.push(msg)
const rel = (p) => relative(root, p)

function json(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    fail(`${rel(path)}: ${err.message}`)
    return null
  }
}

// Claude Code marketplace and Codex marketplace must list the same plugins.
const claudeMarket = json(join(root, '.claude-plugin/marketplace.json'))
const codexMarket = json(join(root, '.agents/plugins/marketplace.json'))
const claudePlugins = new Map((claudeMarket?.plugins ?? []).map((p) => [p.name, p.source]))
const codexPlugins = new Map((codexMarket?.plugins ?? []).map((p) => [p.name, p.source?.path]))
if (claudeMarket?.name !== codexMarket?.name) fail('the two marketplaces have different names')
for (const [name, source] of claudePlugins) {
  if (codexPlugins.get(name) !== source) fail(`plugin ${name}: source ${source} in Claude, ${codexPlugins.get(name)} in Codex`)
}
for (const name of codexPlugins.keys()) if (!claudePlugins.has(name)) fail(`plugin ${name} is only in the Codex marketplace`)

for (const [name, source] of claudePlugins) {
  const dir = join(root, source)
  const claude = json(join(dir, '.claude-plugin/plugin.json'))
  const codex = json(join(dir, '.codex-plugin/plugin.json'))
  if (claude?.name !== name || codex?.name !== name) fail(`plugin ${name}: manifest names differ from the marketplace`)
  if (claude?.version !== codex?.version) fail(`plugin ${name}: version ${claude?.version} (Claude) vs ${codex?.version} (Codex)`)
  const mcp = json(join(dir, '.mcp.json'))
  for (const [server, cfg] of Object.entries(mcp?.mcpServers ?? {})) {
    if (!cfg.command) fail(`${rel(dir)}/.mcp.json: server ${server} has no command`)
    if (JSON.stringify(cfg).includes('prism_pat_')) fail(`${rel(dir)}/.mcp.json: server ${server} contains a token`)
  }

  const skillsDir = join(dir, 'skills')
  for (const skill of readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory())) {
    checkSkill(join(skillsDir, skill))
  }
}

// Agent Skills format: name (lowercase, digits, hyphens, at most 64) matching
// the folder, and a description of at most 1024 characters; every relative
// link must exist.
function checkSkill(dir) {
  const file = join(dir, 'SKILL.md')
  if (!existsSync(file)) return fail(`${rel(dir)}: missing SKILL.md`)
  const text = readFileSync(file, 'utf8')
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!fm) return fail(`${rel(file)}: missing frontmatter`)
  const field = (k) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm[1])?.[1].trim()
  const name = field('name')
  const description = field('description')
  if (!name || !/^[a-z0-9-]{1,64}$/.test(name)) fail(`${rel(file)}: invalid name ${name}`)
  if (name !== dir.split('/').pop()) fail(`${rel(file)}: name ${name} does not match its folder`)
  if (!description) fail(`${rel(file)}: missing description`)
  else if (description.length > 1024) fail(`${rel(file)}: description has ${description.length} characters (max 1024)`)
  const lines = text.split('\n').length
  if (lines > 500) fail(`${rel(file)}: ${lines} lines; move details to references/ (max 500)`)

  for (const md of [file, ...readdirSync(join(dir, 'references')).map((f) => join(dir, 'references', f))]) {
    const body = readFileSync(md, 'utf8')
    for (const [, target] of body.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/.test(target)) continue
      if (!existsSync(resolve(dirname(md), target))) fail(`${rel(md)}: broken link ${target}`)
    }
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'))
  process.exit(1)
}
console.log(`✓ ${claudePlugins.size} plugin(s) valid`)
