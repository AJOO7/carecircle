import { useEffect, useState } from 'react'
import type { MedicationPhoto } from '../types'
import { api } from '../lib/supabase'
import { useApp } from '../context'

export function MedicinePhoto({ photo, alt, className = '' }: { photo?: MedicationPhoto; alt: string; className?: string }) {
  const { state } = useApp()
  const [url, setUrl] = useState(photo?.dataUrl ?? '')

  useEffect(() => {
    setUrl(photo?.dataUrl ?? '')
    if (!photo?.storagePath || !state.activeCircleId) return
    let active = true
    void api<{ signedUrl: string }>(`/circles/${state.activeCircleId}/medicine-photos/${photo.id}/url`)
      .then(result => { if (active) setUrl(result.signedUrl) })
      .catch(() => { if (active) setUrl('') })
    return () => { active = false }
  }, [photo?.dataUrl, photo?.id, photo?.storagePath, state.activeCircleId])

  if (!url) return <div className={`bg-slate-100 ${className}`} aria-label={`${alt} unavailable`} />
  return <img src={url} alt={alt} className={`object-cover ${className}`} />
}
