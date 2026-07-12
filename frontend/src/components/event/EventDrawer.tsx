import { Modal } from '@/components/ui'
import { EventSummary } from './EventSummary'

export interface EventDrawerProps {
  open: boolean
  onClose: () => void
}

// Shared group event, presented as a bottom sheet.
export function EventDrawer({ open, onClose }: EventDrawerProps) {
  return (
    <Modal open={open} onClose={onClose} title="Group event" variant="sheet" size="md">
      <EventSummary />
    </Modal>
  )
}
