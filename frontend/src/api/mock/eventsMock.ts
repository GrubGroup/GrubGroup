// Mock events for the Events page (upcoming + past). restaurantId references
// real seed restaurants where possible.
export interface EventLite {
  id: number
  restaurantId: number
  restaurantName: string
  emoji: string
  group: string
  date: string
  time?: string
  confirmed?: string // "3/4"
  rating?: number // past events
}

export const UPCOMING_EVENTS: EventLite[] = [
  { id: 1, restaurantId: 19, restaurantName: "Tony's Pizzeria", emoji: '🍕', group: 'Friday Friends', date: 'Fri, Jul 4', time: '7:30 PM', confirmed: '3/4' },
  { id: 2, restaurantId: 46, restaurantName: 'Atelier Crenn', emoji: '🍽️', group: 'Date Night', date: 'Sat, Jul 5', time: '8:00 PM', confirmed: '2/2' },
  { id: 3, restaurantId: 1, restaurantName: 'The Farmhouse Table', emoji: '🥗', group: 'Work Lunch Crew', date: 'Mon, Jul 7', time: '12:30 PM', confirmed: '4/4' },
]

export const PAST_EVENTS: EventLite[] = [
  { id: 4, restaurantId: 1, restaurantName: 'The Farmhouse Table', emoji: '🥗', group: 'Work Lunch Crew', date: 'Wed, May 23', rating: 5 },
  { id: 5, restaurantId: 19, restaurantName: "Tony's Pizzeria", emoji: '🍕', group: 'Friday Friends', date: 'Fri, May 16', rating: 4 },
  { id: 6, restaurantId: 0, restaurantName: 'Blue Bottle Coffee', emoji: '☕', group: 'Dev + Maya', date: 'Mon, May 12', rating: 5 },
]

// The event shown in the detail panel.
export const FEATURED_EVENT = {
  ...UPCOMING_EVENTS[0],
  dietary: ['nut-free', 'gluten-free'],
  why: "Tony's Pizzeria scored highest because it's nut-free certified, walking distance from everyone's location, and came in well under the $15pp budget the group agreed on. The large shared table accommodates the group size without a reservation.",
  attendees: [
    { userId: 1, status: 'Confirmed' },
    { userId: 6, status: 'Confirmed' },
    { userId: 3, status: 'Confirmed' },
    { userId: 4, status: 'Pending' },
  ],
}
