import { useRef, useState } from 'react'
import { Avatar, Button, Icon, Input, Modal, Spinner } from '@/components/ui'
import { searchUsers } from '@/api/users.api'
import { cn } from '@/utils/cn'
import type { UserSearchResult } from '@/types'

export interface NewGroupModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, memberIds: number[]) => void
  pending?: boolean
}

const SEARCH_DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 2

// Instagram-style group creation: name the group, search users by username, add
// them as removable chips, then create with the whole roster at once. At least
// one other member is required (the caller is added server-side).
export function NewGroupModal({ open, onClose, onSubmit, pending = false }: NewGroupModalProps) {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [selected, setSelected] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetAndClose = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setName('')
    setQuery('')
    setResults([])
    setSelected([])
    setSearching(false)
    onClose()
  }

  // Debounced username search, driven from the input's onChange (not an effect,
  // so state updates stay event-scoped). Results exclude selected users below.
  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = value.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await searchUsers(q))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }

  const selectedIds = new Set(selected.map((u) => u.id))
  const visibleResults = results.filter((u) => !selectedIds.has(u.id))

  const addMember = (user: UserSearchResult) => {
    setSelected((s) => [...s, user])
    setQuery('')
    setResults([])
  }

  const removeMember = (id: number) => {
    setSelected((s) => s.filter((u) => u.id !== id))
  }

  const canCreate = name.trim().length > 0 && selected.length >= 1 && !pending

  const submit = () => {
    if (!canCreate) return
    onSubmit(
      name.trim(),
      selected.map((u) => u.id),
    )
  }

  return (
    <Modal open={open} onClose={resetAndClose} title="New group" size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label="Group name"
          placeholder="e.g. Weekend Trip"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <Input
            label="Add members"
            placeholder="Search by username"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            leftIcon={<Icon name="search" size={16} />}
          />

          {/* Selected members as removable chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-sunken py-1 pl-1.5 pr-2 text-sm text-text"
                >
                  <Avatar name={u.display_name ?? u.username} src={u.avatar_url} size="sm" className="h-5 w-5 text-[8px]" />
                  <span>@{u.username}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${u.username}`}
                    onClick={() => removeMember(u.id)}
                    className="text-text-muted hover:text-text"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search results dropdown */}
          {query.trim().length >= MIN_QUERY_LENGTH && (
            <div className="max-h-52 overflow-y-auto rounded-input border border-border">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-text-muted">
                  <Spinner size="sm" /> Searching…
                </div>
              ) : visibleResults.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No users found.</p>
              ) : (
                visibleResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addMember(u)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0',
                      'hover:bg-surface-sunken',
                    )}
                  >
                    <Avatar name={u.display_name ?? u.username} src={u.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      {u.display_name && (
                        <p className="truncate text-sm font-medium text-text">{u.display_name}</p>
                      )}
                      <p className="truncate text-xs text-text-muted">@{u.username}</p>
                    </div>
                    <Icon name="plus" size={14} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Button fullWidth disabled={!canCreate} onClick={submit}>
          {pending ? <Spinner size="sm" /> : `Create group${selected.length ? ` (${selected.length + 1})` : ''}`}
        </Button>
      </div>
    </Modal>
  )
}
