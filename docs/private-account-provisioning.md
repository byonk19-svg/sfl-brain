# Private account provisioning

SFL Brain uses Supabase email-and-password accounts. Public signup remains disabled. An owner provisions each approved account through the Supabase Auth admin path with a password and confirmed email for that specific account, then creates its workspace membership.

There is no self-service email recovery until an email delivery service is deliberately configured. Password recovery is an owner-assisted administrative reset and must not expose credentials in the application, repository, or chat.
