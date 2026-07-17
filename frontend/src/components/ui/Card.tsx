import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
  interactive?: boolean
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

export function Card({
  padding = 'md',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface-raised',
        paddingClasses[padding],
        interactive &&
          'cursor-pointer transition-[box-shadow,transform] duration-200 ease-out hover:shadow-md motion-safe:hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)} {...props}>
      {children}
    </div>
  )
}

function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-text-muted', className)} {...props}>
      {children}
    </div>
  )
}

function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 flex items-center justify-end gap-2 border-t border-border pt-3', className)}
      {...props}
    >
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter
