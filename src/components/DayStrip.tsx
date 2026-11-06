import { useApp } from '../context'
import { dayClosure } from '../lib/metrics'

export function DayStrip() {
  const { state, now } = useApp()
  const metrics = dayClosure(state, now())
  return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
      <p><b className="text-slate-800">Today:</b> {metrics.closedToday} of {metrics.totalToday} closed. <b>Next:</b> {metrics.next ?? 'Nothing open'}</p>
      <p><b className="text-slate-800">Closed this week:</b> {metrics.closedThisWeek} care {metrics.closedThisWeek === 1 ? 'item' : 'items'}</p>
      {metrics.tomorrowPreview && <p><b className="text-slate-800">Tomorrow:</b> {metrics.tomorrowPreview}</p>}
    </div>
    {metrics.quotedReply && <p className="text-sm text-slate-700 mt-3"><b>{metrics.quotedReply.speaker}:</b> “{metrics.quotedReply.text}”</p>}
  </div>
}
