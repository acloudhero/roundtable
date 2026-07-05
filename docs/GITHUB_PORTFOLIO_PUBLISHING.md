# GitHub Portfolio Publishing Checklist

This checklist turns the packaged RoundTable repo into a visible portfolio project.

## 1. Local verification

From the repo root:

```bash
npm ci
npm run verify
```

Expected result:

```text
production build passes
acceptance walk: 15 pass, 0 partial, 0 fail
npm audit: 0 vulnerabilities at the configured audit threshold
```

## 2. Create the public GitHub repo

Recommended repo name:

```text
roundtable
```

Recommended visibility:

```text
Public
```

Recommended description:

```text
Local-first React/TypeScript PWA for coordinating manual multi-model AI workflows with prompt provenance, Markdown handoff, import safety, and rollback.
```

Recommended topics:

```text
react typescript vite pwa local-first ai-workflow llm prompt-engineering state-management markdown netlify portfolio
```

## 3. Push from the command line

```bash
git init
git add .
git commit -m "Publish RoundTable portfolio project"
git branch -M main
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/roundtable.git
git push -u origin main
```

Or, if using the GitHub CLI:

```bash
gh repo create roundtable --public --source=. --remote=origin --push
```

## 4. Add the README sections GitHub surfaces well

GitHub will automatically display:

- `README.md`
- `LICENSE`
- `.github/workflows/ci.yml`
- repo topics
- repo description

After pushing, check that the README opening paragraph, portfolio summary, setup commands, and documentation map are visible without scrolling too far.

## 5. Enable Actions

The included workflow runs on pushes and pull requests:

```text
npm ci
npm run verify
```

After the first push, confirm that the Actions tab shows a passing CI run. That green check is useful in a portfolio review.

## 6. Confirm the live demo URL

The current live demo is hosted on Netlify:

```text
https://rtrc.netlify.app/
```

Use that URL for the GitHub repo Website field and the README live demo link. Cloudflare Pages can be prepared as an optional/future deployment path, but it is not the current live demo for this publication.

## 7. Optional future Cloudflare Pages deployment

Cloudflare Pages can be used later because `ericharrisportfolio.com` already lives on Cloudflare.

Recommended Cloudflare Pages settings:

```text
Framework preset: React (Vite) or None
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 20 or 22
```

Optional future demo URL:

```text
https://roundtable.ericharrisportfolio.com
```

Only replace the GitHub repo Website field after that Cloudflare URL becomes the designated current live demo.

## 8. Pin the repo

Pin `roundtable` on the GitHub profile next to the StoryTime and AsterTel projects.

## 9. Portfolio-site copy

Use this wording on the portfolio page:

```text
RoundTable is a local-first React/TypeScript PWA for coordinating manual multi-model AI workflows. It generates model-specific prompts, preserves copy/paste provenance, captures responses, builds mediator packets, records decisions, and supports Markdown handoff artifacts with hash validation, stale-state warnings, raw-note fallback, import history, and rollback.
```

## 10. What not to commit

Do not commit:

- real exported project states
- private model responses
- customer data
- screenshots containing sensitive project text
- `.env` files
- API keys or credentials
- browser localStorage dumps

Use demo data only.
