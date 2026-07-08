/**
 * Tiny className joiner. Filters out falsy values so conditional classes read cleanly:
 *   cn('base', isActive && 'active', error ? 'border-error' : undefined)
 * No dedupe/merge — keep class lists intentional. Dependency-light by design.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
