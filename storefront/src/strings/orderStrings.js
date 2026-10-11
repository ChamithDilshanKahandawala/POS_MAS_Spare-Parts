// Every user-facing string for /order-success/:id, same pattern as
// cartStrings.js / productStrings.js / categoryStrings.js.
export const orderStrings = {
  headline: 'Thank you! Your order is placed',
  subheadline: "We've received your order and will get it ready for delivery.",
  invoice: {
    label: 'Order number',
    copy: 'Copy',
    copied: 'Copied!',
  },
  timeline: {
    placed: 'Placed',
    confirmed: 'Confirmed',
    dispatched: 'Dispatched',
    delivered: 'Delivered',
    cancelled: 'This order was cancelled',
    returned: 'This order was returned',
  },
  delivery: {
    title: 'Delivery details',
    estimate: (range) => `Estimated delivery: ${range} (estimate only)`,
  },
  items: {
    title: 'Order summary',
    subtotal: 'Subtotal',
    deliveryFee: 'Delivery fee',
    total: 'Total',
  },
  payment: {
    cod: (amount) => `Cash on Delivery — please keep ${amount} ready`,
  },
  whatsapp: {
    cta: 'Confirm on WhatsApp',
    message: (invoiceNumber, total) => `Hi! I'd like to confirm my order ${invoiceNumber}, total ${total}. Thank you!`,
  },
  actions: {
    continueShopping: 'Continue shopping',
    viewOrders: 'View my orders',
    backToShop: 'Back to shop',
    tryAgain: 'Try again',
  },
  notFound: {
    title: 'Order not found',
    subtitle: "We couldn't find this order, or it doesn't belong to this account.",
  },
  error: {
    title: 'Something went wrong',
    subtitle: "We couldn't load this order. Check your connection and try again.",
  },
};
