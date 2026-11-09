import { useEffect, useRef, useState } from 'react';

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 26, left: 48 };
const GAP = 2;

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

// One series of daily bars (orders or sales). Single series, so no legend —
// the card title names it. Bars use --accent-strong, which clears 3:1 on the
// card surface in light and dark. Hover/focus shows the exact value. Drawn
// at the container's real width so axis text stays readable on phones.
// `minMax` keeps an empty or tiny series from producing repeated tick labels.
export default function DailyBarChart({ data, valueKey, formatValue, formatDay, label, minMax = 1 }) {
  const [active, setActive] = useState(null);
  const [width, setWidth] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!width) return <div ref={wrapRef} style={{ width: '100%', minWidth: 0, height: HEIGHT }} />;

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...data.map((d) => d[valueKey]), minMax));
  const slot = plotW / data.length;
  const barW = Math.max(1, slot - GAP);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelIdx = new Set(width < 420 ? [0, data.length - 1] : [0, Math.floor((data.length - 1) / 2), data.length - 1]);
  const current = active !== null ? data[active] : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setActive(null)}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} stroke="var(--border-light)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(tk)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--text-muted)">{formatValue(tk, true)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d[valueKey];
          const x = PAD.left + i * slot + GAP / 2;
          const h = Math.max(v > 0 ? 2 : 0, (v / max) * plotH);
          const r = Math.min(4, barW / 2, h);
          const top = PAD.top + plotH - h;
          return (
            <g key={d.day}>
              {h > 0 && (
                <path
                  d={`M${x},${PAD.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + plotH} Z`}
                  fill="var(--accent-strong)"
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              <rect
                x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent"
                tabIndex={0} aria-label={`${formatDay(d.day)}: ${formatValue(v)}`}
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              />
              {labelIdx.has(i) && (
                <text x={PAD.left + i * slot + slot / 2} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--text-muted)">
                  {formatDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--text-muted)" strokeWidth="1" />
      </svg>
      {current && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 0, pointerEvents: 'none',
            left: `${((PAD.left + active * slot + slot / 2) / width) * 100}%`,
            transform: `translateX(${active > data.length / 2 ? '-100%' : '0'})`,
            background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px',
            padding: '6px 10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', whiteSpace: 'nowrap',
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>{formatDay(current.day)}</div>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatValue(current[valueKey])}</div>
        </div>
      )}
    </div>
  );
}
