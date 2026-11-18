import { useEffect, useReducer, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  MIN_PASSWORD_LENGTH, registerErrorMessage, registerWithPassword,
  registrationReducer, registrationSuccessMessage, validateRegister,
} from '../lib/register'
import type { RegisterErrors } from '../lib/register'

export default function RegisterPage({ onLogin }: { onLogin: () => void }) {
  const { loading, configurationError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [state, dispatch] = useReducer(registrationReducer, { status: 'idle' })
  const pending = useRef(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmationInput = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const submitting = state.status === 'submitting'

  useEffect(() => {
    if (state.status === 'error' || state.status === 'success') feedback.current?.focus()
  }, [state.status])

  function clearError(field: keyof RegisterErrors) {
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    if (state.status === 'error') dispatch({ type: 'reset' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || loading || state.status === 'success') return
    dispatch({ type: 'reset' })
    const nextErrors = validateRegister(email, password, confirmation)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      if (nextErrors.email) emailInput.current?.focus()
      else if (nextErrors.password) passwordInput.current?.focus()
      else confirmationInput.current?.focus()
      return
    }
    if (!supabase || configurationError) return

    pending.current = true
    dispatch({ type: 'start' })
    try {
      const result = await registerWithPassword(supabase, email, password)
      setPassword('')
      setConfirmation('')
      dispatch({ type: 'succeeded', hasSession: result.hasSession })
    } catch (error: unknown) {
      dispatch({ type: 'failed', message: registerErrorMessage(error) })
    } finally {
      pending.current = false
    }
  }

  return (
    <div className="app login-page">
      <Header />
      <main aria-labelledby="register-title">
        <h1 id="register-title">Loo konto</h1>
        <p className="login-intro">Alusta oma treeningupäevikut.</p>

        {configurationError && (
          <p className="login-notice" id="register-configuration" role="status">
            {configurationError}
          </p>
        )}

        {state.status === 'success' ? (
          <>
            <p className="login-notice" role="status" tabIndex={-1} ref={feedback}>
              {registrationSuccessMessage(state.hasSession)}
            </p>
            <button className="login-submit" onClick={onLogin} type="button">
              {state.hasSession ? 'Jätka treeningupäevikusse' : 'Tagasi sisselogimise juurde'}
            </button>
          </>
        ) : (
          <>
            <form noValidate onSubmit={handleSubmit} aria-busy={submitting}
              aria-describedby={configurationError ? 'register-configuration' : undefined}>
              <div className="login-field">
                <label htmlFor="register-email">E-posti aadress</label>
                <input id="register-email" name="email" type="email" autoComplete="email"
                  inputMode="email" autoCapitalize="none" spellCheck={false} required
                  ref={emailInput} value={email} disabled={submitting}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'register-email-error' : undefined}
                  onChange={(event) => { setEmail(event.target.value); clearError('email') }} />
                {errors.email && <p className="login-error" id="register-email-error">{errors.email}</p>}
              </div>

              <div className="login-field">
                <label htmlFor="register-password">Parool</label>
                <p id="register-password-hint">Vähemalt {MIN_PASSWORD_LENGTH} märki.</p>
                <input id="register-password" name="password" type="password"
                  autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required
                  ref={passwordInput} value={password} disabled={submitting}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={`register-password-hint${errors.password ? ' register-password-error' : ''}`}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    clearError('password')
                    setErrors((previous) => ({ ...previous, confirmPassword: undefined }))
                  }} />
                {errors.password && <p className="login-error" id="register-password-error">{errors.password}</p>}
              </div>

              <div className="login-field">
                <label htmlFor="register-confirmation">Korda parooli</label>
                <input id="register-confirmation" name="confirmPassword" type="password"
                  autoComplete="new-password" required ref={confirmationInput}
                  value={confirmation} disabled={submitting}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'register-confirmation-error' : undefined}
                  onChange={(event) => {
                    setConfirmation(event.target.value); clearError('confirmPassword')
                  }} />
                {errors.confirmPassword && (
                  <p className="login-error" id="register-confirmation-error">{errors.confirmPassword}</p>
                )}
              </div>

              <p className="login-error" role="alert" tabIndex={-1} ref={feedback}>
                {state.status === 'error' ? state.message : ''}
              </p>
              <button className="login-submit" type="submit"
                disabled={submitting || loading || !supabase || Boolean(configurationError)}>
                {submitting ? 'Loon kontot…' : loading ? 'Laadin sessiooni…' : 'Loo konto'}
              </button>
              <p className="login-progress" role="status">
                {submitting ? 'Konto loomine on pooleli.' : loading ? 'Kontrollin olemasolevat sessiooni.' : ''}
              </p>
            </form>
            <p className="login-registration">
              Konto on juba olemas?{' '}
              <button className="auth-navigation" type="button" onClick={onLogin} disabled={submitting}>
                Logi sisse
              </button>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
