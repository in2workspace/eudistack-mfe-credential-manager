# EUDIStack Shared Claude Context

Centralized AI agent definitions, protocol documentation, and development skills shared across all EUDIStack repositories via git submodule.

## Structure

```
agents/              # Agent definitions (developer, reviewer)
docs/
  protocols/         # Cross-cutting protocol specs (OID4VCI, SD-JWT, etc.)
  standards/         # Normative reference URLs
skills/
  java-spring-hexagonal/   # Java/Spring Boot conventions
  angular/                 # Angular conventions
```

## Day-to-Day Workflow

### 1. Edit shared content

Make changes directly in this repo:

```bash
cd eudistack-shared-claude
# Edit agents, docs, or skills
git add .
git commit -m "feat: improve developer agent autonomy rules"
git push
```

### 2. Propagate to all repos

From `eudistack-dev-platform`:

```bash
make sync-claude       # Pulls latest, stages, and commits in each repo
make claude-status     # Verify all repos are on the same version
```

This runs `git submodule update --remote` + `git add` + `git commit` in each repo automatically.

### 3. Push each repo (when ready)

`sync-claude` commits locally but does NOT push. Push each repo when you're ready:

```bash
cd ../eudistack-verifier-core-service && git push
cd ../altia-eudistack-issuer-core-backend && git push
# etc.
```

### Single repo update (alternative)

If you only need to update one repo:

```bash
cd your-repo
git submodule update --remote .claude/shared
git add .claude/shared
git commit -m "chore: update shared Claude context"
git push
```

## Setup

### Add to a new repo

```bash
cd your-repo
git submodule add https://github.com/in2workspace/eudistack-shared-claude.git .claude/shared
git commit -m "chore: add shared Claude context submodule"
```

### Clone a repo that has the submodule

```bash
git clone --recurse-submodules https://github.com/in2workspace/your-repo.git
# Or if already cloned:
git submodule update --init
```

## What goes here vs in each repo

| Content | Here (shared) | Each repo |
|---------|--------------|-----------|
| Agent definitions | Yes | No |
| Protocol specs | Yes | No |
| Normative references | Yes | No |
| Tech stack skills | Yes | No |
| CLAUDE.md | No | Yes (project-specific) |
| SRS / deployment docs | No | Yes |
| Technical debt tracker | No | Yes |
| Architecture docs | No | Yes |
