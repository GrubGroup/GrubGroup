import { create } from 'zustand'
import type { ChatMessage, NotedPref } from '@/types'
import { MOCK_AGENT_REPLIES, MOCK_CHAT_OPENING, MOCK_NOTED_PREFS } from '@/api/mock/chatScript.mock'

interface ChatState {
  messages: ChatMessage[]
  notedPreferences: NotedPref[]
  replyIndex: number
  seed: () => void
  sendUserMessage: (text: string) => void
}

let idCounter = 100
const nextId = () => `m${++idCounter}`

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  notedPreferences: [],
  replyIndex: 0,

  seed: () => {
    set({
      messages: structuredClone(MOCK_CHAT_OPENING),
      notedPreferences: structuredClone(MOCK_NOTED_PREFS),
      replyIndex: 0,
    })
  },

  sendUserMessage: (text) => {
    if (!text.trim()) return
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      text: text.trim(),
      at: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, userMsg] }))

    // Mock agent reply (cycled). Later replaced by socket/AI response.
    const { replyIndex } = get()
    const replyText = MOCK_AGENT_REPLIES[Math.min(replyIndex, MOCK_AGENT_REPLIES.length - 1)]
    const agentMsg: ChatMessage = {
      id: nextId(),
      role: 'agent',
      text: replyText,
      at: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, agentMsg], replyIndex: s.replyIndex + 1 }))
  },
}))
