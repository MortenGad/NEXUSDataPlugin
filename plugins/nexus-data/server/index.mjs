#!/usr/bin/env node
// NEXUS Data MCP server: exposes the NEXUS Data API v1 read endpoints as tools.
// Stdio transport, newline-delimited JSON-RPC 2.0, no dependencies (Node 18+).
//
//   NEXUS_API_KEY   required, a secret key (nx_live_sk_...). Never logged.
//   NEXUS_API_BASE  optional, default https://func-nexus-data-api-8ddb.azurewebsites.net/api

import { createInterface } from "node:readline";

const BASE = (process.env.NEXUS_API_BASE || "https://func-nexus-data-api-8ddb.azurewebsites.net/api").replace(/\/+$/, "");
const KEY = process.env.NEXUS_API_KEY || "";
const VERSION = "0.1.0";

const cvr = { type: "string", pattern: "^\\d{8}$", description: "8-digit CVR number" };

const TOOLS = [
  {
    name: "search_companies",
    description:
      "Search Danish companies in CVR. Give at least one of q, cvr_prefix or a segment filter. " +
      "q matches the start of the name by default; use match='contains' to search anywhere (3+ characters). " +
      "Segment filters (everything except q, cvr_prefix, match, active_only, exclude_distressed, limit, offset) need the cvr:segment:read scope. 1 unit per call.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Company name" },
        match: { type: "string", enum: ["prefix", "contains"] },
        cvr_prefix: { type: "string", description: "Start of a CVR number, e.g. 3651" },
        industries: { type: "string", description: "Comma-separated DB07 section letters A-U" },
        forms: { type: "string", description: "Comma-separated company form codes (form.kode), not names like A/S" },
        status: { type: "string", description: "Comma-separated status codes; 0 = no proceedings recorded" },
        postal: { type: "string", description: "Exact postal code" },
        postal_ranges: { type: "string", description: "e.g. 1000-3999,9000-9999" },
        municipality: { type: "string", description: "Municipality code" },
        public_sector: { type: "boolean" },
        min_revenue: { type: "number", description: "DKK" },
        max_revenue: { type: "number", description: "DKK" },
        min_employees: { type: "number" },
        max_employees: { type: "number" },
        active_only: { type: "boolean" },
        exclude_distressed: { type: "boolean", description: "Drop bankrupt, dissolved or ceased companies. Prefer over active_only" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 20" },
        offset: { type: "integer", minimum: 0 },
      },
    },
    run: (a) => {
      const { cvr_prefix, ...rest } = a;
      return call("GET", "/v1/cvr/search", { query: { ...rest, cvr: cvr_prefix } });
    },
  },
  {
    name: "get_company",
    description: "Core register record for one company: name, address, industry, form, status, employees, and key financials when the key has cvr:financials:read. 1 unit.",
    inputSchema: { type: "object", properties: { cvr }, required: ["cvr"] },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}`),
  },
  {
    name: "lookup_companies",
    description: "Batch lookup of up to 100 companies by CVR number. With changed_since, only companies changed after that time are returned. 1 unit per company returned, 2 with include=['contact'].",
    inputSchema: {
      type: "object",
      properties: {
        cvr_numbers: { type: "array", items: cvr, minItems: 1, maxItems: 100 },
        changed_since: { type: "string", description: "ISO 8601 with time zone, e.g. 2026-10-08T02:00:00Z" },
        include_contact: { type: "boolean", description: "Also read phone, email and website live from the register" },
      },
      required: ["cvr_numbers"],
    },
    run: (a) =>
      call("POST", "/v1/cvr/lookup", {
        body: { cvr_nummers: a.cvr_numbers, changed_since: a.changed_since, include: a.include_contact ? ["contact"] : undefined },
      }),
  },
  {
    name: "get_company_details",
    description: "Extended register details for one company, read live from CVR. 2 units.",
    inputSchema: { type: "object", properties: { cvr }, required: ["cvr"] },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}/details`),
  },
  {
    name: "get_people",
    description: "Board, management, owners and other registered roles for one company. 1 unit.",
    inputSchema: { type: "object", properties: { cvr }, required: ["cvr"] },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}/roles`),
  },
  {
    name: "get_locations",
    description: "Production units (sites, P-numbers) for one company. 2 units.",
    inputSchema: { type: "object", properties: { cvr }, required: ["cvr"] },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}/punits`),
  },
  {
    name: "get_financials",
    description: "Key figures from published annual reports, newest first: revenue, gross profit, net profit, equity, employees. Needs cvr:financials:read. 1 unit.",
    inputSchema: { type: "object", properties: { cvr, years: { type: "integer", minimum: 1, description: "Default 5" } }, required: ["cvr"] },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}/financials`, { query: { years: a.years } }),
  },
  {
    name: "refresh_financials",
    description: "Fetch any newly published annual reports for one company from Erhvervsstyrelsen, then return them. Use only when get_financials looks out of date. 1 unit per report fetched.",
    inputSchema: { type: "object", properties: { cvr, years: { type: "integer", minimum: 1 } }, required: ["cvr"] },
    run: (a) => call("POST", `/v1/cvr/${a.cvr}/financials/refresh`, { query: { years: a.years } }),
  },
  {
    name: "get_about",
    description: "Short written summary of the company with website, phone and founding year. Generated from its website on first request. Needs cvr:about:read. 5 units when generated, 1 from cache.",
    inputSchema: { type: "object", properties: { cvr }, required: ["cvr"] },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}/about`),
  },
  {
    name: "get_developments",
    description: "Saved news & developments research for one company: dated, sourced findings and an account priority. Does not start new research. Needs cvr:developments:read. 1 unit.",
    inputSchema: {
      type: "object",
      properties: { cvr, lookback_months: { type: "string", enum: ["standard", "36", "60"], description: "Default standard (6-24 months by category)" } },
      required: ["cvr"],
    },
    run: (a) => call("GET", `/v1/cvr/${a.cvr}/developments`, { query: { lookback_months: a.lookback_months } }),
  },
  {
    name: "research_developments",
    description: "Run new news & developments research on public sources. Takes 1-2 minutes and costs 10 units; results younger than 24 hours are returned instead. Ask the user before running it on many companies.",
    inputSchema: {
      type: "object",
      properties: { cvr, lookback_months: { type: "string", enum: ["standard", "36", "60"] } },
      required: ["cvr"],
    },
    run: (a) => call("POST", `/v1/cvr/${a.cvr}/developments`, { query: { lookback_months: a.lookback_months }, timeoutMs: 240_000 }),
  },
  {
    name: "get_segment_facets",
    description: "Counts of companies by company form and status, for building segment filters. Needs cvr:segment:read. 1 unit.",
    inputSchema: { type: "object", properties: { reklamebeskyttet: { type: "boolean", description: "Only companies with or without advertising protection" } } },
    run: (a) => call("GET", "/v1/cvr/facets", { query: { reklamebeskyttet: a.reklamebeskyttet } }),
  },
];

