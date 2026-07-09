import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export function Input({ label, error, hint, leftIcon, className, id, ...props }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full rounded-input border bg-surface-sunken px-3 text-text',
            'placeholder:text-text-muted/60',
            'focus:outline-none focus:ring-2 focus:ring-focus-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            Boolean(leftIcon) && 'pl-10',
            error ? 'border-error' : 'border-border',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
