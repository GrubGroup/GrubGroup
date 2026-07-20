// Offline stand-in for the QA sub-agent analyze turn (USE_MOCK path).
//
// This is the browser twin of `ai_service` `scripts/interactive_session.py`'s
// offline extractor: instead of a canned transcript, it does a real (if simple)
// deterministic parse of the member's free-text answer over the seed-catalog
// vocabulary, reconciles it against the prior signals, and returns a
// confirm-then-ask reply plus the still-missing signals — exactly the shape the
// live `POST /sessions/:id/analyze` returns. That keeps the mock conversation
// agent-reply-driven and occasion-free, walking the same
// dietary → likes → dislikes → budget → location flow as the real agent, with NO
// fabricated messages.
//
// Fidelity notes (same spirit as interactive_session's honesty notes):
//   * The extraction is a keyword/regex pass, not an LLM — so it handles the
//     common phrasings, not arbitrary prose. Live mode (`VITE_USE_MOCK=false`)
//     uses the real gateway + LLM.
//   * Tags are normalized to the backend's lowercase underscore style so the
//     "Noted so far" panel renders identically to a live turn.

import type { AnalyzeResponse, AnalyzeTurnBody, ExtractedSignals } from '@/types'
import { AGENT_ASK_ORDER } from '@/constants/agentChat'
import { CUISINES, RESTAURANT_STYLES } from '@/constants/dietary'

// --- Vocabulary -------------------------------------------------------------

// Dietary synonyms → the six controlled tags the seed catalog carries. Multi-word
// keys first so "no nuts" wins over a bare "nuts". Mirrors interactive_session's
// _DIETARY_SYNONYMS.
const DIETARY_SYNONYMS: [string, string][] = [
  ['gluten free', 'gluten_free'],
  ['gluten-free', 'gluten_free'],
  ['no gluten', 'gluten_free'],
  ['celiac', 'gluten_free'],
  ['tree nut', 'nut_free'],
  ['tree nuts', 'nut_free'],
  ['nut allergy', 'nut_free'],
  ['nut-free', 'nut_free'],
  ['nut free', 'nut_free'],
  ['no nuts', 'nut_free'],
  ['peanut', 'nut_free'],
  ['vegan', 'vegan'],
  ['vegetarian', 'vegetarian'],
  ['veggie', 'vegetarian'],
  ['halal', 'halal'],
  ['kosher', 'kosher'],
]

// Broad cuisine GROUP words → their member cuisines (a lean mirror of the backend
// taxonomy's group expansion). A group answer expands so the stored tags match
// real restaurants.
const CUISINE_GROUPS: Record<string, string[]> = {
  asian: [
    'chinese', 'japanese', 'thai', 'vietnamese', 'korean', 'taiwanese',
    'filipino', 'cantonese', 'indonesian', 'ramen', 'noodles',
  ],
  latin: ['mexican', 'latin_american', 'peruvian', 'caribbean'],
  'latin american': ['mexican', 'latin_american', 'peruvian', 'caribbean'],
  european: ['italian', 'greek', 'french', 'spanish', 'mediterranean'],
  mediterranean: ['mediterranean', 'greek', 'turkish', 'lebanese'],
  'middle eastern': ['middle_eastern', 'lebanese', 'turkish', 'persian', 'moroccan'],
}

// Extra cuisine phrasings not literally in the vocab (plurals/singular/near-
// words). Keeps the quick-reply chips ("A steakhouse", "No steakhouses", "No
// BBQ") productive under the mock's simple whole-word matcher.
const CUISINE_SYNONYMS: Record<string, string> = {
  steak: 'steakhouse',
  steaks: 'steakhouse',
  steakhouses: 'steakhouse',
  bbq: 'barbecue',
  'bbq joint': 'barbecue',
  pho: 'vietnamese',
  sushi: 'japanese',
  ramen: 'ramen',
}

// A few SF neighborhoods → the geocode the host modal would resolve. Mirrors
// interactive_session's _KNOWN_PLACES so a location answer yields real coords.
const KNOWN_PLACES: [string, number, number][] = [
  ['mission', 37.7599, -122.4148],
  ['downtown', 37.7749, -122.4194],
  ['soma', 37.7785, -122.4056],
  ['marina', 37.803, -122.437],
  ['office', 37.7899, -122.4],
  ['oakland', 37.8044, -122.2712],
  ['berkeley', 37.8715, -122.273],
]

// "No / none / flexible" → capture nothing for this field.
const SKIP_ANSWERS = new Set([
  '', 'no', 'none', 'nope', 'nah', 'nothing', 'n/a', 'na', 'skip', 'anything',
  'anything works', "anything's fine", 'whatever', 'no preference',
  'no preferences', 'no restrictions', 'no restriction', 'none really',
  'no thanks', 'nothing to avoid', 'nothing off the table', 'nothing fancy',
  'flexible', "i'm flexible", 'im flexible', 'open to anything', 'wherever works',
  "downtown's fine", 'wherever', "wherever's fine",
])

