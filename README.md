# hap-token-refresh-daily

A local MCP proxy that solves the problem of **using the same MingDao HAP MCP across multiple devices**.

## Background

MingDao HAP MCP requires a Bearer token for authentication. This token is valid until 23:59 of the current day. This proxy handles token management automatically:

- On first use each day, fetches a fresh token from the HAP workflow hook
- Caches the token locally until the end of the day
- On the next day, automatically refreshes the token

This way you never need to manually update your token, even when switching between devices.

## Prerequisites

- Node.js >= 16
- You must have your **account_id**, **key**, and **appname** — these are issued by the application admin
- **You must be added to the HAP application by an admin before use**

> To get access, contact **Andy Lei** for instructions on how to join the application.

### Why `appname`?

Since 2026-04 the MingDao workflow hook requires an `appname` parameter so a single hook endpoint can route credentials for multiple HAP applications. Ask your admin which `appname` value your account is registered under.

## Setup

### 1. Clone this repo

```bash
git clone https://github.com/andyleimc-source/hap-token-refresh-daily.git
cd hap-token-refresh-daily
```

### 2. Register the MCP server with Claude Code

Run the following command (user scope, available in all projects):

```bash
claude mcp add -s user mingdao node /path/to/hap-token-refresh-daily/index.js YOUR_ACCOUNT_ID YOUR_KEY YOUR_APPNAME
```

Replace:
- `/path/to/hap-token-refresh-daily/index.js` → full path to the cloned repo
- `YOUR_ACCOUNT_ID` → your MingDao account ID
- `YOUR_KEY` → your personal key issued by the admin
- `YOUR_APPNAME` → the HAP application name your account is registered under

> The command writes the server config to `~/.claude.json`. MCP servers do **not** go in `~/.claude/settings.json` — that file's schema does not accept an `mcpServers` field.

To verify, run `claude mcp list` and confirm `mingdao` appears.

### 3. Restart Claude Code

The MingDao MCP tools will appear automatically on next session start.

## How It Works

```
Claude Code → stdio (JSON-RPC) → this proxy
                                      ↓
                              Check ~/.cache/mingdao-mcp-token.json
                              If today's token exists → reuse it
                              If new day → fetch fresh token → cache it
                                      ↓
                              HTTPS POST → api2.mingdao.com/mcp
```

## Token Cache

The token is cached at `~/.cache/mingdao-mcp-token.json`. This file is local to your machine and is never committed to the repo (see `.gitignore`).

## Related Projects

Both projects solve the MingDao MCP token refresh problem, but for different deployment scenarios:

| | This repo | [mingdao-mcp-setup](https://github.com/andyleimc-source/mingdao-mcp-setup) |
|---|---|---|
| **How it runs** | Local machine (Node.js proxy) | Cloud / server (OAuth + cron) |
| **Token source** | HAP workflow hook (daily key) | OAuth access_token + refresh_token |
| **Refresh trigger** | On first use each day | Every 20 hours via cron |
| **Requirements** | Node.js, account_id + key + appname | macOS, OAuth credentials |

If you have OAuth credentials (CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN), use **[mingdao-mcp-setup](https://github.com/andyleimc-source/mingdao-mcp-setup)** for a more automated, daemon-based setup.

## License

MIT
