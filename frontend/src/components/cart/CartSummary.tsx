import { CartItemRow } from './CartItemRow'
import { useCartStore } from '@/stores/cartStore'

// Compact cart list + total. Reused in the drawer and the complete screen.
export function CartSummary() {
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const updateQty = useCartStore((s) => s.updateQty)

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">The group cart is empty.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="divide-y divide-border">
        {items.map((item) => (
          <CartItemRow
            key={item.menuItemId}
            item={item}
            onInc={() => updateQty(item.menuItemId, item.quantity + 1)}
            onDec={() => updateQty(item.menuItemId, item.quantity - 1)}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
        <span className="font-medium text-text">Total</span>
        <span className="font-display text-lg font-bold text-text">${total.toFixed(2)}</span>
      </div>
    </div>
  )
}
