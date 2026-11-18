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

`/stats` displays the activity calendar; unimplemented nested statistics routes remain placeholders.
`/workouts` displays the list and `/workouts/:id` the detail page. Frontend route guards
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

`src/lib/api.ts` provides small authenticated GET/POST helpers. They send the current
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

Cards link to the protected workout detail view described below.
No sample production data is included. The new-workout form is described below.

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

## New workout form (Issue #25)

Use "+ Lisa treening" on `/workouts` to open protected `/workouts/new`. The mobile
form requires a name, valid date, and at least one exercise set. It uses the same
auth/session checks, API base URL, bearer token, and dark Neon Lime styling as
the workouts list. No new dependencies are required.

### Inspected backend contract

`server/src/controllers/workouts.controller.js` requires a non-empty `sets` array;
a name/date-only request would fail. The frontend therefore sends:

```text
POST /workouts
{ name, date, sets: [{ exercise_id, exercise_name, weight, reps }, ...] }
```

Exercise choices come from authenticated `GET /exercises`, accepting only global
(`user_id: null`) or current-user records. The selected ID and its returned name
are used together. No fabricated exercise IDs, demo data, or database changes are
used. If no exercises exist, the form explains the prerequisite and disables save.
This does not implement the exercise management page.

The name is trimmed; date is a valid ISO calendar date. Every set requires a
selected exercise, non-negative finite weight in kg (including zero), and positive
integer repetitions. "Lisa seeria" adds another set, which may use another
exercise. Required-field messages are in Estonian and focus moves to the first
invalid field.

### Submission and verification

The existing API helper now supports JSON POST without automatic retries. During
save, fields and in-app navigation are disabled. A synchronous guard prevents
concurrent requests, and a successful form cannot submit a second time. After a
confirmed response belonging to the current user, navigation replaces the form
with `/workouts?created=<id>`. The remounted list makes a fresh GET and displays
"Treening salvestatud" when that record is present. No workout is inserted into
the list optimistically.

API configuration, validation responses, expired sessions, and network errors
produce safe feedback while retaining entered data. Expired sessions offer a
return to login. A network failure can leave the write outcome unknown, so its
message asks the user to check the list before retrying. This frontend prevents
duplicate in-flight submissions, but cannot provide server-side idempotency.

Run all checks without credentials/backend access:

```sh
npx tsc --noEmit
npm run build
node --test tests/login.test.mjs tests/register.test.mjs tests/routes.test.mjs tests/workouts.test.mjs tests/new-workout.test.mjs
```

New mocked tests cover required fields and calendar validation, numeric sets,
request shape and bearer headers, successful POST followed by fresh GET,
duplicate-submit prevention, explicit retry after failure, missing configuration,
expired sessions, exercise ownership, and form markup. Live verification still
requires the team's Supabase credentials, test user, running backend/database,
and at least one visible exercise. Details, editing, and deletion are covered separately below.

## Workout details, edit, and delete (Issue #26)

"Vaata treeningut" opens protected `/workouts/:id`. The Estonian detail page shows
the workout name/date and ordered exercise sets with weight in kg and repetitions.
It includes loading, empty sets, not-found, invalid ID, safe network/API error,
and expired-session feedback, plus a return to the list. Missing API configuration
uses the existing setup message. No real data or authentication is simulated.

The existing backend routes/controllers were inspected before implementation:

- `GET /workouts/:id`: returns the owned workout with a `sets` array, or 404.
- `PUT /workouts/:id`: accepts name/date and optional replacement sets, using
  `exercise_id`, `exercise_name`, `weight`, and `reps`; returns the updated detail.
- `DELETE /workouts/:id`: deletes associated sets and the workout, returning 204
  with no JSON body. The authenticated API helper now supports PUT/DELETE and 204.

The editor changes the name, date, and each existing set's weight/repetitions.
Exercise identities and order are preserved. Required-field/date/numeric checks
reuse the new-workout validation. It also handles workouts with no sets, as PUT
permits an empty array. Exercise replacement or adding/removing sets is not part
of this editor.

Delete uses an explicit Estonian browser confirmation before sending a request.
Save/delete share a synchronous lock, controls are disabled while pending, and
neither operation retries automatically. After save, the confirmed returned
detail is rendered; after deletion, the list is remounted and fetched again.
The list shows deletion feedback once its reload succeeds.

Returned workout ownership, requested ID, each set's workout ID, and field types
are checked before displaying data. Malformed/cross-user responses are rejected
as a whole. IDs are treated as opaque alphanumeric/hyphen/underscore identifiers
with a bounded length; path/query injection is rejected before fetching. These
frontend checks supplement, rather than replace, backend authorization and RLS.
Read requests are cancelled/ignored on navigation, account, or token changes;
write results are not applied after unmount or token changes.

The backend's replacement-set update is not transactional: failures can occur
after some changes have been applied. After a failed/uncertain write the UI offers
reloading the actual detail before another attempt, instead of showing an optimistic
success or automatically resubmitting. Backend transaction changes are outside
this frontend issue.

Run the full suite:

```sh
npx tsc --noEmit
npm run build
node --test tests/login.test.mjs tests/register.test.mjs tests/routes.test.mjs tests/workouts.test.mjs tests/new-workout.test.mjs tests/workout-detail.test.mjs
```

