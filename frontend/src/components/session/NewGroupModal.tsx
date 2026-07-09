import { useState } from 'react'
import { Button, Input, Modal } from '@/components/ui'

export interface NewGroupModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string) => void
}

// Prompt for a group name, then create it (local-only for now — see groupsStore).
export function NewGroupModal({ open, onClose, onSubmit }: NewGroupModalProps) {
  const [name, setName] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setName('')
  }

  return (
    <Modal open={open} onClose={onClose} title="New group" size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label="Group name"
          placeholder="e.g. Weekend Trip"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <Button fullWidth disabled={!name.trim()} onClick={submit}>
          Create group
        </Button>
      </div>
    </Modal>
  )
}
