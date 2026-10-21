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
