# nexus-data – Claude Code plugin

Gives Claude Code tools for the NEXUS Data API: search Danish companies, read register records, people, locations, financials, summaries and news & developments. A skill tells Claude which tool to use and what each one costs.

The tools run on NEXUS's own server (`/api/mcp`), so nothing needs installing beyond the plugin. Calls use your own key and count against your plan.

## Install

1. Get a **secret** NEXUS key (`nx_live_sk_…`) from the NEXUS admin. It needs these scopes:
   - `cvr:read`
   - `cvr:financials:read`
   - `cvr:about:read`
   - `cvr:developments:read`
   - `cvr:segment:read`
2. In Claude Code:

   ```
   /plugin marketplace add MortenGad/NEXUSDataPlugin
   /plugin install nexus-data@nexus
   ```

   Claude asks for the key. It is masked and stored in the system keychain.
3. Restart Claude Code. `/mcp` should list `nexus-data` as connected.

Try: *"Find the CVR number for itm8 and show its last five years of revenue and net profit."*

To change the key later: `/plugin configure nexus-data@nexus`.

### Upgrading from 0.1.x

0.1.x ran a local server and needed Node.js and `NEXUS_API_KEY`. Neither is needed now. Run `/plugin marketplace update nexus`, then `/plugin update nexus-data@nexus`, and enter your key when asked. You can delete the `NEXUS_API_KEY` line from `~/.zshrc`.

## Troubleshooting

| Problem | Meaning |
| --- | --- |
| `/mcp` shows nexus-data as failed | The key is wrong or revoked (401), this machine's IP is not allowed for the key (403), or the monthly quota is used up (429). Check the key with `/plugin configure nexus-data@nexus`. |
| A tool returns HTTP 403 `missing scope: …` | Ask the admin to add that scope to your key. |
| A tool returns HTTP 429 | The monthly quota is used up, or research was retried within five minutes. |
