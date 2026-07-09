import { Icon } from '@/components/ui'

// Dark brand panel shown on the left of the auth screens (matches wireframe).
export function BrandPanel() {
  return (
    <div className="relative hidden w-[38%] shrink-0 flex-col justify-between bg-surface-inverse p-10 text-white lg:flex">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
          <Icon name="utensils" size={16} />
        </span>
        <span className="font-display text-lg font-bold">GrubGroup</span>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 text-3xl">
          <span>🍱</span>
          <span>🍕</span>
          <span>🍷</span>
        </div>
        <h1 className="font-display text-4xl font-bold leading-tight">
          The restaurant
          <br />
          everyone agrees on.
        </h1>
        <p className="max-w-xs text-sm text-white/60">
          Every person talks to their own AI agent. One result that works for the whole group.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[
              { c: 'bg-member-terracotta', l: 'S' },
              { c: 'bg-member-purple', l: 'D' },
              { c: 'bg-member-green', l: 'M' },
              { c: 'bg-member-amber', l: 'T' },
            ].map((m) => (
              <span
                key={m.l}
                className={`flex h-7 w-7 items-center justify-center rounded-pill border-2 border-surface-inverse text-[10px] font-semibold ${m.c}`}
              >
                {m.l}
              </span>
            ))}
          </div>
          <span className="text-xs text-white/50">Joined by thousands of groups</span>
        </div>
      </div>

      <p className="text-xs text-white/30">© 2026 GrubGroup</p>
    </div>
  )
}
