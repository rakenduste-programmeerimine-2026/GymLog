# Contributing to GymLog

Rules the whole team follows so our git history and workflow stay consistent.

## Commit messages (Angular convention)

Every commit message starts with a type prefix:

```
<type>: <short description>
```

**Types:**

| Type       | When to use                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `docs`     | Documentation only (README, comments)                   |
| `style`    | Formatting only, no code logic change                   |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or fixing tests                                  |
| `chore`    | Build process, dependencies, tooling                    |

**Examples:**

```
feat: add POST /workouts endpoint
fix: correct weight validation in workout form
docs: add backend README
test: add tests for exercises endpoints
chore: add nodemon as dev dependency
```

Keep the description short (under ~70 characters), present tense, lowercase after the colon.

## Feature branching

- `main` is always deployable. **Never push directly to `main`.**
- Every piece of work gets its own branch, created from an up-to-date `main`:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b feature/short-description
  ```
- Branch naming: `feature/short-description` (e.g. `feature/backend-setup`, `feature/workout-crud`).
- Commit as you go, following the convention above.
- Push your branch and open a Pull Request into `main`:
  ```bash
  git push -u origin feature/short-description
  ```
- In the PR description, link the related issue with `Closes #<issue-number>` so it closes automatically on merge.
- Get at least one review before merging.
- Delete the branch after merging.

## Workflow order

1. Pick an issue from the project board (Backlog → move to In Progress).
2. Create a branch for it.
3. Design/plan before writing code (wireframe, data shape, etc. where relevant).
4. Write the code, with tests where applicable.
5. Commit using the convention above.
6. Open a PR, link the issue, request review.
7. Merge after approval. Issue closes automatically.
