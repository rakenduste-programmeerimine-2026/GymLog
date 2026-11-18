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

Login and registration navigation uses the browser History API without a router
dependency. The login page's "Loo konto" button opens `/register`.

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
directions using the auth routes described below.
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

## Protected routes (Issue #23)

The small navigation adapter in `src/lib/navigation.ts` uses `pushState`,
`replaceState`, and `popstate`, with no additional dependencies. `/login` and
`/register` are public. The root keeps the existing login/home entry behavior.
Browser back/forward and direct URL navigation use the same route decisions.

`/workouts`, `/exercises`, `/stats`, and their nested paths require a user and
session from `AuthContext`. During initial session loading, show an Estonian
loading message without rendering a protected page or redirecting. Once loading
finishes, logged-out visitors are redirected with history replacement to
`/login?next=...`. A successful sign-in returns to that protected destination,
including its query parameters. Public auth navigation preserves `next` in both
directions. Without a destination, login returns to `/workouts`.

Only known same-origin protected paths are accepted as return destinations;
external URLs, auth routes, and URL fragments are discarded. Missing Supabase
configuration never grants access; public auth forms retain their setup message.
Registration remains visible after automatic sign-in until the user continues,
preserving Issue #22's confirmation/success feedback.

The exercises, statistics, and nested workout-detail routes remain clearly labeled
placeholders. `/workouts` now displays the list described below. Frontend route guards
are a UX measure: backend authorization and database policies remain responsible
for protecting actual data.

Run all frontend tests and checks:

```sh
node --test tests/login.test.mjs tests/register.test.mjs tests/routes.test.mjs
npx tsc --noEmit
npm run build
```

Route tests cover logged-out redirects, retained destinations, authenticated access,
initial loading, public forms, missing configuration, safe return URLs, and history
push/replace behavior. Real session restoration and login redirects still require
the team's Supabase credentials and a test account. Production hosting must serve
`index.html` for frontend paths such as `/workouts` on refresh/direct visits; Vite
provides SPA fallback during local development. This change does not configure hosting.

## Workouts list (Issue #24)

Set the backend API base URL in ignored `client/.env.local` and restart Vite:

```dotenv
VITE_API_URL=http://localhost:3001
```

Use your actual backend address outside local development. This is separate from
`VITE_SUPABASE_URL`. Missing/invalid API configuration produces a useful error;
no demo workouts or anonymous request is substituted.

`src/lib/api.ts` provides a small authenticated GET helper. It sends the current
Supabase access token only in the `Authorization: Bearer` header, does not cache
responses, and does not follow redirects. This is not a complete API client for
Issue #20. Tokens are never placed in URLs, logs, or persistent application state.

`src/lib/workouts.ts` reads the existing backend's `GET /workouts` array response:
each row must contain `id`, `user_id`, and an ISO date (`YYYY-MM-DD`), with optional
nullable `name`. Additional fields, including sets, are not retained by the list.
The entire response is rejected if ownership does not match the current user,
fields are malformed, or IDs are duplicated. The backend must still enforce user
authorization and database access policies; frontend checks do not replace them.

The list is newest first with localized Estonian dates. An absent or empty name
is displayed as "Treening". Loading, empty history, network/API errors, and expired
sessions have distinct feedback. Errors offer retry, and expired sessions offer
sign-out followed by login with `/workouts` as the return destination. Requests
are aborted/ignored on unmount, account changes, and token changes; previous-account
results are never shown while the next user's request is loading.

No detail view is implemented. Cards explicitly state that details are not yet
available instead of linking to a placeholder as though it were functional.
No new-workout form or sample production data is included.

Run the full frontend checks without backend access or credentials:

```sh
npx tsc --noEmit
npm run build
node --test tests/login.test.mjs tests/register.test.mjs tests/routes.test.mjs tests/workouts.test.mjs
```

Mocked tests cover the token header, empty/success responses, date sorting,
ownership rejection, malformed payloads, HTTP/network failures, cancellation,
and rendered feedback. Live verification still needs the team's Supabase URL and
public key, a test account, and a running authorized backend with its database
configured. No backend or database setup is changed by this issue.
