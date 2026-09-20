# Accounts and storage

## Family account model

Each learner uses their own Netlify Identity account. Mark, Ann and Marky must not share a password or select a display name to impersonate an account. The verified Identity user ID owns saved records; a name is only a display label. No new family accounts or invitations were created during this work.

The app uses `@netlify/identity`, including `handleAuthCallback()` on startup. OAuth, email confirmation and email-change callbacks restore a session. Invitation callbacks hold the invitation token until the learner chooses and confirms a password. Recovery callbacks show a new-password form before the learner returns to practice. The sign-in form can request a recovery email. Google appears only when the project’s actual Identity settings enable it. These behaviours follow Netlify’s [Identity setup](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/) and [account recovery](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/manage-existing-users/) guidance, and the installed package API.

Auth state changes load that learner’s preferences synchronously, before showing their authenticated application. Pending server verification cannot restore a user after logout. The app still permits existing local practice when server verification is temporarily unavailable; protected cloud functions verify the authenticated user independently.

## Verified live settings

A read-only request to `https://italianlingo.netlify.app/.netlify/identity/settings` on **20 September 2026** returned:

| Setting | Observed value |
| --- | --- |
| Email/password | Enabled |
| Google and other external providers | Disabled |
| Disable signup | `false`: registration is open |
| Automatic email confirmation | Disabled |

The previous UI claimed the site was invitation-only and always displayed Google. Those claims did not match the live configuration. The new account screens report the real settings. Hiding a signup form does not close registration at the Identity service.

For a small private family app, **invite-only registration is the recommended operational setting**. It should be changed by the site owner in Netlify Identity registration settings, then each person invited using their own email. Existing email/password access is sufficient; Google is optional. Enabling Google requires configuring that provider, testing its HTTPS return flow and checking the allowed redirect origins for the production site and preview. Netlify documents that invite-only rules also apply to external-provider users. [Registration and login](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/registration-login/).

No live Identity settings, providers or accounts were changed. A real Google login cannot be claimed as tested while Google is disabled. Invitation delivery, recovery email delivery and the final OAuth provider round-trip require account-holder checks on a deployed site; unit tests cover the application’s callback handling without sending emails.

## Preferences and existing browser data

Preferences use `olingo.settings.v2:<encoded-user-id>` in local storage. Signing out resets the in-memory preferences; another learner starts with their own saved values or defaults. Corrupt values are normalised safely. Late cloud settings responses are ignored if their account is no longer active.

The previous unscoped `olingo.settings` value has no reliable owner. It is retained but **not automatically assigned to the next person signing in**. Each learner should check their level and preferences once after this upgrade. This avoids silently giving Ann or Marky Mark’s previous settings. General device preferences are currently per-account local values; do not describe them all as cross-device cloud-synchronised. The conversation profile can separately persist selected learning preferences through the conversation history service.

IndexedDB data is a convenience cache, not an isolation boundary against somebody who controls the browser. Signing out prevents the app displaying another learner’s account, but does not remove all offline records from that device. Separate browser profiles are appropriate if household members do not want to share a browser’s stored data.

## Durable conversation history

The conversation history endpoint authenticates the request and derives the owner from the verified server user. The client’s `X-Olingo-User` value checks for account switching; it never grants access to a chosen owner. Local IndexedDB supports offline work and pending sync. Cloud history uses Netlify Blobs with per-user records, including attempts and conversation documents. Export gives the learner a portable copy. A sync failure must remain visible and must not erase the local attempt or count it again as new practice.

For a few family members, **Blobs is a reasonable storage choice**, avoiding an unnecessary database migration while retaining per-user histories. Site-wide stores persist across deployments, so previews require deliberate separation from production records. Blobs does not supply relational querying or automatic multi-record transactions; its documented default for competing writes to one key is last-write-wins. The implementation therefore needs stable attempt IDs, scoped keys and explicit conflict handling. [Netlify Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

Consider a relational database when the application needs rich teacher dashboards, cross-learner reporting, relational enrolments, shared lessons with transactional updates, or substantially more simultaneous users. Adding a database would not itself fix account isolation: every endpoint would still need authenticated ownership checks. Keep the existing legacy Supabase scaffold separate from claims about the implemented conversation-history sync.

## Files and verification

- `src/store/useAuth.ts`: Identity flows, provider settings, session verification.
- `src/ui/AuthGate.tsx`: sign-in, invite acceptance and recovery forms.
- `src/store/useSettings.ts`: per-user settings and guarded cloud application.
- `src/pages/Settings.tsx`: real account-access configuration.
- `netlify/functions/conversation-history.ts`: protected history interface.
- `src/learning/conversation-sync.ts`: local persistence, sync and export.

Targeted tests exercise recovery failure/success, invite acceptance, disabled/enabled Google, late verification after logout, three-learner settings separation, corrupt settings and stale cloud responses. They do not substitute for live account-holder authentication checks.
