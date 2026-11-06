import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { CheckCircleIcon, XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from './icons'
import type { Toast } from '../types'

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false)
  const text = toast.message

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const config = {
    success: {
      bg: '#ecf8f0',
      border: '#9fd8b6',
      iconColor: '#16A34A',
      textColor: '#15803D',
      Icon: CheckCircleIcon,
    },
    error: {
      bg: '#FFF1F2',
      border: '#FECDD3',
      iconColor: '#DC2626',
      textColor: '#B91C1C',
      Icon: ExclamationTriangleIcon,
    },
    warning: {
      bg: '#FFFBEB',
      border: '#FDE68A',
      iconColor: '#D97706',
      textColor: '#B45309',
      Icon: ExclamationTriangleIcon,
    },
    info: {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      iconColor: '#2563EB',
      textColor: '#1D4ED8',
      Icon: InformationCircleIcon,
    },
  }[toast.type]

  return (
    <div
      role="status"
      aria-live="polite"
      className="cc-toast flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-sm w-full transition-all duration-300"
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <config.Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium flex-1 leading-snug" style={{ color: config.textColor }}>
        {text}
      </p>
      <button
        onClick={onRemove}
        className="flex-shrink-0 rounded-md p-0.5 transition-opacity opacity-60 hover:opacity-100"
        style={{ color: config.iconColor }}
        aria-label="Dismiss notification"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { state, actions } = useApp()
  return (
    <div
      aria-live="assertive"
      className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-50 flex flex-col gap-2 items-end pointer-events-none"
    >
      {state.toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={() => actions.removeToast(toast.id)} />
        </div>
      ))}
    </div>
  )
}
