# GymLog frontend

Minimal React + Vite + TypeScript frontend for Issue #18. Styling uses plain CSS.

Use Node.js 24 LTS and npm. From `client/`:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The placeholder page runs without the backend or Supabase.

```sh
npm run build
npm run preview
```

The build checks TypeScript and generates `dist/`. Preview serves that production build locally.

## Structure

- `src/main.tsx`: React entry point and global CSS.
- `src/App.tsx`: root application component.
- `src/pages/`: page components.
- `src/components/`: reusable interface components.
- `src/styles.css`: plain CSS styles.

## Supabase authentication (Issue #19)

Copy `.env.example` to `.env.local` inside `client/`. Obtain the Supabase project
URL and its public publishable key from the teammate responsible for Supabase:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Fill in both values and restart Vite. `.env.local` is already ignored by Git.
Everything prefixed with `VITE_` is public browser configuration: never put a
service_role key, `sb_secret` key, database password, or personal token there.
The backend's environment variables are separate and are not loaded by Vite.

Without these values, no Supabase client is created. The home page still renders
and shows an Estonian configuration message. Invalid URLs or client initialization
failures also produce a safe message without displaying configuration values.

`src/lib/supabase.ts` exports the typed client (nullable when unconfigured).
`src/context/AuthContext.tsx` provides `AuthProvider`, `AuthContext`, and `useAuth()`:

- `user` and `session` reflect the initial session and subsequent auth events.
- `loading` covers initial session loading and is false when unconfigured.
- `configurationError` describes setup problems; `error` describes session or
  sign-out failures.
- `signOut()` calls Supabase and rejects with a safe message on failure. Callers
  should catch that rejection and display feedback. User/session updates follow
  the auth subscription.

The provider unsubscribes on unmount and ignores late session reads. Session data
is for frontend UI state; backend authorization must still validate access tokens.
Login and registration screens use this provider in their separate frontend issues.

### Connection verification once credentials are available

1. Confirm the team uses the same hosted project or obtain local Supabase startup
   instructions from its owner. This frontend does not provision Supabase.
2. Confirm email/password Auth settings and allowed local URLs with that owner.
3. Check that configuration feedback disappears and initial session loading ends.
4. Once a real login flow is available, verify sign-in updates user/session,
   reload restores the session, and sign-out clears it. Verify auth events after
   remounting under React Strict Mode do not create duplicate active subscriptions.

Real network authentication remains unverified until the URL, public key, and a
test account are available. Do not use invented credentials to simulate success.

## Login page (Issue #21)

Unauthenticated users see the Estonian login form. It validates required fields
and email format, then calls the existing client's `auth.signInWithPassword()`.
The submit button is disabled while checking the session, sending a request, or
when Supabase configuration is unavailable. Successful authentication updates
`AuthContext`, and the application shows the existing home page.

Invalid credentials use one shared message for unknown accounts and wrong
passwords. Network/service failures, unconfirmed email, and rate limiting have
safe messages; raw server errors and credentials are never displayed or logged.
Passwords are not trimmed and no registration password policy is imposed at login.

Login and registration navigation uses local application state rather than a
router dependency. The login page's "Loo konto" button opens registration.

Checks from `client/`:

```sh
npx tsc --noEmit
npm run build
node --test tests/login.test.mjs
```

Real sign-in, restored sessions, and network-failure browser behavior still need
verification with the team's Supabase URL, public key, and test account.

## Registration page (Issue #22)

The Estonian registration form reuses login styling and email/required-field
validation. It requires a password of at least eight characters and an exact
confirmation match; passwords are never trimmed. This is a frontend minimum,
not a change to the project's Supabase password policy. A stricter server policy
is handled through a safe error message.

The existing client calls `auth.signUp({ email, password })` with no profile data
or database writes. Inputs, navigation, and submission are disabled during the
request, with a pending indicator and duplicate-submission guard. Missing
configuration disables submission and shows setup guidance.

- With a returned session: show account-created feedback and a button to continue
  to the home page. `AuthContext` supplies the authenticated user.
- Without a session: explain email confirmation and provide a return to login.
  This message does not guarantee a new account or email was created, because
  Supabase can obscure duplicate-account responses. The frontend does not infer
  authentication from a returned user alone.

Registration stays visible until the user continues, even if an auth event arrives
before the request finishes. Login and registration buttons work in both
directions without new routes. Reloading starts at the normal app entry point.
Error messages cover network failures, weak passwords, rate limits, unavailable
services, and disabled sign-up without displaying raw server messages.

Run all auth tests with the existing Node/Vite setup:

```sh
node --test tests/login.test.mjs tests/register.test.mjs
npx tsc --noEmit
npm run build
```

Tests cover validation, request payloads, confirmation/session outcomes, submission
state transitions, safe errors, missing configuration, and accessible form markup.
Real account creation and email delivery still require the team's project URL,
public publishable key, configured email/password Auth, allowed redirect URLs, and
confirmation policy. These checks must be done against a team-approved test project;
no Supabase server settings are changed by this frontend.
