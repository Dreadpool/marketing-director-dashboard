# Workflow Engine - Shaping Notes

## Scope

Multi-step workflow engine that turns days-to-weeks marketing analysis into minutes-to-hours by combining structured frameworks with AI execution.

## Three-Layer Architecture

**Software Layer**: Framework for step sequencing, data flow, state tracking, run history. Each step's output chains into the next step's context.

**Context Layer**: Codified analysis frameworks stored as editable prompts per step. Includes industry benchmarks, company thresholds, conditional exploration trees. Users can edit prompts to refine analysis quality over time.

**AI Layer**: Claude executes each step using the framework prompt + data. Not "summarize this" but "follow this decision tree to analyze this data."

## Decisions

- **Vercel Postgres + Drizzle ORM** over JSON file (user plans to deploy to Vercel)
- **Step-based execution** (fetch/analyze/recommend) over monolithic single-prompt
- **Per-step editable prompts** stored in DB, seeded from existing Monthly Analytics Review frameworks
- **Historical metrics storage** in `period_metrics` table for MoM/YoY comparisons
- **Action items link back to source analysis** so users can see the reasoning behind each item
- **Calendar view** for upcoming/due workflows based on cadence + last run
- **Don't touch dashboard page** - build workflows as their own thing first

## Context

- User runs monthly marketing analytics manually today using a 12-step Python pipeline
- Existing frameworks: CAC thresholds (excellent/good/high), payback ratio benchmarks, revenue decomposition
- Analysis currently takes days; goal is minutes
- Single user (marketing director) but deploying to Vercel for access anywhere
