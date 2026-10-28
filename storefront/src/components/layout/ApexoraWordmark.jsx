// No real Apexora logo exists yet — this is the whole of the brand mark
// until one does: plain text, themed via CSS custom properties (so it
// reads correctly in light/dark with zero extra work), two-tone to hint at
// a wordmark rather than reading as a plain label. `size` scales the font
// directly; everything else (letter-spacing, weight) stays proportional.
// Swapping in a real logo later means replacing this one component (and
// the PWA icon files — see design-tokens/previews' PWA icon regeneration
// in the design-refresh task's report), nothing that renders it needs to
// change.
//
// Design refresh — set in the heading serif (Playfair Display) rather
// than the body sans, at a lighter weight (700, not 900) with slightly
// OPEN letter-spacing instead of tight: a display serif at heavy weight
// with negative tracking reads cramped/clumsy, where the same face set
// a touch looser reads like an actual wordmark. Never applies to si/ta —
// this is a Latin-only brand mark either way (the name itself, "Apexora",
// isn't translated anywhere else in the app either).
export default function ApexoraWordmark({ size = 20, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', fontFamily: "'Playfair Display', serif",
      fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1, ...style,
    }}>
      <span style={{ fontSize: size, color: 'var(--text-primary)' }}>Apex</span>
      <span style={{ fontSize: size, color: 'var(--accent-primary-text)' }}>ora</span>
    </span>
  );
}