// Underscore-tag style the backend uses (so mock + live noted panels match).
const CUISINE_VOCAB: string[] = [
  ...CUISINES.map((c) => c.value.replace(/-/g, '_')),
  ...RESTAURANT_STYLES.map((s) => s.value),
]

// --- Extraction (field-scoped, mirrors interactive_session._extract_delta) --

const normalize = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ')
const isSkip = (answer: string) => SKIP_ANSWERS.has(normalize(answer))

function extractDietary(answer: string): string[] {
  const text = normalize(answer)
  const found: string[] = []
  for (const [phrase, tag] of DIETARY_SYNONYMS) {
    if (found.includes(tag)) continue
    if (new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
      found.push(tag)
    }
  }
  return found
}

function extractCuisines(answer: string): string[] {
  const text = normalize(answer)
  const found: string[] = []
  const add = (tag: string) => {
    if (!found.includes(tag)) found.push(tag)
  }
  // Broad groups expand to their members.
  for (const [group, members] of Object.entries(CUISINE_GROUPS)) {
    if (new RegExp(`\\b${group}\\b`).test(text)) members.forEach(add)
  }
  // Catalog cuisine / style tags: match the tag and its de-underscored variant.
  for (const tag of [...CUISINE_VOCAB].sort((a, b) => b.length - a.length)) {
    const variants = [tag, tag.replace(/_/g, ' ')]
    if (variants.some((v) => new RegExp(`\\b${v}\\b`).test(text))) add(tag)
  }
  // Hand synonyms for phrasings not literally in the vocab.
  for (const [phrase, tag] of Object.entries(CUISINE_SYNONYMS)) {
    if (new RegExp(`\\b${phrase}\\b`).test(text)) add(tag)
  }
  return found
}

function extractBudget(answer: string): { min: number | null; max: number | null } {
  const text = normalize(answer)
  let m = text.match(/(\d{1,4})\s*(?:-|–|to|through|and|thru)\s*\$?\s*(\d{1,4})/)
  if (m) {
    const lo = Number(m[1])
    const hi = Number(m[2])
    return { min: Math.min(lo, hi), max: Math.max(lo, hi) }
  }
  m = text.match(/(?:under|below|less than|max|maximum|up to|no more than|at most)\s*\$?\s*(\d{1,4})/)
  if (m) return { min: null, max: Number(m[1]) }
  m = text.match(/(?:over|above|at least|min(?:imum)?|more than|starting at|from)\s*\$?\s*(\d{1,4})/)
  if (m) return { min: Number(m[1]), max: null }
  const nums = text.match(/\d{1,4}/)
  if (nums) return { min: null, max: Number(nums[0]) } // lone number → ceiling
  return { min: null, max: null }
}

function extractLocation(answer: string): Partial<ExtractedSignals> {
  const text = normalize(answer)
  for (const [name, lat, lon] of KNOWN_PLACES) {
    if (text.includes(name)) {
      return {
        location_label: answer.trim(),
        location_mode: 'named',
        location_lat: lat,
        location_lon: lon,
      }
    }
  }
  return {}
}

// --- Reconcile + missing + reply --------------------------------------------

function emptySignals(): ExtractedSignals {
  return {
    dietary_restrictions: [],
    preferred_cuisines: [],
    disliked_cuisines: [],
    budget_min: null,
    budget_max: null,
    occasion: null,
    location_mode: null,
    location_label: null,
    location_lat: null,
    location_lon: null,
    radius_miles: null,
  }
}

const uniq = (xs: string[]) => Array.from(new Set(xs))

// True once a given ask-order signal has any captured value.
function isPresent(sig: ExtractedSignals, name: string): boolean {
  switch (name) {
    case 'dietary_restrictions':
      return sig.dietary_restrictions.length > 0
    case 'preferred_cuisines':
      return sig.preferred_cuisines.length > 0
    case 'disliked_cuisines':
      return sig.disliked_cuisines.length > 0
    case 'budget':
      return sig.budget_min != null || sig.budget_max != null
    case 'location':
      return sig.location_mode != null
    default:
      return false
  }
}

// Still-missing signals AFTER a turn that just addressed question `questionIndex`.
// The conversation is strictly one-question-per-turn (like
// interactive_session.py), so every question at or before `questionIndex` is
// considered ANSWERED — even a skip ("no restrictions") — and only later
// questions not yet captured remain. This is what makes a skip stick instead of
// the agent re-asking it forever. occasion/time are never in the ask-order.
function missingAfter(sig: ExtractedSignals, questionIndex: number): string[] {
  return AGENT_ASK_ORDER.filter((name, i) => i > questionIndex && !isPresent(sig, name))
}

