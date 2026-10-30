import {
  LayoutDashboard, Store, FileText, ClipboardCheck, Package, ShoppingCart,
  RotateCcw, Wallet, Users, FileStack, UserCog, ScrollText, Settings,
} from 'lucide-react';

// Sidebar order, exactly as specified — pages depending on a later
// milestone still get a real route (so the link isn't dead), just one
// that renders a ComingSoonPage instead of real data. `ownerOnly` hides
// the item entirely for platform_staff (not just a 403 — the brief's own
// steer against dead links applies the same way to links the viewer
// couldn't use anyway).
export const NAV_ITEMS = [
  { key: 'overview', path: '/admin', icon: LayoutDashboard },
  { key: 'sellers', path: '/admin/sellers', icon: Store },
  { key: 'applications', path: '/admin/applications', icon: FileText },
  { key: 'listingReview', path: '/admin/listing-review', icon: ClipboardCheck },
  { key: 'catalog', path: '/admin/catalog', icon: Package },
  { key: 'orders', path: '/admin/orders', icon: ShoppingCart },
  { key: 'returnsDisputes', path: '/admin/returns-disputes', icon: RotateCcw },
  { key: 'finance', path: '/admin/finance', icon: Wallet },
  { key: 'customers', path: '/admin/customers', icon: Users, comingSoonMilestone: 10 },
  { key: 'content', path: '/admin/content', icon: FileStack, comingSoonMilestone: 10 },
  { key: 'platformStaff', path: '/admin/platform-staff', icon: UserCog, ownerOnly: true },
  { key: 'auditLog', path: '/admin/audit-log', icon: ScrollText },
  { key: 'settings', path: '/admin/settings', icon: Settings },
];
