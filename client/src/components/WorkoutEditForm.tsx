import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { detailDraft, editBody, validateWorkoutEdit } from '../lib/workout-detail'
import type { WorkoutDetail } from '../lib/workout-detail'
import { hasWorkoutErrors } from '../lib/new-workout'
import type { CreateWorkoutBody, WorkoutErrors } from '../lib/new-workout'

export default function WorkoutEditForm({ workout, busy, onSave, onCancel }: {
  workout: WorkoutDetail
  busy: boolean
  onSave: (body: CreateWorkoutBody) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => detailDraft(workout))
  const [errors, setErrors] = useState<WorkoutErrors>({ rows: [] })
  const form = useRef<HTMLFormElement>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const next = validateWorkoutEdit(draft, workout)
    setErrors(next)
    if (hasWorkoutErrors(next)) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    onSave(editBody(draft, workout))
  }

  return (
    <form ref={form} onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <h2>Muuda treeningut</h2>
      <fieldset disabled={busy} className="workout-form-fields">
        <legend className="visually-hidden">Treeningu muutmine</legend>
        {(['name', 'date'] as const).map((field) => (
          <div className="login-field" key={field}>
            <label htmlFor={`edit-${field}`}>{field === 'name' ? 'Treeningu nimi' : 'Kuupäev'}</label>
            <input id={`edit-${field}`} type={field === 'date' ? 'date' : 'text'} required value={draft[field]}
              aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `edit-error-${field}` : undefined}
              onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }); setErrors({ rows: [] }) }} />
            {errors[field] && <p className="login-error" id={`edit-error-${field}`}>{errors[field]}</p>}
          </div>
        ))}
        {workout.sets.map((set, index) => (
          <fieldset className="workout-card workout-set" key={set.id}>
            <legend>{set.exercise_name} — seeria {index + 1}</legend>
            {(['weight', 'reps'] as const).map((field) => (
              <div className="login-field" key={field}>
                <label htmlFor={`edit-${field}-${index}`}>{field === 'weight' ? 'Raskus (kg)' : 'Kordused'}</label>
                <input id={`edit-${field}-${index}`} type="number" required min={field === 'weight' ? 0 : 1}
                  step={field === 'weight' ? 'any' : 1} inputMode={field === 'weight' ? 'decimal' : 'numeric'}
                  value={draft.sets[index][field]} aria-invalid={Boolean(errors.rows[index]?.[field])}
                  aria-describedby={errors.rows[index]?.[field] ? `edit-error-${field}-${index}` : undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, sets: draft.sets.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row) })
                    setErrors({ rows: [] })
                  }} />
                {errors.rows[index]?.[field] && <p className="login-error" id={`edit-error-${field}-${index}`}>{errors.rows[index][field]}</p>}
              </div>
            ))}
          </fieldset>
        ))}
        {errors.sets && <p className="login-error" role="alert">{errors.sets}</p>}
        <button className="login-submit" type="submit">{busy ? 'Salvestan…' : 'Salvesta muudatused'}</button>
        <button className="auth-navigation" type="button" onClick={onCancel}>Loobu</button>
      </fieldset>
    </form>
  )
}
