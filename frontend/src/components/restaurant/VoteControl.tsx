import { Button, Icon } from '@/components/ui'

export interface VoteControlProps {
  voteCount: number
  hasVoted: boolean
  onVote: () => void
}

export function VoteControl({ voteCount, hasVoted, onVote }: VoteControlProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-muted">
        {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
      </span>
      <Button
        variant={hasVoted ? 'primary' : 'ghost'}
        size="sm"
        onClick={onVote}
        leftIcon={hasVoted ? <Icon name="check" size={13} /> : undefined}
      >
        {hasVoted ? 'Voted' : 'Vote'}
      </Button>
    </div>
  )
}
