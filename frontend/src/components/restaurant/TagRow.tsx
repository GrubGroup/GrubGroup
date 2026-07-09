import { Badge } from '@/components/ui'

export interface TagRowProps {
  cuisineTags?: string[]
  dietaryTags?: string[]
}

// Renders cuisine tags (kraft) and dietary tags (success) as a wrapped row.
export function TagRow({ cuisineTags = [], dietaryTags = [] }: TagRowProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {cuisineTags.map((t) => (
        <Badge key={`c-${t}`} tone="kraft">
          {t}
        </Badge>
      ))}
      {dietaryTags.map((t) => (
        <Badge key={`d-${t}`} tone="success">
          {t}
        </Badge>
      ))}
    </div>
  )
}