Mocked detail tests cover GET/PUT/DELETE payloads and bearer authentication,
ownership/malformed response rejection, set sorting, validation, not-found and
expired sessions, missing configuration, delete cancellation, shared submission
locking, stale request cancellation, and localized/accessibly labeled markup.
Live read/edit/delete still need the team's credentials, running backend/database,
and a team-approved test workout. No backend, database, or Supabase settings are
changed, and no features from Issues #27–#29 are included.

## Exercises page (Issue #27)

Protected `/exercises` lists global/shared exercises and the signed-in user's
personal exercises using authenticated `GET /exercises`. Cards have explicit
"Ühine harjutus" / "Minu harjutus" labels, distinct badges, and a category or
"Määramata". Empty lists, loading, failed requests, and expired sessions have
separate Estonian feedback and appropriate retry/login actions.

The committed backend controller/routes and backend schema documentation were
inspected read-only. Documented fields are `id`, `name`, `category`, and `user_id`;
shared rows use `user_id: null`. No SQL schema/migrations are committed in this
repository. The existing controller accepts required `name` and optional `category`:

```text
POST /exercises
{ name, category? }
```

The form trims the required name and optional free-text category, omitting category
when empty. It never sends `user_id`; the backend assigns the authenticated user's
ID. No new category enumeration or database constraint is invented by the frontend.
A confirmed personal exercise response clears the form, shows success feedback,
and triggers a fresh GET. If that reload fails, the saved feedback remains visible
alongside the list's retry message. No record is inserted optimistically.

`src/lib/exercises.ts` contains typed parsing, loading, validation, creation, and
request cancellation. The workout form's exercise dropdown reuses its visibility
checks. Responses containing other users' private exercises, absent ownership,
duplicate IDs, or malformed fields are rejected rather than displayed. Frontend
checks do not replace backend authorization or RLS.

Creation has a synchronous in-flight guard; fields and navigation are disabled
while saving. Errors retain the entered values, and writes are never automatically
retried. Network errors explain that the outcome can be uncertain and ask the user
to check the list first. Missing API configuration uses the existing setup message.
Requests are aborted/ignored on unmount or session changes, and cached state is
scoped to the current account/token. Tokens and raw backend errors are not displayed.

Run all checks using existing dependencies only:

```sh
npx tsc --noEmit
npm run build
node --test tests/login.test.mjs tests/register.test.mjs tests/routes.test.mjs tests/workouts.test.mjs tests/new-workout.test.mjs tests/workout-detail.test.mjs tests/exercises.test.mjs
```

Mocked tests cover shared/personal visibility, ownership rejection, required name,
optional category, bearer GET/POST payloads, refresh after creation, duplicate
submission prevention, safe creation errors, expired sessions, cancellation, and
accessible form markup. Live verification still requires the team's Supabase URL
and public key, authenticated test user, API URL, running backend/database, and
confirmation of any database category constraints not committed here. Backend,
database, RLS, and Supabase settings are unchanged. No statistics UI is implemented.

## Workout activity calendar (Issue #28)

Protected `/stats` displays an Estonian Monday-first monthly calendar following the
existing calendar wireframe's structure and dark Neon Lime direction. Previous/next
month buttons cross year boundaries, and "Käesolevasse kuusse" returns to the local
current month. The current month is labeled; today's date is underlined and has
`aria-current="date"`. Today uses the browser's local calendar date and refreshes
once a minute while the page is mounted. Date-only calculations/formatting use UTC
to avoid shifting workout dates across timezone or daylight-saving boundaries.

The committed `stats.routes.js` and `getCalendarStats` controller were inspected
read-only. The actual contract is:

```text
GET /stats/calendar?month=YYYY-MM
{ "YYYY-MM-01": false, "YYYY-MM-02": true, ... }
```

Every day of the requested month is present with a boolean indicating whether
at least one workout exists. The frontend rejects missing dates, extra/wrong-month
dates, and non-boolean values. It does not invent workout IDs, counts, user IDs,
or advanced-statistics fields. Unlike the broader wireframe, this issue displays
only selected-day activity feedback; the API does not provide per-day workout lists.

Activity is shown by a visible dot as well as a full accessible label; selection
has a border and `aria-pressed`. Weekday headers have full Estonian names, month
changes are announced, and controls have visible focus and keyboard support.
At 320px, the calendar uses seven equal columns and 44px-high day controls, with
small side padding to preserve approximately 44px-wide touch targets.

Loading and errors do not display old markers or imply an empty history. Empty
months still render a usable calendar. Failures offer retry, expired sessions
offer login, and missing API configuration uses the existing setup message.
Supported month navigation is bounded to years 1000–9999.

Requests use the existing authenticated GET helper and current Supabase bearer
token. Results are scoped to user, token, and requested month. Requests are aborted
and late results ignored after account/month changes or unmount. This aggregate
response contains no ownership field: user isolation relies on the backend's
existing `user_id = req.user.id` filter and token validation, not fabricated
client-side ownership metadata. No data is shared through an application cache.

Checks using existing dependencies and mocked responses:

```sh
npx tsc --noEmit
npm run build
node --test tests/login.test.mjs tests/register.test.mjs tests/routes.test.mjs tests/workouts.test.mjs tests/new-workout.test.mjs tests/workout-detail.test.mjs tests/exercises.test.mjs tests/calendar.test.mjs
```

Calendar tests cover query/header correctness, response validation, empty/error/
expired-session states, cancellation, local today, month/year transitions, leap
years and century rules, week alignment, and accessible activity/today markers.
Live verification still requires the team's Supabase credentials, API URL,
authenticated test account, and configured backend/database. No dependencies or
backend/database/Supabase settings are changed. Issue #29 is not implemented.
