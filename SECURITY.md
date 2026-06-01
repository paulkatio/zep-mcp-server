# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub Security Advisories:
**[Report a vulnerability](https://github.com/paulkatio/zep-mcp-server/security/advisories/new)**.

Do not open a public issue for security problems. You'll get an acknowledgement and,
where applicable, a coordinated fix and disclosure.

## Supported versions

The latest `0.x` release is supported. Pre-1.0, fixes land on the newest minor.

## Scope

**In scope:** vulnerabilities in this server's code — e.g. token leakage in logs or
outputs, injection via tool inputs, missing input validation, unsafe handling of API
responses.

**Out of scope:**

- The ZEP REST API itself (report those to provista GmbH / ZEP support).
- Vulnerabilities in third-party dependencies — these are tracked and updated via
  Dependabot. If a dependency CVE affects this server specifically, do report it.

## Token-handling recommendations for users

- The `ZEP_API_TOKEN` is a Bearer token with the rights of the "ZEP-Schnittstellen"
  module. Treat it like a password.
- Pass it via the MCP client's `env` config or a local `.env` — **never** commit it.
- The server only sends the token in the `Authorization` header; it is redacted in
  logs and never returned to the LLM. Verify your own logging does the same.
- Use a least-privilege ZEP user for the token where possible.
- Rotate the token if you suspect exposure (regenerate it in the ZEP module).
