# Data-only reporting workflows

Decision: selecting a month opens saved data; explicit Load/Update data always retrieves from source. Remove the cache checkbox and all hosted AI API use. No local-Codex bridge in this change.

Preserve deterministic metrics, saved data, historical records, and creative duplicate/diversity checks. Remove generated reports, evaluation wizard, chat affordance, and AI interview drafting/conversations. Close new interview invitations and show a closed message for existing unfinished links.

Remove this app's xAI/Anthropic environment variables in Vercel and local checkout env files; do not revoke shared provider credentials globally.

Verify: fetch-only engine and refresh semantics, saved-period selection, timestamps, removed endpoints, build, tests, changed-file lint, browser loading and month switching, production environment names and deployment.
