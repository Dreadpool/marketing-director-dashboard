# Findings — Marketing Director Dashboard

Append-only durable knowledge for resumption. Read newest entries first.

---

## 2026-04-25

### Hybrid architecture: dashboard wizard + Claude Code plugin

**Fact.** Customer-interview workflow has two parallel lanes that both create the same campaign in the same database. Sarah-style users (non-technical) run preset-segment campaigns through the dashboard wizard at `/workflows/customer-interviews/new`. Power users (Brady, senior analysts) run custom-criteria campaigns from the customer-interview plugin in Claude Code. Customer-facing interview UI, email delivery, and brief storage are dashboard-only. Forces/timeline/codes/cluster analysis is plugin-only.

**Notes.** Decision was forced by a subagent test acting as a non-technical analyst: CLI install requirements (`git clone`, env vars, gcloud creds) are walls for non-developers. Keeping the plugin as the only path made the workflow unusable for a Sarah persona. Wizard handles preset segments (`churned`, `active`, `first_timer`, `superconsumer`) plus AI-suggested criteria + AI-drafted JTBD guide. Plugin path needed for "airport route AND used promo X" type queries that don't fit presets. Both lanes POST the same `/api/interviews/campaigns` shape — bearer-gated route for the plugin, internal `/api/interviews/wizard/create` (no auth, same-origin) for the wizard. Analysis remains in the plugin because subagent context isolation, 3-run stability, and the no-LLM-themes rule benefit from CLI discipline. If the workflow takes off, moving analysis into the dashboard is a known follow-up — not done.

### Pending: bundle `sle-bigquery` skill into plugin repo

**Fact.** The plugin's planning skill currently calls dashboard `/explore` for segment preview only. To unlock the power-user lane (custom BQ queries), pieces of Brady's user-level `/bigquery` skill (`~/.claude/skills/bigquery/`) need to be extracted into the plugin at `.claude/skills/sle-bigquery/` so cloned plugins are self-contained.

**Notes.** Bundle scope: schema for `tds_sales.sales_orders`, company filtering rule (`selling_company = 'Salt Lake Express'`), void/cancel handling, key stop IDs. Skip report-number conventions (3009/9001/9008) — irrelevant for interview-segment queries. Also need a `bq-credentials` setup step in the plugin README: either `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service account JSON, or `gcloud auth application-default login`. Once bundled, the plugin's `plan-customer-interviews` SKILL.md must be updated to support both lanes — preset criteria → call dashboard `/explore`; custom criteria → use bundled BQ skill to write the query, validate the count, then POST to `/api/interviews/campaigns` with bearer. The campaign POST contract does not change.

### What's built and verified

**Fact.** Dashboard: Drizzle migration `0004_faithful_sauron.sql` is applied to Neon — `interview_campaigns`, `interview_responses`, `interview_artifacts`. Pages live at `/workflows/customer-interviews` (list + 3-stage explainer), `/workflows/customer-interviews/new` (4-step wizard), `/workflows/customer-interviews/[id]` (detail with `NotifyAnalystButton`), `/interview/[token]` (customer-facing chat). API routes: `/api/interviews/explore` (bearer), `campaigns` GET+POST (bearer), `campaigns/[id]` (bearer), `campaigns/[id]/artifacts` (bearer), `campaigns/[id]/notify-analyst`, `wizard/preview`, `wizard/create`, `draft-criteria`, `draft-guide`, and customer-facing `interview/[token]/message`. Plugin at `~/workspace/sle/products/customer-interview-plugin/` has two skills (`plan-customer-interviews`, `analyze-customer-interviews`), three subagents (`segment-explorer`, `question-drafter`, `transcript-analyzer`), and a `failure-modes.md` context file. Build green. Lint clean on new files. HubSpot SMTP smoke-tested with `250 2.0.0 Ok queued`.

**Notes.** AI interviewer = Claude Sonnet 4.6 server-side, system prompt embeds the approved guide + JTBD guardrails, completes when it emits `<<INTERVIEW_COMPLETE>>` sentinel. Sentinel triggers state increment + thank-you email + reservations@ loyalty-point email. The transcript-analyzer subagent embeds the three guardrailed prompts verbatim from `~/workspace/references/knowledge-base/output/lessons/lesson-interview-transcript-analysis.html` Section 6. Prompt 3 (code candidates) explicitly forbids theme clustering — human-cluster step is mandatory.

### State machine

**Fact.** Campaign states: `draft → sending → collecting → ready → analyzed → archived`. Auto-transition `collecting → ready` happens in `/api/interview/[token]/message` after sentinel detection when `responsesCompleted >= responseThreshold`. Manual transition `ready → analyzed` happens in `/api/interviews/campaigns/[id]/artifacts` POST.

**Notes.** Failure case `failed_fetch` set when BigQuery returns zero customers or errors during `fetchSegmentMembers`. No path back from failure — campaign is dead, create a new one. No archive automation yet — manual.

### Email types and config

**Fact.** Four template types via HubSpot SMTP (`smtp.hubapi.com:587`, STARTTLS, PLAIN auth): `interview-invite` (per customer at send), `interview-thanks` (on completion), `csr-loyalty-points` (to `reservations@saltlakeexpress.com`), `analyst-handoff` (triggered by NotifyAnalystButton). All in `src/lib/email/templates/`.

**Notes.** From address default is `Brady Price <brady.price@saltlakeexpress.com>`, override via `SMTP_FROM_INTERVIEWS`. CSR target override via `RESERVATIONS_EMAIL`. Analyst target default `brady.price@saltlakeexpress.com`, override via `ANALYST_EMAIL`. SMTP credentials in `.env.local` as `HUBSPOT_SMTP_USER` + `HUBSPOT_SMTP_PASSWORD` and logged in `~/.claude/credentials-registry.md` under HubSpot section. Resend was the original choice but replaced because the Transactional Email add-on is already paid for; switching to HubSpot SMTP also enables CRM auto-association and tracking.

### Pending: `MD_DASHBOARD_API_KEY` not generated

**Fact.** Bearer token used for plugin↔dashboard auth. The plugin sends it as `Authorization: Bearer ...` to the bearer-gated routes (`/api/interviews/explore`, `/api/interviews/campaigns` GET+POST, `/api/interviews/campaigns/[id]`, `/api/interviews/campaigns/[id]/artifacts`). Not yet generated, not yet set.

**Notes.** When ready: `openssl rand -hex 32`, paste into dashboard `.env.local` as `MD_DASHBOARD_API_KEY`, share with plugin users via secure channel. The wizard path is unaffected (uses unauthenticated same-origin `/api/interviews/wizard/*`). Only matters when someone wants to run the plugin.

### Domain verification status

**Fact.** `saltlakeexpress.com` is verified inside HubSpot (marketing emails send from this domain today). HubSpot SMTP send works without additional DNS work.

**Notes.** Resend domain verification work earlier in the session is now obsolete — DNS records I researched (MX, SPF, DKIM on `send.saltlakeexpress.com`) are not needed. Skip.
