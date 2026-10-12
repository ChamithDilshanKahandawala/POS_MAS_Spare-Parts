import { Loader2 } from 'lucide-react';

// Suspense fallback for lazy routes. `fallback={null}` collapses the whole
// content area to zero height while the chunk downloads, then everything
// (including the footer below it) jumps into place once it mounts — a
// large, measured layout shift (CLS 0.511 on the product page, the worst
// offender). The min-height here is sized to the taller pages (product
// detail, category) specifically so *their* loading window doesn't still
// leave a gap once real content lands; it only applies while a lazy chunk
// is actually loading, not to every route's <main> permanently (an earlier
// version put this min-height on <main> itself — fully fixed CLS but cost
// every route, including the always-eager home page, several Lighthouse
// Performance points on Speed Index for reserving space nothing was going
// to fill during that page's own load).
export default function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh', padding: '60px 0' }}>
      <Loader2 size={28} className="spin" color="var(--accent-primary)" />
    </div>
  );
}
