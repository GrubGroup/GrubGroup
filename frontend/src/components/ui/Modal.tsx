import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EASE } from '@/lib/motion'
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
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Dialog entrance per variant: center scales/rises in; sheet slides up from the
  // bottom. Reduced-motion collapses both to an opacity-only crossfade. Kept
  // mounted via AnimatePresence so the exit animation plays on close.
  const panelMotion =
    variant === 'center'
      ? {
          initial: { opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 8 },
        }
      : {
          initial: { opacity: reduce ? 0 : 1, y: reduce ? 0 : '100%' },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: reduce ? 0 : 1, y: reduce ? 0 : '100%' },
        }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            'fixed inset-0 z-50 flex bg-overlay p-4',
            variant === 'center' ? 'items-center justify-center' : 'items-end justify-center',
          )}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full bg-surface-raised shadow-xl',
              sizeClasses[size],
              variant === 'center' ? 'rounded-card' : 'rounded-t-card',
            )}
            {...panelMotion}
            transition={{ duration: reduce ? 0.2 : 0.22, ease: EASE }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
