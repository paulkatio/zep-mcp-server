# Deploying to a self-hosted MCPHub (MetaMCP)

This server is distributed as **source** — there is no npm package. Clone, build, and point your
MCP client or hub at the built `dist/index.js`. This guide covers a self-hosted
[MetaMCP](https://github.com/metatool-ai/metamcp)/MCPHub instance (e.g. `mcp.ssig-it.com`), where
the ZEP server appears in the dashboard next to your other servers (3CX, Autotask, Datto RMM, …).

## 1. Build on the server

```bash
# On the MCPHub host:
cd /opt/mcp-servers            # wherever your servers live
git clone https://github.com/paulkatio/zep-mcp-server.git
cd zep-mcp-server
npm ci
npm run build                 # produces dist/index.js
```

Requires **Node.js ≥ 20** on the host.

## 2. Register in the MCPHub dashboard

Add a server with:

| Field | Value |
| --- | --- |
| **Type** | STDIO |
| **Command** | `node` |
| **Args** | `/opt/mcp-servers/zep-mcp-server/dist/index.js` |
| **Env** | `ZEP_API_TOKEN=<your bearer token>` · `ZEP_TENANT=zepssigit` |

`ZEP_TENANT` is the path segment of your ZEP login URL
(`https://www.zep-online.de/<TENANT>/…`). Optional env vars (timeouts, concurrency, log level,
audit-log path) are listed in the [README](../README.md#environment-variables).

> **Secrets:** keep `ZEP_API_TOKEN` in the hub's secret store / env, never in the repo. The server
> only sends it in the `Authorization` header and redacts it from logs.

## 3. Update workflow

```bash
cd /opt/mcp-servers/zep-mcp-server
git pull
npm ci
npm run build
# then restart the server in the MCPHub dashboard
```

## 4. Smoke-test (optional)

The server logs to **stderr** and keeps **stdout** clean for the JSON-RPC stream. A quick local check:

```bash
ZEP_API_TOKEN=<token> ZEP_TENANT=zepssigit node dist/index.js
# stderr should show: {"...","msg":"zep_mcp_started"} and "ZEP MCP Server running on stdio."
# Ctrl-C to stop (graceful shutdown).
```

For a full tool walkthrough use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Troubleshooting

- **401** — token missing/expired or the ZEP "ZEP-Schnittstellen" module is not active.
- **404 on first call** — wrong identifier type (employees use `username`, not numeric id) or a
  wrong `ZEP_TENANT`.
- **"… not enabled for your ZEP module/licence"** — module gate; that feature isn't licensed for
  your tenant (see [`schemas/zep-inventory.json`](../schemas/zep-inventory.json)).
