// No real Apexora logo exists yet — this is the whole of the brand mark
// until one does: plain text, themed via CSS custom properties (so it
// reads correctly in light/dark with zero extra work), two-tone to hint at
// a wordmark rather than reading as a plain label. `size` scales the font
// directly; everything else (letter-spacing, weight) stays proportional.
// Swapping in a real logo later means replacing this one component (and
// the PWA icon files — see generate-apexora-icons in the PWA/rebrand
// task's report), nothing that renders it needs to change.
export default function ApexoraWordmark({ size = 20, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1, ...style }}>
      <span style={{ fontSize: size, color: 'var(--text-primary)' }}>Apex</span>
      <span style={{ fontSize: size, color: 'var(--accent-primary)' }}>ora</span>
    </span>
  );
}
