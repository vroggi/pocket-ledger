# Enable email/password sign-in

The implementation is ready but inactive until an authentication project is connected.
Current mode deliberately remains `platform` so existing users keep access.
The finance database stays in D1; Supabase is used only for authentication.

## 1. Create or select a Supabase project

Use a project you control. Enable the Email provider and keep email confirmation
on. Set a minimum password length of at least 8 characters in Supabase as well.
Copy the Project URL and **publishable key** (the legacy `anon` key also works).
The application does not need a `service_role` key or a database password.
Only hosted HTTPS project URLs ending in `.supabase.co` are accepted.

## 2. Configure email delivery and links

Set the Auth **Site URL** to the current published app origin, with no trailing
slash. For example: `https://pocket-ledger-poul.gamej9393.chatgpt.site`.
Use the actual current origin if hosting changes it.

In Auth email templates, use these confirmation links:

**Confirm signup**

```html
<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a>
```

**Reset password**

```html
<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

Configure a custom SMTP provider before inviting arbitrary users. The default
Supabase mail service is for trials, restricts recipients and has a low sending
limit. This project does not provision SMTP credentials or a sending domain.
Test delivery with the final origin and disable email-link tracking if it rewrites
the token links. Do not disable email confirmation to work around delivery issues.

References:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp

## 3. Activate hosted runtime configuration

Set all three values in the Sites runtime environment, then deploy the saved
version again so the new environment revision applies:

```text
AUTH_MODE=password
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Keep values in the hosting environment, never in Git or the hosting manifest.
The publishable key is not an administrative key. No private financial data or
passwords should be sent in GitHub issues.

`/auth` provides sign-in, signup, forgot-password and reset screens. It shows a
setup message and disables credential submission until the mode and both values
are present. In password mode the financial API ignores ChatGPT identity; a
valid application session is required. The Site audience remains public so the
installation page and password forms are reachable without ChatGPT login.

## 4. Connect the existing ledger once

Before changing providers, export a full JSON backup from Settings.

If your browser is still signed into its existing ChatGPT ledger, `/auth` offers
**Connect the ledger I’m currently signed into**. Create/confirm your email account,
then sign in with that checkbox selected. The server independently verifies the
Supabase identity and the current platform identity; it preserves the original
ledger owner ID so records and scoped offline queues remain attached to that
ledger. Matching email addresses alone never cause a connection.

A ledger can be linked to only one password account. An already-linked password
account cannot silently switch to another ledger. If no prior platform session is
available, sign in to a new password account and restore your exported JSON backup
through Settings. Review the restore preview before replacing its empty ledger.
Retain the backup until the new account and a second device have been checked.

## 5. Verify on the final hosted URL

- Create two confirmed accounts; each must start empty and see only its records.
- Add a test transaction on one device and open that account on another device.
- Sign out; the current application session must stop working.
- Request a reset email, set a new password and sign in again. The app revokes
  its stored sessions for that password account after a successful reset.
- Check the one-time existing-ledger connection before retiring the old access.
- Install the PWA and test first-online setup, offline queue and reconnection.

These steps require a real project and mailbox. Local tests use simulated provider
responses and do not prove real email delivery, provider configuration or real
cross-device sign-in.

## Session and operational notes

The server verifies credentials through Supabase and verifies its returned access
token with `/auth/v1/user`. It then issues a random 256-bit opaque app session in a
Secure, HttpOnly, SameSite=Lax, host-only cookie. D1 stores only its SHA-256 hash,
provider ID and a fixed seven-day expiry. No Supabase access or refresh token is
stored in the financial ledger or localStorage. Password recovery temporarily
uses a ten-minute HttpOnly cookie. The app enforces same-origin credential writes
and persistent per-gateway-client attempt limits; Supabase's own limits still apply.

The app's session is independent of Supabase's sessions. A provider-side password
change outside this app does not immediately revoke these app sessions; they
expire after seven days. Use this app's reset flow for immediate app-session
revocation. Account deletion/administrative revocation is an operator operation;
self-service account deletion and MFA are not implemented in this version.
