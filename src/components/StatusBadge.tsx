import type { AlertStatus } from '../types'

const STATUS_CONFIG: Record<AlertStatus, { bg: string; text: string; dot: string; label: string }> = {
  Unconfirmed: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Unconfirmed' },
  Assigned:    { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6', label: 'Assigned' },
  'In Progress': { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', label: 'In Progress' },
  Confirmed:   { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'Confirmed' },
  Missed:      { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Not taken' },
  'Not recorded': { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8', label: 'Not recorded' },
}

export function StatusBadge({ status, size = 'sm' }: { status: AlertStatus; size?: 'xs' | 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status]
  const padding = size === 'xs' ? 'px-1.5 py-0.5' : size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  const text = size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-xs' : 'text-sm'
  const dot = size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding} ${text}`}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      role="status"
    >
      <span className={`${dot} rounded-full flex-shrink-0`} style={{ backgroundColor: cfg.dot }} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

export function getStatusConfig(status: AlertStatus) {
  return STATUS_CONFIG[status]
}
