import { Badge } from '@/components/ui'

export interface SessionTimerProps {
  minutes: number // Session.time_limit
}

// Static display of the session time limit. (Live countdown would tick via a
// hook once the backend supplies a start timestamp.)
export function SessionTimer({ minutes }: SessionTimerProps) {
  return <Badge tone="neutral">⏱ {minutes} min limit</Badge>
}
