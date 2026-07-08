// FRONTEND-ONLY: there is NO MenuItem table in the Prisma schema yet (only an
// empty stub at backend/ai_service/app/models/menu_item.py). This display type
// lets the menu screen render from mock data today. Do NOT assume a gateway
// endpoint exists; revisit when the real table lands.
export interface MenuItem {
  id: number
  restaurant_id: number
  name: string
  description?: string
  price: number
  dietary_tags: string[]
  image_url?: string
}

// A line in the shared group cart (client-side for now; realtime later).
export interface CartItem {
  menuItemId: number
  restaurantId: number
  name: string
  price: number
  quantity: number
  addedByUserId: number
}
