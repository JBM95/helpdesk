---
work-item: GH-8
tier: T3
domains: [user-management, auth]
date: 2026-09-08
pass: 2
---

# Reconnaissance — GH-8: Allow admins to promote and demote users safely

Story: allow an authenticated admin to change an existing user's role between `agent` and `admin` from the existing Edit User flow, with the server as the authority.

**This is a retry pass.** The first recon (earlier today) returned `needsExplore: ["core","server","e2e"]`. Those three sub-systems have been explored, `docs/repo-wiki/` substantially extended, and this pass refreshes the blast radius against the new intelligence.

## Staleness pre-check

`docs/repo-wiki/_state/exploration-state.json` read at 2026-09-08.

| Sub-system | Status | Staleness | Churn tier | Measured at |
|----------|--------|-----------|------------|--------------|
| core | partial | fresh | hot | 2026-09-08T17:07:43.656Z |
| client | partial | fresh | hot | 2026-09-08T17:07:43.656Z |
| server | partial | fresh | hot | 2026-09-08T17:07:43.656Z |
| e2e | partial | fresh | hot | 2026-09-08T17:07:43.656Z |

All affected sub-systems fresh. `needsExplore` is `[]`.