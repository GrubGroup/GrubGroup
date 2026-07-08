import { useState } from 'react'
import { Button, Input, Modal } from '@/components/ui'

export interface GuestNameModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string) => void
}

// One-off guest join (no saved profile) per the "guest mode" user story.
export function GuestNameModal({ open, onClose, onSubmit }: GuestNameModalProps) {
  const [name, setName] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="Join as guest" size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label="Your name"
          placeholder="e.g. Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="No account needed for this one-off session."
        />
        <Button fullWidth disabled={!name.trim()} onClick={() => onSubmit(name.trim())}>
          Join session
        </Button>
      </div>
    </Modal>
  )
}
