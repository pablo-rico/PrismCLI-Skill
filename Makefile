.PHONY: help validate package install-skill

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

validate: ## Check marketplaces, manifests and skills (and claude plugin validate when available)
	node scripts/validate.mjs
	@if command -v claude >/dev/null 2>&1; then claude plugin validate . && claude plugin validate plugins/prism; fi

package: ## Zip the skill for claude.ai into dist/prism-skill.zip
	scripts/package-skill.sh

install-skill: ## Link the skill into ~/.claude/skills and ~/.agents/skills
	scripts/install-skill.sh