const prettify = (tags: string[], limit = 4): string => {
  const pretty = tags.map((t) => t.replace(/_/g, ' '))
  if (pretty.length <= limit) return pretty.join(', ')
  return `${pretty.slice(0, limit).join(', ')}, +${pretty.length - limit} more`
}

const NEXT_QUESTION: Record<string, string> = {
  dietary_restrictions: 'Any dietary needs I should lock in for the group?',
  preferred_cuisines: 'What sounds good today — a cuisine, a vibe, or a kind of spot?',
  disliked_cuisines: "Anything you'd rather the group avoided?",
  budget: 'What is your comfortable price range per person?',
  location: "The host set the meeting spot — anywhere more convenient for you, or is that good?",
}

// Confirm what THIS turn captured, then ask the next missing question. Mirrors
// conversation_agent._fallback_reply's confirm-then-ask shape.
function buildReply(captured: string[], missing: string[]): string {
  const confirm = captured.length ? `Got it — ${captured.join('; ')}.` : 'Got that.'
  if (missing.length) return `${confirm} ${NEXT_QUESTION[missing[0]] ?? 'What else matters to you?'}`
  return `${confirm} That's everything I need — thanks!`
}

// Run one offline analyze turn: extract from the answer (scoped to the question
// the agent just asked), reconcile over prior, recompute what's still missing,
// and phrase a confirm-then-ask reply.
//
// The conversation is strictly positional (one question per turn, like
// interactive_session.py): the question in flight = the number of prior USER
// turns in conversation_history, indexing into AGENT_ASK_ORDER. That's more
// robust than "first missing signal" — a skipped answer ("no restrictions")
// legitimately leaves a field empty, and a positional index lets the flow move
// on instead of re-asking it. A stray extraction still lands in the right list
// because we scope extraction to the current question.
export function mockAnalyzeTurn(
  sessionId: number,
  body: AnalyzeTurnBody,
): AnalyzeResponse {
  const prior: ExtractedSignals = { ...emptySignals(), ...(body.current_signals ?? {}) }
  const next: ExtractedSignals = { ...prior }
  const answer = body.message ?? ''

  const priorUserTurns = (body.conversation_history ?? []).filter(
    (t) => t.role === 'user',
  ).length
  const qIndex = Math.min(priorUserTurns, AGENT_ASK_ORDER.length - 1)
  const question = AGENT_ASK_ORDER[qIndex]
  const captured: string[] = []
  const skipped = isSkip(answer)

  // Extract scoped to the current question so an ambiguous answer lands in the
  // right list (a dislike answer → disliked_cuisines, not preferred). A skip
  // captures nothing but still advances the flow past this question.
  if (!skipped) {
    switch (question) {
      case 'dietary_restrictions': {
        const diet = extractDietary(answer)
        if (diet.length) {
          next.dietary_restrictions = uniq([...prior.dietary_restrictions, ...diet])
          captured.push(`dietary: ${prettify(diet)}`)
        }
        break
      }
      case 'preferred_cuisines': {
        const cuisines = extractCuisines(answer)
        if (cuisines.length) {
          next.preferred_cuisines = uniq([...prior.preferred_cuisines, ...cuisines])
          captured.push(`you're into ${prettify(cuisines)}`)
        }
        break
      }
      case 'disliked_cuisines': {
        const cuisines = extractCuisines(answer)
        if (cuisines.length) {
          next.disliked_cuisines = uniq([...prior.disliked_cuisines, ...cuisines])
          captured.push(`avoiding ${prettify(cuisines)}`)
        }
        break
      }
      case 'budget': {
        const budget = extractBudget(answer)
        if (budget.min != null) next.budget_min = budget.min
        if (budget.max != null) next.budget_max = budget.max
        if (budget.min != null || budget.max != null) {
          captured.push(
            budget.min != null && budget.max != null
              ? `budget $${budget.min}–${budget.max}`
              : budget.max != null
                ? `budget up to $${budget.max}`
                : `budget from $${budget.min}`,
          )
        }
        break
      }
      case 'location': {
        const loc = extractLocation(answer)
        if (loc.location_label) {
          Object.assign(next, loc)
          captured.push(`your spot: ${loc.location_label}`)
        }
        break
      }
    }
  }

  // Everything at or before this question is now addressed (answered or skipped);
  // only later still-empty signals remain missing.
  const missing = missingAfter(next, qIndex)
  const reply = buildReply(captured, missing)

  return {
    // The mock has no auth context; the live path injects the real id server-side.
    user_id: 1,
    session_id: sessionId,
    extracted_signals: next,
    profile_updated: false,
    qa_updated: true,
    agent_reply: reply,
    missing_signals: missing,
  }
}
