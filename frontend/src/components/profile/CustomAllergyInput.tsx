import { useState } from 'react'
import { Icon } from '@/components/ui'
import { cn } from '@/utils/cn'

// Free-text allergy capture from the onboarding wireframe's ALLERGIES group.
//
// FRONTEND-ONLY (by decision): custom allergies typed here are NOT persisted to
// the profile yet. The controlled dietary vocabulary (constants/dietary.ts) is
// what the orchestrator matches against restaurant tags; free-text tokens like
// "sulfites" have no matchable tag, so they're held in local state until
// normalization is designed. The "+ Other" chip toggles the text field.
export interface CustomAllergyInputProps {
  /** Controlled list of custom allergy labels. */
  value: string[]
  onChange: (next: string[]) => void
  className?: string
}

export function CustomAllergyInput({ value, onChange, className }: CustomAllergyInputProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const add = () => {
    const label = draft.trim()
    if (!label) return
    // Case-insensitive de-dupe; keep the first-entered casing.
    if (!value.some((v) => v.toLowerCase() === label.toLowerCase())) {
      onChange([...value, label])
    }
    setDraft('')
  }

  const remove = (label: string) => onChange(value.filter((v) => v !== label))

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((label) => (
          // Selected chip with a remove affordance (× via the label suffix).
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-pill border border-surface-inverse bg-surface-inverse py-1.5 pl-3.5 pr-2 text-sm font-medium text-white"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              onClick={() => remove(label)}
              className="grid h-4 w-4 place-items-center rounded-full text-white/80 hover:text-white"
            >
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}

        {/* Dashed "+ Other" toggle — reveals the text field on click. */}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-pill border border-dashed px-3 py-1.5 text-sm font-medium transition-colors',
            open
              ? 'border-surface-inverse bg-surface-inverse text-white'
              : 'border-border text-text-muted hover:border-border-strong',
          )}
        >
          <Icon name="plus" size={12} /> Other
        </button>
      </div>

      {open && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="Type an allergy…"
            className="h-11 flex-1 rounded-input border border-border bg-surface-raised px-3.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="h-11 rounded-input bg-surface-inverse px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
