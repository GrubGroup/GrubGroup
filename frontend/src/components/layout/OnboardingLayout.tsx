import type { ReactNode } from 'react'
import { BrandPanel } from './BrandPanel'
import { cn } from '@/utils/cn'

export interface OnboardingLayoutProps {
  step: number // 1-based
  total: number
  title: string
  subtitle: string
  children: ReactNode
}

// Auth-style split layout for the onboarding steps: brand panel + stepped form
// with progress ticks, "STEP N OF total", title/subtitle, and content.
export function OnboardingLayout({ step, total, title, subtitle, children }: OnboardingLayoutProps) {
  return (
    <div className="flex h-screen bg-surface-raised">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex w-full max-w-md flex-col gap-5">
          {/* progress ticks */}
          <div className="flex gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn('h-1 flex-1 rounded-pill', i < step ? 'bg-text' : 'bg-text/15')}
              />
            ))}
          </div>
          <div>
            <p className="text-overline font-semibold uppercase tracking-wide text-text-muted">
              Step {step} of {total}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-text">{title}</h1>
            <p className="mt-1 text-body text-text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
