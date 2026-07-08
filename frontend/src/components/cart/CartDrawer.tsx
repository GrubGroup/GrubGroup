import { Modal } from '@/components/ui'
import { CartSummary } from './CartSummary'

export interface CartDrawerProps {
  open: boolean
  onClose: () => void
}

// Shared group cart, presented as a bottom sheet.
export function CartDrawer({ open, onClose }: CartDrawerProps) {
  return (
    <Modal open={open} onClose={onClose} title="Group cart" variant="sheet" size="md">
      <CartSummary />
    </Modal>
  )
}
