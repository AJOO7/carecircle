import { useState } from 'react'
import { useAuthStatus } from '../auth/AuthStatus'
import { Button, Dialog, Field } from './ui'
import { supabase } from '../lib/supabase'

export function SessionExpiredOverlay() {
  const auth = useAuthStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  if (!auth.sessionExpired) return null
  return <Dialog title="Your session ended" onClose={() => undefined}>
    <p className="text-sm text-slate-600 mb-4">Sign back in to continue. Your open form remains here while you reconnect.</p>
    <div className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} />
      <Field label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button className="w-full" disabled={!email.includes('@') || password.length < 8} onClick={async () => {
        const result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) setError(result.error.message)
      }}>Sign back in</Button>
    </div>
  </Dialog>
}
