import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { loginErrorMessage, validateLogin } from '../lib/login'
import type { LoginErrors } from '../lib/login'

export default function LoginPage() {
  const { loading, configurationError, error: sessionError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const errorMessage = useRef<HTMLParagraphElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || loading) return
    setSubmitError(null)
    const nextErrors = validateLogin(email, password)
    setErrors(nextErrors)
    if (nextErrors.email || nextErrors.password) {
      if (nextErrors.email) emailInput.current?.focus()
      else passwordInput.current?.focus()
      return
    }
    if (!supabase || configurationError) return

    pending.current = true
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password, // Passwords must not be trimmed or otherwise transformed.
      })
      if (error) throw error
      if (!data.session) throw new Error('No authenticated session returned')
      setPassword('')
      // AuthProvider receives SIGNED_IN; App renders the authenticated view.
    } catch (error: unknown) {
      setSubmitError(loginErrorMessage(error))
      errorMessage.current?.focus()
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="app login-page">
      <Header />
      <main aria-labelledby="login-title">
        <h1 id="login-title">Logi sisse</h1>
        <p className="login-intro">Jätka oma treeningupäevikuga.</p>

        {configurationError && (
          <p className="login-notice" id="login-configuration" role="status">
            {configurationError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={submitting}
          aria-describedby={configurationError ? 'login-configuration' : undefined}>
          <div className="login-field">
            <label htmlFor="login-email">E-posti aadress</label>
            <input id="login-email" name="email" type="email" autoComplete="email"
              inputMode="email" autoCapitalize="none" spellCheck={false} required
              ref={emailInput} value={email} disabled={submitting}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((previous) => ({ ...previous, email: undefined }))
                setSubmitError(null)
              }} />
            {errors.email && <p className="login-error" id="login-email-error">{errors.email}</p>}
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Parool</label>
            <input id="login-password" name="password" type="password"
              autoComplete="current-password" required ref={passwordInput}
              value={password} disabled={submitting}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((previous) => ({ ...previous, password: undefined }))
                setSubmitError(null)
              }} />
            {errors.password && <p className="login-error" id="login-password-error">{errors.password}</p>}
          </div>

          <p className="login-error" role="alert" tabIndex={-1} ref={errorMessage}>
            {submitError ?? sessionError}
          </p>
          <button className="login-submit" type="submit"
            disabled={submitting || loading || !supabase || Boolean(configurationError)}>
            {submitting ? 'Login sisse…' : loading ? 'Laadin sessiooni…' : 'Logi sisse'}
          </button>
          <p className="login-progress" role="status">
            {submitting ? 'Sisselogimine on pooleli.' : loading ? 'Kontrollin olemasolevat sessiooni.' : ''}
          </p>
        </form>

        <p className="login-registration">Pole veel kontot? Registreerimisleht pole veel saadaval.</p>
      </main>
    </div>
  )
}
