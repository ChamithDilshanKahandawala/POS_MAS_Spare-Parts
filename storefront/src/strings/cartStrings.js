// Every user-facing string for the cart drawer + /cart page lives here, so
// Sinhala/Tamil translations can be swapped in later without touching JSX.
export const cartStrings = {
  addedToast: {
    message: (name) => `${name} added to cart`,
    viewCart: 'View cart',
  },
  drawer: {
    title: 'Your cart',
    viewFullCart: 'View full cart',
    checkout: 'Checkout',
    deliveryNote: 'Delivery calculated at checkout',
  },
  empty: {
    title: 'Your cart is empty',
    subtitle: 'Browse our catalog to add items',
    cta: 'Start shopping',
  },
  item: {
    remove: 'Remove',
    lowStock: (n) => `Only ${n} left`,
    outOfStock: 'Out of stock — remove to continue',
  },
  removedToast: {
    message: (name) => `Removed ${name}`,
    undo: 'Undo',
  },
  page: {
    title: 'Your Cart',
    itemCount: (n) => `${n} item${n === 1 ? '' : 's'}`,
  },
  summary: {
    subtotal: 'Subtotal',
    delivery: 'Delivery',
    deliveryCalculated: 'Calculated at checkout',
    total: 'Total',
    freeDeliveryUnlocked: "You've unlocked free delivery 🎉",
    freeDeliveryProgress: (remaining) => `Add ${remaining} more for free delivery`,
    proceedToCheckout: 'Proceed to checkout',
    continueShopping: 'Continue shopping',
    blockedByStock: 'Remove out-of-stock items to continue',
  },
  trust: {
    cod: 'Cash on Delivery available',
    delivery: 'Island-wide delivery',
    returns: 'Easy returns',
  },
};
