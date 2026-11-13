# nexus-data – Claude Code plugin

Gives Claude Code tools for the NEXUS Data API: search Danish companies, read register records, people, locations, financials, summaries and news & developments. It has a skill that tells Claude which tool to use and what each one costs.

The tools run in a small local MCP server (`server/index.mjs`, Node 18+, no dependencies). It calls the API with your own key, so your usage is counted against your plan.

## Install

1. Get a **secret** NEXUS key (`nx_live_sk_…`) from the NEXUS admin. It needs these scopes:
   - `cvr:read`
   - `cvr:financials:read`
   - `cvr:about:read`
   - `cvr:developments:read`
   - `cvr:segment:read`
2. Put the key in your shell profile, e.g. `~/.zshrc`, and open a new terminal:

   ```sh
   export NEXUS_API_KEY="nx_live_sk_..."
   ```

3. In Claude Code, add the marketplace and install the plugin:

   ```
   /plugin marketplace add MortenGad/NEXUSDataPlugin
   /plugin install nexus-data@nexus
   ```

4. Restart Claude Code. `/mcp` should list `nexus-data` as connected.

Try: *"Find the CVR number for itm8 and show its last five years of revenue and net profit."*

## Settings

| Variable | Default |
| --- | --- |
| `NEXUS_API_KEY` | none, required |
| `NEXUS_API_BASE` | `https://func-nexus-data-api-8ddb.azurewebsites.net/api` |

## Troubleshooting

| Error | Meaning |
| --- | --- |
| `NEXUS_API_KEY is not set` | Claude Code was started without the variable. Export it and restart. |
| HTTP 401 | The key is wrong or revoked. |
| HTTP 403 `missing scope: …` | Ask the admin to add that scope to your key. |
| HTTP 403 `ip '…' not allowed` | The key has an IP rule and this machine isn't on it. |
| HTTP 429 | The monthly quota is used up, or research was retried within five minutes. |
