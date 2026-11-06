import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

const supabaseGlobal = globalThis as typeof globalThis & {
  __careCircleSupabase?: SupabaseClient
}

export const supabase = supabaseGlobal.__careCircleSupabase ?? createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

supabaseGlobal.__careCircleSupabase = supabase

const serverBase = `https://${projectId}.supabase.co/functions/v1/make-server-e043d7e3`

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  // Without a session the public key is sent; the server decides whether login is required.
  const token = data.session?.access_token ?? publicAnonKey
  const response = await fetch(`${serverBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status)
  return payload as T
}

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${serverBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: publicAnonKey,
      Authorization: 'Bearer ' + publicAnonKey,
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status)
  return payload as T
}
