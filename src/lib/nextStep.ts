import type { AppState } from '../types'
import { isDismissed } from './dismissals'
import { setupProgress, type SetupStep } from './setupProgress'

export function currentNextStep(state: AppState, now = new Date(), sessionDismissed: string[] = []): SetupStep | undefined {
  return setupProgress(state).steps.find(step =>
    !step.complete &&
    !sessionDismissed.includes(`next-step:${step.id}`) &&
    !isDismissed(`next-step:${step.id}`, now)
  )
}
