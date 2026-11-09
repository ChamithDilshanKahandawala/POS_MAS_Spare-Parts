import {
  LayoutDashboard, Store, FileText, ClipboardCheck, Package, ShoppingCart,
  RotateCcw, Wallet, Users, FileStack, UserCog, ScrollText, Settings, Mail,
} from 'lucide-react';

// Sidebar order. `ownerOnly` hides an item entirely for platform_staff
// (not just a 403), so nobody sees a link they couldn't use.
export const NAV_ITEMS = [
  { key: 'overview', path: '/admin', icon: LayoutDashboard },
  { key: 'sellers', path: '/admin/sellers', icon: Store },
  { key: 'applications', path: '/admin/applications', icon: FileText },
  { key: 'listingReview', path: '/admin/listing-review', icon: ClipboardCheck },
  { key: 'catalog', path: '/admin/catalog', icon: Package },
  { key: 'orders', path: '/admin/orders', icon: ShoppingCart },
  { key: 'returnsDisputes', path: '/admin/returns-disputes', icon: RotateCcw },
  { key: 'finance', path: '/admin/finance', icon: Wallet },
  { key: 'customers', path: '/admin/customers', icon: Users },
  { key: 'content', path: '/admin/content', icon: FileStack },
  { key: 'platformStaff', path: '/admin/platform-staff', icon: UserCog, ownerOnly: true },
  { key: 'auditLog', path: '/admin/audit-log', icon: ScrollText },
  { key: 'messages', path: '/admin/messages', icon: Mail },
  { key: 'settings', path: '/admin/settings', icon: Settings },
];