const HINTS = {
  401: "The key is missing, malformed, unknown or revoked. Check NEXUS_API_KEY.",
  403: "The key was recognised but lacks a scope, or an IP rule refused this machine. Ask the NEXUS admin to add the scope named in the error.",
  429: "Quota reached for this month, or a research run was attempted within five minutes. See the error text.",
};

async function call(method, path, { query, body, timeoutMs = 60_000 } = {}) {
  if (!KEY) throw new Error("NEXUS_API_KEY is not set. Add your NEXUS secret key to the environment and restart Claude Code.");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint = HINTS[res.status] ? ` ${HINTS[res.status]}` : "";
    const err = new Error(`HTTP ${res.status} from ${method} ${url.pathname}: ${text.slice(0, 500) || "(empty body)"}.${hint}`);
    err.apiError = true;
    throw err;
  }
  return text;
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications need no reply
  switch (method) {
    case "initialize":
      return send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "nexus-data", version: VERSION },
          instructions: "Danish company data (CVR register, annual-report financials, people, locations, news & developments) from the NEXUS Data API. Every call is metered in units against the key's monthly quota.",
        },
      });
    case "ping":
      return send({ jsonrpc: "2.0", id, result: {} });
    case "tools/list":
      return send({ jsonrpc: "2.0", id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
      try {
        const text = await tool.run(params.arguments ?? {});
        return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
      } catch (e) {
        const message = e.name === "TimeoutError" ? "The NEXUS Data API did not answer in time." : e.message;
        return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } });
      }
    }
    default:
      return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  handle(msg).catch((e) => send({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32603, message: e.message } }));
});
