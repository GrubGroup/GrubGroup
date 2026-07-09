import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { cn } from '@/utils/cn'
import { IconButton } from './IconButton'
import { Icon } from './Icon'

type ModalSize = 'sm' | 'md' | 'lg' | 'full'
type ModalVariant = 'center' | 'sheet'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: ModalSize
  variant?: ModalVariant
  children: ReactNode
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  full: 'max-w-4xl',
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  variant = 'center',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-overlay p-4',
        variant === 'center' ? 'items-center justify-center' : 'items-end justify-center',
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full bg-surface-raised shadow-xl',
          sizeClasses[size],
          variant === 'center' ? 'rounded-card' : 'rounded-t-card',
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
            <IconButton
              label="Close"
              size="sm"
              icon={<Icon name="x" size={14} />}
              onClick={onClose}
            />
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
