import {
  Home, Package, ShoppingCart, RotateCcw, Wallet, TrendingUp,
  Store, Users, ScrollText, Bell, Tags,
} from 'lucide-react';

// Desktop sidebar order. The first four (plus 'more') are also the
// mobile bottom nav's primary items — see SellerBottomNav.jsx, which
// reads this same list rather than keeping a second copy.
export const SELLER_NAV_ITEMS = [
  { key: 'home', path: '/seller', icon: Home, primary: true },
  { key: 'products', path: '/seller/products', icon: Package, primary: true },
  { key: 'orders', path: '/seller/orders', icon: ShoppingCart, comingSoonMilestone: 6, primary: true },
  { key: 'returns', path: '/seller/returns', icon: RotateCcw, comingSoonMilestone: 8 },
  { key: 'finance', path: '/seller/finance', icon: Wallet, comingSoonMilestone: 7, primary: true },
  { key: 'performance', path: '/seller/performance', icon: TrendingUp, comingSoonMilestone: 10 },
  { key: 'categoriesFees', path: '/seller/categories', icon: Tags },
  { key: 'settings', path: '/seller/settings', icon: Store },
  { key: 'staff', path: '/seller/staff', icon: Users, ownerOnly: true },
  { key: 'activity', path: '/seller/activity', icon: ScrollText },
  { key: 'notifications', path: '/seller/notifications', icon: Bell },
];
