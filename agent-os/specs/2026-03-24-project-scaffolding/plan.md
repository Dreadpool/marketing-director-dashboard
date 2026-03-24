# Project Scaffolding + Application Shell Layout

## Context

First spec for the Marketing Director Dashboard. Creates the foundational Next.js project and application shell. No workflows or data integrations — this is the structural foundation.

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- shadcn/ui (New York style), Recharts, Lucide icons
- Vercel AI SDK + Claude (mock for now)
- Framer Motion for animations
- Deploy to Vercel

## Design Direction

- Aesthetic: Dark OLED Luxury (near-black bg, champagne gold accent, glassmorphism)
- Fonts: Space Grotesk (headings) + IBM Plex Sans (body)
- Inspiration: Linear (icon sidebar, spacing), ThoughtSpot (AI patterns), Databox (card layouts)

## Layout

CSS Grid: `48px | auto (320px collapsible) | 1fr`

- Far-left: 48px icon sidebar (Dashboard, Workflows, Settings)
- Left: Collapsible AI chat panel (320px)
- Center/right: Main content with top breadcrumb bar

## Routes

- `/` — Dashboard with 4 placeholder metric cards
- `/workflows` — Grid of 5 workflow cards with "Coming Soon" badges
- `/workflows/[slug]` — Individual workflow placeholder

## Tasks

1. Save spec documentation
2. Initialize Next.js 15 project
3. Install dependencies + configure (shadcn, eslint, prettier)
4. Configure theming (CSS vars, fonts, mesh bg, animations)
5. Build application shell layout (grid, sidebar, chat, topbar)
6. Create routing + placeholder pages
7. Wire up chat panel with mock responses
8. Polish + motion (transitions, hover effects, loading states)
9. Final verification (build, lint, visual check)
