# Private account provisioning

SFL Brain uses Supabase email-and-password accounts. Public signup remains disabled. An owner provisions each approved account through the Supabase Auth admin path with a password and confirmed email for that specific account, then creates its workspace membership.

There is no self-service email recovery until an email delivery service is deliberately configured. Password recovery is an owner-assisted administrative reset and must not expose credentials in the application, repository, or chat.

The production ChatGPT connector uses the same account through Supabase OAuth 2.1. Enable the OAuth server with authorization path `/oauth/consent` and dynamic client registration, but keep public signup disabled. A connector authorization succeeds only when the authenticated user also has exactly one `workspace_members` row.

To revoke ChatGPT access, revoke the user's OAuth grant in Supabase Auth. Removing the `workspace_members` row immediately denies subsequent connector reads and writes even if an OAuth token has not yet expired.
