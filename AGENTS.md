# AGENTS.md

Guidance for AI coding agents and contributors working on `SardorbekR/appstore-connect-mcp`.

## Repository Context

- Detected package manager: `npm`.
- Keep changes small and easy for maintainers to review.
- Prefer documentation, tests, and setup fixes before touching runtime behavior.

## Verification Commands

- `npm install`
- `npm test`
- `npm run build`
- `npm run typecheck`
- `npm run lint`

## Safety Rules

- Do not commit secrets, tokens, wallets, or local environment values.
- Do not perform network, account, payment, or deployment actions without maintainer approval.
- Include the exact verification commands you ran in any PR body.
