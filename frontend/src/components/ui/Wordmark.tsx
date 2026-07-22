import { Icon } from './Icon'
import { cn } from '@/utils/cn'

// The GrubGroup logotype: orange utensils tile + "Grub" (theme text / white on
// dark) + "Group" (orange accent). The orange "Group" split is the sanctioned
// brand accent — it is a logotype, not a CTA, so it does not break the
// "orange = accent only" rule. Logotype sizes are intentionally OUT of the
// --text-* type scale.

export type WordmarkSize = 'sm' | 'md' | 'lg'

export interface WordmarkProps {
  /** Type + tile scale. sm = app sidebar header, md = landing nav, lg = hero/splash. */
  size?: WordmarkSize
  /** On dark surfaces (auth panel, dark landing sections), render "Grub" white. */
  dark?: boolean
  /** Render the orange utensils tile. Off in the app sidebar, where the rail badge is the mark. */
  showTile?: boolean
  className?: string
}

const SIZES: Record<WordmarkSize, { tile: string; icon: number; text: string }> = {
  sm: { tile: 'h-7 w-7 rounded-[9px]', icon: 15, text: 'text-[17px]' },
  md: { tile: 'h-8 w-8 rounded-[10px]', icon: 17, text: 'text-[22px]' }, // === legacy Landing wordmark
  lg: { tile: 'h-9 w-9 rounded-xl', icon: 19, text: 'text-[26px]' },
}

export function Wordmark({ size = 'md', dark = false, showTile = true, className }: WordmarkProps) {
  const s = SIZES[size]
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {showTile && (
        <span className={cn('flex items-center justify-center bg-primary text-white', s.tile)}>
          <Icon name="utensils" size={s.icon} />
        </span>
      )}
      <span className={cn('font-display font-extrabold leading-none', s.text)}>
        <span className={dark ? 'text-white' : 'text-text'}>Grub</span>
        <span className="text-primary">Group</span>
      </span>
    </div>
  )
}
