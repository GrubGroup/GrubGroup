import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrandPanel } from './BrandPanel'
import { EASE } from '@/lib/motion'
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
//
// The step body swipes between steps: forward (Continue) slides the new step in
// from the right, back (Back) slides it in from the left. Direction is derived
// from the change in `step` (all 4 steps render through this one layout). The
// progress ticks live OUTSIDE the animated block so they persist across the
// swipe. Reduced-motion collapses the swipe to a plain crossfade.
export function OnboardingLayout({ step, total, title, subtitle, children }: OnboardingLayoutProps) {
  const reduce = useReducedMotion()
  // Derive swipe direction from the step change, using React's "adjust state
  // during render" pattern (track the previous step in state, compare, update in
  // the same render) — no ref reads/writes during render.
  const [prevStep, setPrevStep] = useState(step)
  const [direction, setDirection] = useState(1)
  if (step !== prevStep) {
    setDirection(step > prevStep ? 1 : -1)
    setPrevStep(step)
  }
  const dx = reduce ? 0 : direction * 40

  return (
    <div className="flex h-screen bg-surface-raised">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-hidden p-8">
        <div className="flex w-full max-w-md flex-col gap-5">
          {/* progress ticks — persist across the swipe */}
          <div className="flex gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-pill transition-colors duration-300',
                  i < step ? 'bg-text' : 'bg-text/15',
                )}
              />
            ))}
          </div>
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: dx }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dx }}
              transition={{ duration: reduce ? 0.2 : 0.35, ease: EASE }}
              className="flex flex-col gap-5"
            >
              <div>
                <p className="text-overline font-semibold uppercase tracking-wide text-text-muted">
                  Step {step} of {total}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold text-text">{title}</h1>
                <p className="mt-1 text-body text-text-muted">{subtitle}</p>
              </div>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
