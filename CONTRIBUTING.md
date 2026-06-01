# Contributing

Thanks for your interest in improving the ZEP MCP Server! This server focuses on
ZEP's **HR & time-tracking** modules; contributions that add other ZEP modules are
very welcome (see below).

## Development setup

```bash
git clone https://github.com/paulkatio/zep-mcp-server.git
cd zep-mcp-server
npm install
npm test          # unit tests (no network)
npm run typecheck
npm run lint
npm run build
```

Node ≥ 20 is required.

## Branch & commit conventions

- Branches: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`). **Do not add a co-author
  trailer** (no `Co-Authored-By:`) — keep authorship clean.
- Every change that affects the published package needs a Changeset:
  `npx changeset` → pick the bump → commit the generated file.

## Tests are mandatory for new tools

Each tool needs unit tests in `tests/unit/tools/` covering: happy path (assert the
exact `{method, path[, query/body]}` and `structuredContent`), 404 → `isError`,
module-gate 404 → friendly message, and strict-mode/required-field validation.
HTTP is mocked — `vi.mock` of the http client for tools, undici `MockAgent` for the
transport layer. Coverage gate is **80 % lines**.

## Adding a new ZEP module

The 51 endpoints ZEP exposes beyond HR/time are listed in
[`schemas/zep-inventory.json`](./schemas/zep-inventory.json). To add a module:

1. **Verify** the endpoints exist for a tenant that has the module
   (re-run `node scripts/discover-zep-endpoints.mjs` against that tenant).
2. **Schemas** — add request-body schemas to `src/schemas/manual.ts` (sourced from
   the ZEP OpenAPI spec or the live docs; omit fields you cannot confirm — allow-list
   principle) and any new identifiers to `src/schemas/identifiers.ts`.
3. **Tools** — create `src/tools/<module>.ts` mirroring the existing tool files
   (When/How/What descriptions, `runList`/`runGet`/`getMergePut` helpers, annotations),
   and register them in `src/server.ts`.
4. **Tests** — add `tests/unit/tools/<module>.test.ts`.
5. **Docs** — update the tool tables in both READMEs and add a Changeset.

## Live integration tests

`tests/integration/live.test.ts` runs **real** read-only GETs (and an optional,
double-gated create cycle). They need a real `ZEP_TEST_TOKEN` (and tenant), so they
are **skipped by default and never run in CI**. Run them locally:

```bash
ZEP_TEST_TOKEN=... ZEP_TEST_TENANT=yourtenant npx vitest run tests/integration
```

## Secret hygiene

Never commit a real `ZEP_API_TOKEN` or tenant-specific PII. `.env` is gitignored;
fixtures are anonymized. As a safety net, consider a local pre-commit hook that
greps staged files for token-like strings — e.g. with
[simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) or
[husky](https://typicode.github.io/husky/) — before pushing.
