// Per-member identity colors for avatars. There is no backend column for a
// member's avatar color, so the palette is a client-side UI design token: a
// deterministic mapping from a user id onto the `--color-member-*` theme tokens
// (see index.css @theme) so each person stays visually distinguishable across the
// roster, chat, and event views.
//
// A small fixed table covers the common small-group case with the hand-picked
// wireframe palette; any id outside it (larger groups, live user ids) falls back
// to a stable hash over the same palette so every member always gets a color.

// The palette, in assignment order. Values are the Tailwind class suffix that
// pairs with the `member-*` color tokens (e.g. bg-member-purple).
const MEMBER_PALETTE = [
  'member-purple',
  'member-terracotta',
  'member-pink',
  'member-green',
  'member-blue',
  'member-amber',
] as const

// Return a stable avatar color token for a user id. Deterministic: the same id
// always maps to the same palette entry, so a member's color is consistent
// everywhere they appear.
export function memberColor(userId: number): string {
  const i = ((userId % MEMBER_PALETTE.length) + MEMBER_PALETTE.length) % MEMBER_PALETTE.length
  return MEMBER_PALETTE[i]
}
