# Separate Neon Database for Marketing Director Dashboard

**Date:** 2026-04-08
**Status:** Approved

## Problem

The marketing director dashboard and SLE chatbot share a single Neon database (`ep-dark-mouse-akcajmv3/neondb`). Both use Drizzle ORM with `drizzle-kit push`, which detects tables not in its schema as unmanaged and offers to drop them. A push from the chatbot project previously wiped all marketing dashboard tables and data. This is the root cause of the "workflow execution failed" INSERT error, and the reason previously completed workflow runs disappeared.

## Solution

Create a new, separate Neon project for the marketing director dashboard. Swap the connection string. No code changes required.

## Steps

1. **Create new Neon project** via `neonctl projects create --name marketing-director-db --region-id aws-us-west-2`
2. **Get connection string** from the new project
3. **Update local env** - replace `POSTGRES_URL` in `.env.local`
4. **Push Drizzle schema** - `npx drizzle-kit push` to create all 5 tables (`workflow_runs`, `workflow_step_runs`, `action_items`, `period_metrics`, `workflow_step_prompts`)
5. **Clean up chatbot database** - drop the 5 marketing tables accidentally created in the chatbot's database during this debugging session
6. **Update Vercel env vars** - set the new `POSTGRES_URL` in the Vercel project settings
7. **Update credentials registry** - document the new database in `~/.claude/credentials-registry.md`

## What stays the same

- All application code (reads `POSTGRES_URL` from env, no changes needed)
- Chatbot database and its tables (`conversations`, `messages`, `conversation_events`)
- Drizzle schema, migrations, config

## Data migration

None. Previous data was lost when chatbot's `drizzle-kit push` dropped the marketing tables. Tables recreated during this session contain no real data.

## Post-migration state

| Project | Neon Project | Database | Tables |
|---------|-------------|----------|--------|
| SLE Chatbot | billowing-leaf-16443692 (marketing-director-dashboard) | neondb | conversations, messages, conversation_events |
| Marketing Dashboard | (new project) | neondb | workflow_runs, workflow_step_runs, action_items, period_metrics, workflow_step_prompts |

Note: The original Neon project is confusingly named `marketing-director-dashboard` but actually hosts the chatbot. Renaming it is optional but recommended to avoid future confusion.
