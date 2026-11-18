# GymLog – Backend

REST API jõusaalitreeningute salvestamiseks ja jälgimiseks.

## Tech stack

- **Runtime**: Node.js
- **Framework**: Express
- **Andmebaas**: Supabase (PostgreSQL)
- **Autentimine**: Supabase Auth

## Projekti struktuur

```
server/
├── src/
│   ├── config/         # andmebaasi ühenduse seadistus
│   ├── models/         # User, Exercise, Workout, WorkoutSet
│   ├── routes/         # API marsruudid
│   ├── controllers/    # request/response loogika
│   ├── middleware/      # auth, errorHandler
│   ├── services/        # äriloogika (statistika, agregatsioon)
│   └── app.js           # Express app seadistus
├── migrations/          # SQL migratsioonid
├── tests/
└── server.js            # käivituspunkt
```

## Setup

1. Installi sõltuvused:

   ```bash
   npm install
   ```

2. Loo `.env` fail (`.env.example` põhjal). Konkreetsed väärtused saad andmebaasi/Supabase eest vastutavalt tiimikaaslaselt (vt [database README](../database-README.md)):

   ```
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   PORT=3001
   ```

   Backend kasutab neid selleks, et teha päringuid Supabase'i ja kontrollida sisenevate päringute autentimistokenit — projekti enda loomine, tabelite skeem ja Supabase Auth seadistus on dokumenteeritud eraldi.

3. Käivita server arendusrežiimis:
   ```bash
   npm run dev
   ```

Server jookseb vaikimisi aadressil `http://localhost:3001`.

## API endpointid

Autentimine (registreerimine, sisselogimine) käib otse frontendist Supabase Auth kaudu (`supabase.auth.signUp()` / `signInWithPassword()`), mitte selle backend API kaudu. Backend kontrollib iga kaitstud päringu juures `Authorization: Bearer <supabase_access_token>` headerit, saates tokeni Supabase'ile kontrollimiseks (`supabase.auth.getUser(token)`), mitte verifitseerides seda ise JWT secretiga (vt `middleware/auth.middleware.js`).

| Meetod | Tee               | Kirjeldus                                      |
| ------ | ----------------- | ---------------------------------------------- |
| GET    | `/workouts`       | Kasutaja treeningute nimekiri                  |
| POST   | `/workouts`       | Uue treeningu salvestamine                     |
| GET    | `/workouts/:id`   | Ühe treeningu detailid                         |
| PUT    | `/workouts/:id`   | Treeningu muutmine                             |
| DELETE | `/workouts/:id`   | Treeningu kustutamine                          |
| GET    | `/exercises`      | Harjutuste nimekiri (globaalsed + enda loodud) |
| POST   | `/exercises`      | Uue (personaalse) harjutuse lisamine           |
| GET    | `/stats/calendar` | Kalendrivaade – millistel päevadel treenitud   |
| GET    | `/stats/detail`   | Detailne statistika edasijõudnud kasutajale    |

## Andmemudel

Tabelite täpne skeem ja migratsioonid on dokumenteeritud [database README'is](../database-README.md). Backendi vaatenurgast on olulised need väljad, millega API päringuid teeb:

- `auth.users` – kasutajakontod (Supabase Auth)
- `exercises` – `id`, `name`, `category`, `user_id` (NULL = globaalne harjutus)
- `workouts` – `id`, `user_id`, `date`
- `workout_sets` – `id`, `workout_id`, `exercise_id`, `weight`, `reps`, `set_order`
