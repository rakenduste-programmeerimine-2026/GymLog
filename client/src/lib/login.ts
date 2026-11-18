import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

export interface LoginErrors {
  email?: string
  password?: string
}

export function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {}
  if (!email.trim()) {
    errors.email = 'Sisesta e-posti aadress.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Sisesta korrektne e-posti aadress.'
  }
  if (!password) errors.password = 'Sisesta parool.'
  return errors
}

export function loginErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return 'Ühendus autentimisteenusega ebaõnnestus. Kontrolli internetiühendust ja proovi uuesti.'
  }
  if (isAuthError(error)) {
    if (error.code === 'invalid_credentials') {
      return 'E-posti aadress või parool on vale. Kontrolli sisestatud andmeid.'
    }
    if (error.code === 'email_not_confirmed') {
      return 'E-posti aadress on kinnitamata. Ava oma postkastis kinnituslink.'
    }
    if (error.status === 429) {
      return 'Liiga palju katseid. Oota veidi ja proovi uuesti.'
    }
    if (error.status !== undefined && error.status >= 500) {
      return 'Autentimisteenus pole praegu saadaval. Proovi hiljem uuesti.'
    }
  }
  // Never expose raw SDK messages, credentials, or account-existence details.
  return 'Sisselogimine ebaõnnestus. Kontrolli e-posti aadressi ja parooli ning proovi uuesti.'
}
