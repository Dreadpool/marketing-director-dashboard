# Project Scaffolding — Shaping Notes

## Scope

Project scaffolding only. No workflows, data integrations, or real API calls. Building the shell that everything will live inside.

## Decisions

- Dark OLED Luxury aesthetic (from frontend design guide)
- Font pairing: Space Grotesk (headings) + IBM Plex Sans (body)
- Layout: 3-column CSS Grid — icon sidebar (48px) + collapsible chat panel (320px) + main content (fluid)
- shadcn/ui with New York style (sharper, denser, Linear-like)
- Chat panel on left side (user preference from screenshot reference)
- Workflow nav via top breadcrumbs, not sidebar tabs
- Mock chat responses only — no real Claude API calls in this spec
- No Kafka, Spark, or ontology layer — simple server-side API calls (decided during product planning)

## Context

- **Visuals:** No mockups. User provided a screenshot of a similar app (busalytics-dashboard) showing icon sidebar + left chat + card content layout. Research identified Linear, ThoughtSpot, Databox, Monday.com, and SaaSUI library as top 5 UI inspiration sources.
- **References:** No existing dashboard code. User has Python analysis scripts in other SLE projects but no UI/visualization work to reference. Fresh build.
- **Product alignment:** Directly implements the "Core Dashboard" and "Workflow Engine" items from roadmap Phase 1 MVP. Tech stack matches product/tech-stack.md exactly.
- **Standards:** None exist yet (standards/index.yml is empty). Standards will be discovered and documented as the codebase grows.

## UI Research Summary

### Top 5 Inspiration Sources

1. **Linear** — Exemplar for clean dashboard design. Precise typography, spacing, icon sidebar pattern. Less-is-more aesthetic.
2. **ThoughtSpot** — Natural language AI search for data. Proves conversational analytics works. Self-service paradigm.
3. **Databox** — 200+ proven dashboard layouts. Multi-source data viz patterns. Auto-applies layout best practices.
4. **Monday.com** — Workflow + dashboard hybrid. Task orchestration alongside analytics. 30+ widget patterns.
5. **SaaSUI Library** (saasui.design) — 148+ real shipped interfaces. Browse by pattern type. Real production examples from Linear, Notion, Intercom.

### Key Design Patterns Adopted

- Right-side context panel pattern adapted to left-side chat (user preference)
- Maximum 5-6 primary visualizations per view
- Copilot as support tool, not main interface
- Zero-interface philosophy: anticipate what director needs based on context
