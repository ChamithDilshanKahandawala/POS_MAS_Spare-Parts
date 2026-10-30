const mongoose = require('mongoose');

// Per-user notifications (bell icon, notifications list). A user only
// ever sees their own — every route in controllers/notificationsController.js
// scopes by `user: req.user._id`, never by id alone, the same reasoning
// as requireSellerMember never trusting a client-supplied seller id.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'application.approved',
        'seller.suspended',
        'seller.reactivated',
        'bank.verified',
        'bank.rejected',
        'bank.resubmitted',
        'staff.invite_accepted',
        'listing.published',
        'listing.rejected',
        'listing.revision_approved',
        'listing.revision_rejected',
        'listing.suspended',
        'listing.reinstated',
        'listing.needs_update',
        'pos.sync_failing',
        'pos.product_removed',
        // --- Milestone 6 (Part G) ---
        'order.new', // seller: a new order just landed
        'order.autocancel_warning', // seller: this order auto-cancels in ~12h if not confirmed
        'order.confirmed', // customer
        'order.shipped', // customer
        'order.delivered', // customer
        'order.cancelled', // customer (and seller, for an admin-initiated cancel)
        'order.returned', // customer — a failed/refused delivery was marked returned to the seller
        'pos.order_not_recorded', // seller — a shipped/delivered order isn't marked "Recorded in POS" 24h+ later
        // --- Milestone 7 ---
        'payout.paid', // seller owner — a payout was sent
        'payout.failed', // seller owner — a payout attempt failed
        // --- Milestone 8 ---
        'return.requested', // seller owner — a customer requested a return
        'return.accepted', // customer — the seller accepted the return
        'return.rejected', // customer — the seller rejected it; it goes to platform review
        'return.escalated', // customer + seller owner — no seller response in time, platform will decide
        'return.decided', // customer + seller owner — platform decided (refund or dismissed)
        'return.refunded', // customer + seller owner — the refund was paid
      ],
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: null }, // console-relative path, e.g. "/seller/settings"
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Serves the plain notification list (filter by user, sorted newest
// first — listNotifications's main query).
notificationSchema.index({ user: 1, createdAt: -1 });
// Serves the unread-count query (listNotifications's second
// countDocuments call: {user, read:false}) and would also serve an
// unread-only list view if one gets added later.
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
