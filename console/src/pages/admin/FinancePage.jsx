import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp, AlertTriangle, Banknote, RefreshCcw, Upload, Plus, ShieldCheck,
} from 'lucide-react';
import {
  getFinanceOverview, getFinanceSellerBalances, getFinanceCodNotReceived,
  listRemittances, getRemittanceMapping, saveRemittanceMapping, uploadRemittanceFile,
  getPayoutRuns, createPayoutRun, updateSellerSettlementMode, createFinanceAdjustment,
} from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDate } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';
import AdminStepUpModal from '../../components/AdminStepUpModal';

const TABS = ['overview', 'sellers', 'remittances', 'payoutRuns'];
const MATCH_BADGE = { matched: 'badge-green', short: 'badge-yellow', over: 'badge-yellow', unknown_tracking: 'badge-red', duplicate: 'badge-blue' };

function StatCard({ icon: Icon, color, label, value }) {
  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      {Icon && <Icon size={20} color={color} />}
      <div>
        <div style={{ fontSize: '18px', fontWeight: 800 }}>{value}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export default function FinancePage() {
  const { t } = useTranslation(['admin', 'common']);
  const [tab, setTab] = useState('overview');

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('finance.title')}</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 700,
              color: tab === tb ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: tab === tb ? '2px solid var(--accent-primary)' : '2px solid transparent',
            }}
          >
            {t(`finance.tabs.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'sellers' && <SellersTab />}
      {tab === 'remittances' && <RemittancesTab />}
      {tab === 'payoutRuns' && <PayoutRunsTab />}
    </div>
  );
}

function OverviewTab() {
  const { t } = useTranslation(['admin', 'common']);
  const [data, setData] = useState(null);

   
  useEffect(() => { getFinanceOverview().then(({ data: d }) => setData(d)).catch(() => toast.error(t('common:error.generic'))); }, [t]);

  if (!data) return <div>{t('common:loading')}</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard icon={TrendingUp} color="#10b981" label={t('finance.overview.commissionWeek')} value={formatLKR(data.commissionEarnedWeekCents)} />
        <StatCard icon={TrendingUp} color="#10b981" label={t('finance.overview.commissionMonth')} value={formatLKR(data.commissionEarnedMonthCents)} />
        <StatCard icon={AlertTriangle} color="#f59e0b" label={t('finance.overview.codOutstanding')} value={data.codOutstandingCount} />
        <StatCard icon={Banknote} color="var(--accent-primary)" label={t('finance.overview.payoutsDue')} value={data.payoutsDueCount} />
        <Link to="/admin/orders?refundNeeded=true" style={{ textDecoration: 'none', color: 'inherit' }}>
          <StatCard icon={AlertTriangle} color="#ef4444" label={t('finance.overview.refundsNeeded')} value={data.refundsNeeded} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('finance.overview.byCategoryHeading')}</h3>
          {data.commissionByCategory.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('finance.overview.noData')}</div>
          ) : data.commissionByCategory.map((c) => (
            <Row key={c.categoryId || 'none'} label={c.categoryName?.en || t('finance.overview.uncategorized')} value={formatLKR(c.commissionCents)} />
          ))}
        </div>
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('finance.overview.bySellerHeading')}</h3>
          {data.commissionBySeller.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('finance.overview.noData')}</div>
          ) : data.commissionBySeller.map((s) => (
            <Row key={s.sellerId} label={s.sellerName} value={formatLKR(s.commissionCents)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SellersTab() {
  const { t } = useTranslation(['admin', 'common']);
  const [sellers, setSellers] = useState(null);
  const [adjustmentFor, setAdjustmentFor] = useState(null); // sellerId
  const [adjustmentForm, setAdjustmentForm] = useState({ amountCents: '', reason: '' });
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const load = useCallback(() => { getFinanceSellerBalances().then(({ data }) => setSellers(data.sellers)).catch(() => toast.error(t('common:error.generic'))); }, [t]);
   
  useEffect(() => { load(); }, [load]);

  const toggleSettlement = async (sellerId, current) => {
    const next = current === 'internal' ? 'payout' : 'internal';
    if (!window.confirm(t('finance.sellers.confirmSettlementChange', { mode: t(`finance.sellers.settlementMode.${next}`) }))) return;
    try {
      await updateSellerSettlementMode(sellerId, next);
      toast.success(t('finance.sellers.settlementChanged'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const submitAdjustment = async () => {
    const cents = Math.round(Number(adjustmentForm.amountCents) * 100);
    if (!cents || !adjustmentForm.reason.trim()) return;
    try {
      await createFinanceAdjustment(adjustmentFor, { amountCents: cents, reason: adjustmentForm.reason.trim() });
      toast.success(t('finance.sellers.adjustmentCreated'));
      setAdjustmentFor(null);
      setAdjustmentForm({ amountCents: '', reason: '' });
      load();
    } catch (err) {
      if (err.response?.status === 403) { setStepUpOpen(true); return; }
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  if (!sellers) return <div>{t('common:loading')}</div>;
  if (sellers.length === 0) return <EmptyState icon={Banknote} title={t('finance.sellers.noSellers')} />;

  return (
    <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('finance.sellers.table.seller')}</th>
            <th>{t('finance.sellers.table.onHold')}</th>
            <th>{t('finance.sellers.table.payable')}</th>
            <th>{t('finance.sellers.table.inPayout')}</th>
            <th>{t('finance.sellers.table.paid')}</th>
            <th>{t('finance.sellers.table.settlementMode')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((s) => (
            <tr key={s.sellerId}>
              <td><Link to={`/admin/sellers/${s.sellerId}`}>{s.sellerName}</Link></td>
              <td>{formatLKR(s.onHoldCents)}</td>
              <td>{formatLKR(s.payableCents)}</td>
              <td>{formatLKR(s.inPayoutCents)}</td>
              <td>{formatLKR(s.paidCents)}</td>
              <td><span className="badge badge-blue">{t(`finance.sellers.settlementMode.${s.settlementMode}`)}</span></td>
              <td style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setAdjustmentFor(s.sellerId)}>
                  <Plus size={12} /> {t('finance.sellers.addAdjustment')}
                </button>
                <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => toggleSettlement(s.sellerId, s.settlementMode)}>
                  {t('finance.sellers.toggleSettlement')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adjustmentFor && (
        <div className="modal-overlay" onClick={() => setAdjustmentFor(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('finance.sellers.addAdjustment')}</h3>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('finance.sellers.adjustmentAmount')}</label>
            <input
              type="number" className="input-field" style={{ width: '100%', marginTop: '6px', marginBottom: '10px' }}
              placeholder="e.g. -500 or 1000"
              value={adjustmentForm.amountCents}
              onChange={(e) => setAdjustmentForm((f) => ({ ...f, amountCents: e.target.value }))}
            />
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('finance.sellers.adjustmentReason')}</label>
            <textarea
              className="input-field" style={{ width: '100%', minHeight: '70px', marginTop: '6px' }}
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm((f) => ({ ...f, reason: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setAdjustmentFor(null)}>{t('common:cancel')}</button>
              <button className="btn-primary" disabled={!adjustmentForm.amountCents || !adjustmentForm.reason.trim()} onClick={submitAdjustment}>
                <ShieldCheck size={14} /> {t('finance.sellers.saveAdjustment')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminStepUpModal open={stepUpOpen} onClose={() => setStepUpOpen(false)} onConfirmed={() => { setStepUpOpen(false); submitAdjustment(); }} />
    </div>
  );
}

function RemittancesTab() {
  const { t } = useTranslation(['admin', 'common']);
  const [rows, setRows] = useState(null);
  const [codNotReceived, setCodNotReceived] = useState(null);
  const [courier, setCourier] = useState('Transexpress');
  const [mapping, setMapping] = useState({ trackingNumberColumn: '', codAmountColumn: '', remittanceDateColumn: '', referenceColumn: '' });
  const [mappingSaved, setMappingSaved] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);

  const load = useCallback(() => {
    listRemittances({ limit: 50 }).then(({ data }) => setRows(data.rows)).catch(() => toast.error(t('common:error.generic')));
    getFinanceCodNotReceived().then(({ data }) => setCodNotReceived(data)).catch(() => {});
  }, [t]);
   
  useEffect(() => { load(); }, [load]);

  const loadMapping = useCallback(() => {
    getRemittanceMapping(courier).then(({ data }) => {
      if (data.mapping) { setMapping(data.mapping); setMappingSaved(true); } else { setMappingSaved(false); }
    }).catch(() => {});
  }, [courier]);
   
  useEffect(() => { loadMapping(); }, [loadMapping]);

  const saveMapping = async () => {
    try {
      await saveRemittanceMapping(courier, mapping);
      toast.success(t('finance.remittances.mappingSaved'));
      setMappingSaved(true);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadRemittanceFile(courier, file);
      setUploadSummary(data.summary);
      toast.success(t('finance.remittances.uploadDone'));
      setFile(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('finance.remittances.mappingHeading')}</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <input className="input-field" style={{ width: '160px' }} placeholder={t('finance.remittances.courierName')} value={courier} onChange={(e) => setCourier(e.target.value)} />
          <input className="input-field" style={{ width: '150px' }} placeholder={t('finance.remittances.trackingColumn')} value={mapping.trackingNumberColumn} onChange={(e) => setMapping((m) => ({ ...m, trackingNumberColumn: e.target.value }))} />
          <input className="input-field" style={{ width: '150px' }} placeholder={t('finance.remittances.amountColumn')} value={mapping.codAmountColumn} onChange={(e) => setMapping((m) => ({ ...m, codAmountColumn: e.target.value }))} />
          <input className="input-field" style={{ width: '150px' }} placeholder={t('finance.remittances.dateColumn')} value={mapping.remittanceDateColumn} onChange={(e) => setMapping((m) => ({ ...m, remittanceDateColumn: e.target.value }))} />
          <input className="input-field" style={{ width: '150px' }} placeholder={t('finance.remittances.referenceColumn')} value={mapping.referenceColumn} onChange={(e) => setMapping((m) => ({ ...m, referenceColumn: e.target.value }))} />
          <button className="btn-secondary" onClick={saveMapping}>{t('finance.remittances.saveMapping')}</button>
        </div>
        {mappingSaved && <div style={{ fontSize: '12px', color: '#10b981' }}>{t('finance.remittances.mappingExists')}</div>}
      </div>

      <div className="glass-card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('finance.remittances.uploadHeading')}</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn-primary" disabled={!file || uploading} onClick={upload}><Upload size={14} /> {t('finance.remittances.upload')}</button>
        </div>
        {uploadSummary && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
            <span className="badge badge-green">{t('finance.remittances.matchStatus.matched')}: {uploadSummary.matched}</span>
            <span className="badge badge-yellow">{t('finance.remittances.matchStatus.short')}: {uploadSummary.short}</span>
            <span className="badge badge-yellow">{t('finance.remittances.matchStatus.over')}: {uploadSummary.over}</span>
            <span className="badge badge-red">{t('finance.remittances.matchStatus.unknown_tracking')}: {uploadSummary.unknownTracking}</span>
            <span className="badge badge-blue">{t('finance.remittances.matchStatus.duplicate')}: {uploadSummary.duplicate}</span>
          </div>
        )}
      </div>

      {codNotReceived && codNotReceived.orders.length > 0 && (
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
            {t('finance.remittances.codNotReceivedHeading', { days: codNotReceived.afterDays })}
          </h3>
          {codNotReceived.orders.map((o) => (
            <Row key={o._id} label={`${o.orderNumber} — ${o.seller?.displayName || o.seller?.name}`} value={formatLKR(o.codAmountCents)} />
          ))}
        </div>
      )}

      <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('finance.remittances.rowsHeading')}</h3>
        {!rows || rows.length === 0 ? (
          <EmptyState icon={Upload} title={t('finance.remittances.noRows')} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('finance.remittances.table.tracking')}</th>
                <th>{t('finance.remittances.table.amount')}</th>
                <th>{t('finance.remittances.table.date')}</th>
                <th>{t('finance.remittances.table.status')}</th>
                <th>{t('finance.remittances.table.order')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.trackingNumber}</td>
                  <td>{formatLKR(r.codAmountCents)}</td>
                  <td style={{ fontSize: '12px' }}>{formatDate(r.remittanceDate)}</td>
                  <td><span className={`badge ${MATCH_BADGE[r.matchStatus]}`}>{t(`finance.remittances.matchStatus.${r.matchStatus}`)}</span></td>
                  <td style={{ fontSize: '12px' }}>{r.sellerOrder?.orderNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PayoutRunsTab() {
  const { t } = useTranslation(['admin', 'common']);
  const [runs, setRuns] = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => { getPayoutRuns().then(({ data }) => setRuns(data.runs)).catch(() => toast.error(t('common:error.generic'))); }, [t]);
   
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      await createPayoutRun();
      toast.success(t('finance.payoutRuns.generated'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setGenerating(false);
    }
  };

  if (!runs) return <div>{t('common:loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button className="btn-primary" disabled={generating} onClick={generate}>
          {generating ? <RefreshCcw size={14} /> : <Plus size={14} />} {t('finance.payoutRuns.generate')}
        </button>
      </div>
      {runs.length === 0 ? (
        <EmptyState icon={Banknote} title={t('finance.payoutRuns.noRuns')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('finance.payoutRuns.table.week')}</th>
                <th>{t('finance.payoutRuns.table.period')}</th>
                <th>{t('finance.payoutRuns.table.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 700 }}>{r.weekKey}</td>
                  <td style={{ fontSize: '12px' }}>{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</td>
                  <td><span className={`badge ${r.status === 'approved' ? 'badge-green' : 'badge-yellow'}`}>{t(`finance.payoutRuns.status.${r.status}`)}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/admin/finance/payout-runs/${r._id}`}>{t('finance.payoutRuns.review')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

