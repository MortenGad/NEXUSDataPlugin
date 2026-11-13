---
name: nexus-company-data
description: Look up and analyse Danish companies with the NEXUS Data API tools (nexus-data MCP server) — CVR register records, segment searches, board and management, production units, annual-report financials, company summaries and news & developments. Use when the user asks about a Danish company, a CVR number, a list of companies matching criteria, their financials or recent news, or wants account research or prospect lists built from Danish register data.
---

# NEXUS company data

The `nexus-data` tools read the NEXUS Data API, itm8's copy of the Danish company register (CVR) with financials from published annual reports. Every call is metered against the user's monthly quota, so pick the cheapest tool that answers the question.

## Choosing a tool

| Need | Tool | Units |
| --- | --- | --- |
| Find a company by name or CVR prefix | `search_companies` with `q` or `cvr_prefix` | 1 |
| Build a list by industry, size, area or form | `search_companies` with segment filters | 1 per page |
| One company's core record | `get_company` | 1 |
| Many known CVR numbers at once | `lookup_companies` (up to 100) | 1 each |
| Board, management, owners | `get_people` | 1 |
| Sites / production units | `get_locations` | 2 |
| Extended register details | `get_company_details` | 2 |
| Revenue, profit, equity by year | `get_financials` | 1 |
| Newer reports than get_financials shows | `refresh_financials` | 1 per report |
| What the company does, website, phone | `get_about` | 1 cached, 5 new |
| Saved news & developments | `get_developments` | 1 |
| New news & developments research | `research_developments` | 10 |
| Counts per form and status | `get_segment_facets` | 1 |

## Rules

- **Search by name:** `q` matches the *start* of the name. If nothing comes back, retry with `match: "contains"` (3+ characters) before saying the company doesn't exist.
- **Several matches:** show name, CVR number, city and status, and let the user pick. Don't guess.
- **Prefer the batch call:** for more than a few companies use `lookup_companies` rather than looping `get_company`.
- **Read before you research:** call `get_developments` first. Run `research_developments` only when nothing is saved or the user asks for fresh research. Ask before running it on more than three companies (10 units each, 1–2 minutes each).
- **Paging:** `search_companies` returns at most 100 rows per call. Page with `offset` only as far as the task needs, and tell the user how many pages you read.
- **Distressed companies:** to drop bankrupt or dissolved companies, use `exclude_distressed: true`, which is more reliable than `active_only`.
- **Codes, not labels:** `forms` takes form codes (`form.kode` in results), not "A/S". `industries` takes DB07 section letters A–U.
- **Errors:**
  - A 403 names the missing scope. Tell the user to ask their NEXUS admin for it.
  - A 429 means the monthly quota is used up, or a research run came too soon after the last one.
  - Don't retry either.
- **Cite the source:** say the data comes from CVR / Erhvervsstyrelsen via NEXUS. Give amounts in DKK, with the fiscal year they belong to.
- **Keep the key private:** never print, echo or write `NEXUS_API_KEY`.
