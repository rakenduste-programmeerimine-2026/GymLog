import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateLogin } from './login'
import type { LoginErrors } from './login'

export const MIN_PASSWORD_LENGTH = 8

export interface RegisterErrors extends LoginErrors {
  confirmPassword?: string
}

export function validateRegister(email: string, password: string, confirmation: string): RegisterErrors {
  const errors: RegisterErrors = validateLogin(email, password)
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Parool peab sisaldama vähemalt ${MIN_PASSWORD_LENGTH} märki.`
  }
  if (!confirmation) {
    errors.confirmPassword = 'Korda parooli.'
  } else if (confirmation !== password) {
    errors.confirmPassword = 'Paroolid ei ühti.'
  }
  return errors
}

export function registerErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return 'Ühendus autentimisteenusega ebaõnnestus. Kontrolli internetiühendust ja proovi uuesti.'
  }
  if (isAuthError(error)) {
    if (error.code === 'weak_password') {
      return 'Parool ei vasta turvanõuetele. Vali pikem ja tugevam parool.'
    }
    if (error.status === 429) {
      return 'Liiga palju katseid. Oota veidi ja proovi uuesti.'
    }
    if (error.status !== undefined && error.status >= 500) {
      return 'Autentimisteenus pole praegu saadaval. Proovi hiljem uuesti.'
    }
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return 'Kontot ei saanud luua. Kui sul on juba konto, logi sisse.'
    }
    if (error.code === 'signup_disabled') {
      return 'Uute kontode loomine pole praegu lubatud.'
    }
  }
  return 'Konto loomine ebaõnnestus. Kontrolli sisestatud andmeid ja proovi uuesti.'
}

export type RegistrationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success'; hasSession: boolean }

export type RegistrationAction =
  | { type: 'start' }
  | { type: 'reset' }
  | { type: 'failed'; message: string }
  | { type: 'succeeded'; hasSession: boolean }

export function registrationReducer(
  _state: RegistrationState, action: RegistrationAction,
): RegistrationState {
  switch (action.type) {
    case 'start': return { status: 'submitting' }
    case 'reset': return { status: 'idle' }
    case 'failed': return { status: 'error', message: action.message }
    case 'succeeded': return { status: 'success', hasSession: action.hasSession }
  }
}

export async function registerWithPassword(
  client: SupabaseClient | null, email: string, password: string,
): Promise<{ hasSession: boolean }> {
  if (!client) throw new Error('Autentimine pole seadistatud.')
  const { data, error } = await client.auth.signUp({ email: email.trim(), password })
  if (error) throw error
  if (!data.user && !data.session) throw new Error('No sign-up result returned')
  return { hasSession: Boolean(data.session) }
}

export function registrationSuccessMessage(hasSession: boolean): string {
  return hasSession
    ? 'Konto on loodud ja oled sisse logitud. Võid jätkata treeningupäevikusse.'
    : 'Kontrolli oma e-posti. Kui aadress vajab kinnitamist, ava saadetud kinnituslink ja logi seejärel sisse. Kui sul on juba konto, kasuta sisselogimist.'
}
