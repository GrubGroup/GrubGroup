// Deterministic member-identity color from a stable user id, reusing the six
// `member-*` tokens defined in index.css (and mapped in Avatar's colorClasses).
// Ordering mirrors MOCK_MEMBER_COLORS so real + mock users look consistent.
//
// Returns a colorClass NAME (e.g. "member-purple") — always pass it through
// Avatar's `colorClass` prop, which owns the literal `bg-member-*` map. Never
// interpolate `bg-${color}`: Tailwind's scanner only sees classes written in
// full, so a dynamic class name would not be generated.
const MEMBER_PALETTE = [
  'member-purple',
  'member-terracotta',
  'member-pink',
  'member-green',
  'member-blue',
  'member-amber',
] as const

export function memberColor(id: number): string {
  return MEMBER_PALETTE[Math.abs(id) % MEMBER_PALETTE.length]
}
