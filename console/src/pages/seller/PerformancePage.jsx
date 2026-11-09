import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSellerPerformance } from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import DailyBarChart from '../../components/charts/DailyBarChart';

const RANGES = [7, 30, 90];

// KPIs from pre-aggregated daily rows (services/sellerStats.js). A rate with
// no denominator (no orders, nothing shipped) shows "—", never 0%.
export default function PerformancePage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getSellerPerformance(days)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [days, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const pct = (r) => (r === null || r === undefined ? '—' : `${(r * 100).toFixed(r < 0.1 && r > 0 ? 1 : 0)}%`);
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const formatDay = (key) => dayFmt.format(new Date(`${key}T00:00:00Z`));
  const compactLKR = (cents, axis) => {
    if (!axis) return formatLKR(cents);
    const rupees = cents / 100;
    return rupees >= 1000 ? `${Math.round(rupees / 1000)}k` : String(Math.round(rupees));
  };

  const delta = (now, before, lowerIsBetter = false) => {
    if (now === null || before === null || before === undefined || before === 0) return null;
    const change = (now - before) / before;
    if (!Number.isFinite(change) || Math.abs(change) < 0.005) return { text: t('performance.noChange'), tone: 'muted' };
    const better = lowerIsBetter ? change < 0 : change > 0;
    return { text: `${change > 0 ? '▲' : '▼'} ${Math.abs(change * 100).toFixed(0)}%`, tone: better ? 'good' : 'bad' };
  };

  const tiles = data && [
    { key: 'sales', value: formatLKR(data.totals.salesCents), d: delta(data.totals.salesCents, data.previous.salesCents) },
    { key: 'orders', value: data.totals.orders, d: delta(data.totals.orders, data.previous.orders) },
    { key: 'aov', value: data.totals.averageOrderCents === null ? '—' : formatLKR(data.totals.averageOrderCents), d: delta(data.totals.averageOrderCents, data.previous.averageOrderCents) },
    { key: 'cancellationRate', value: pct(data.totals.cancellationRate), d: delta(data.totals.cancellationRate, data.previous.cancellationRate, true), hint: t('performance.hints.cancellationRate', { count: data.totals.cancelled }) },
    { key: 'returnRate', value: pct(data.totals.returnRate), d: delta(data.totals.returnRate, data.previous.returnRate, true), hint: t('performance.hints.returnRate', { returns: data.totals.returnRequests, delivered: data.totals.delivered }) },
    { key: 'onTime', value: pct(data.totals.onTimeDispatchRate), d: delta(data.totals.onTimeDispatchRate, data.previous.onTimeDispatchRate), hint: t('performance.hints.onTime', { onTime: data.totals.shippedOnTime, shipped: data.totals.shipped }) },
  ];

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>{t('nav.performance')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('performance.subtitle')}</p>
        </div>
        <div role="group" aria-label={t('performance.range')} style={{ display: 'flex', gap: '6px' }}>
          {RANGES.map((r) => (
            <button key={r} className={r === days ? 'btn-primary' : 'btn-secondary'} style={{ padding: '6px 12px', fontSize: '12.5px' }} aria-pressed={r === days} onClick={() => setDays(r)}>
              {t('performance.days', { count: r })}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? <div>{t('common:loading')}</div> : data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: loading ? 0.6 : 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px' }}>
            {tiles.map((tile) => (
              <div key={tile.key} className="glass-card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>{t(`performance.kpi.${tile.key}`)}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>{tile.value}</div>
                <div style={{ fontSize: '11.5px', marginTop: '4px', color: 'var(--text-muted)' }}>
                  {tile.d ? (
                    <span style={{ fontWeight: 700, color: tile.d.tone === 'good' ? 'var(--accent-green)' : tile.d.tone === 'bad' ? 'var(--badge-red-text)' : 'var(--text-muted)' }}>
                      {tile.d.text} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('performance.vsPrevious')}</span>
                    </span>
                  ) : t('performance.noComparison')}
                </div>
                {tile.hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{tile.hint}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px', minWidth: 0 }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('performance.charts.sales')}</h2>
              <DailyBarChart data={data.series} valueKey="salesCents" minMax={200000} formatValue={compactLKR} formatDay={formatDay} label={t('performance.charts.sales')} />
            </div>
            <div className="glass-card" style={{ padding: '20px', minWidth: 0 }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('performance.charts.orders')}</h2>
              <DailyBarChart data={data.series} valueKey="orders" minMax={2} formatValue={(v) => String(Math.round(v))} formatDay={formatDay} label={t('performance.charts.orders')} />
            </div>
          </div>

          <div>
            <button className="btn-secondary" style={{ fontSize: '12px' }} aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
              {showTable ? t('performance.hideTable') : t('performance.showTable')}
            </button>
            {showTable && (
              <div className="glass-card" style={{ padding: '20px', marginTop: '10px', overflowX: 'auto', maxHeight: '360px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>{t('performance.table.day')}</th><th>{t('performance.kpi.orders')}</th><th>{t('performance.table.cancelled')}</th><th>{t('performance.kpi.sales')}</th></tr></thead>
                  <tbody>
                    {[...data.series].reverse().map((d) => (
                      <tr key={d.day}><td>{formatDay(d.day)}</td><td>{d.orders}</td><td>{d.cancelled}</td><td>{formatLKR(d.salesCents)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('performance.topListings')}</h2>
            {data.topListings.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('performance.noSales')}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t('performance.table.listing')}</th><th>{t('performance.table.qty')}</th><th>{t('performance.kpi.sales')}</th></tr></thead>
                <tbody>
                  {data.topListings.map((l) => (
                    <tr key={l.listing}><td style={{ fontWeight: 600, fontSize: '13px' }}>{l.title || '—'}</td><td>{l.qty}</td><td style={{ fontWeight: 700 }}>{formatLKR(l.salesCents)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '12px' }}>{t('performance.viewsNote')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
