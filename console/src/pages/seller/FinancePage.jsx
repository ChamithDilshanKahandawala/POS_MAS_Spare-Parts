import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Wallet, Clock, Banknote, CheckCircle2, Download } from 'lucide-react';
import {
  getMyFinanceBalances, getMyFinanceLedger, getMyFinanceStatements, getMyFinanceStatementCsvBlob, getMyFinancePayouts,
} from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDate, formatDateTime } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';

const TABS = ['ledger', 'statements', 'payouts'];
const STATUS_BADGE = {
  on_hold: 'badge-yellow', payable: 'badge-blue', in_payout: 'badge-blue', paid: 'badge-green',
  blocked: 'badge-red', settled_internally: 'badge-blue', failed: 'badge-red',
};

function BalanceCard({ icon: Icon, color, label, value }) {
  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      {Icon && <Icon size={20} color={color} />}
      <div>
        <div style={{ fontSize: '17px', fontWeight: 800 }}>{formatLKR(value)}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

// Milestone 7 Part D — Seller Center's own read-only money view.
// Owner-only end to end (the backend 403s staff on every route here;
// this page is only ever reached through /seller/finance, gated the
// same way /seller/staff is).
export default function FinancePage() {
  const { t } = useTranslation(['seller', 'common']);
  const [balances, setBalances] = useState(null);
  const [tab, setTab] = useState('ledger');
  const [ledger, setLedger] = useState(null);
  const [statements, setStatements] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getMyFinanceBalances(),
      tab === 'ledger' ? getMyFinanceLedger({ limit: 50 }) : Promise.resolve(null),
      tab === 'statements' ? getMyFinanceStatements() : Promise.resolve(null),
      tab === 'payouts' ? getMyFinancePayouts() : Promise.resolve(null),
    ])
      .then(([b, l, s, p]) => {
        setBalances(b.data);
        if (l) setLedger(l.data);
        if (s) setStatements(s.data);
        if (p) setPayouts(p.data);
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [tab, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const downloadStatement = async (payoutId, weekKey) => {
    try {
      const { data } = await getMyFinanceStatementCsvBlob(payoutId);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${weekKey}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  if (loading && !balances) return <div>{t('common:loading')}</div>;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('finance.title')}</h1>

      {balances && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <BalanceCard icon={Clock} color="#f59e0b" label={t('finance.balances.onHold')} value={balances.onHoldCents} />
          <BalanceCard icon={Wallet} color="#10b981" label={t('finance.balances.payable')} value={balances.payableCents} />
          <BalanceCard icon={Banknote} color="var(--accent-primary)" label={t('finance.balances.inNextPayout')} value={balances.inPayoutCents} />
          <BalanceCard icon={CheckCircle2} color="#14b8a6" label={t('finance.balances.paidThisMonth')} value={balances.paidThisMonthCents} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
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

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : tab === 'ledger' ? (
        ledger?.entries?.length ? (
          <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('finance.ledgerTable.date')}</th>
                  <th>{t('finance.ledgerTable.type')}</th>
                  <th>{t('finance.ledgerTable.order')}</th>
                  <th>{t('finance.ledgerTable.amount')}</th>
                  <th>{t('finance.ledgerTable.status')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((e) => (
                  <tr key={e._id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDateTime(e.createdAt)}</td>
                    <td style={{ fontSize: '13px' }}>{t(`finance.entryType.${e.type}`)}</td>
                    <td style={{ fontSize: '12px' }}>
                      {e.sellerOrder ? <Link to={`/seller/orders/${e.sellerOrder._id}`}>{e.sellerOrder.orderNumber}</Link> : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: e.amountCents >= 0 ? '#10b981' : 'var(--text-primary)' }}>
                      {e.amountCents >= 0 ? '+' : ''}{formatLKR(e.amountCents)}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[e.status]}`}>{t(`finance.entryStatus.${e.status}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Wallet} title={t('finance.noEntries')} />
      ) : tab === 'statements' ? (
        statements?.statements?.length ? (
          <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('finance.statementsTable.period')}</th>
                  <th>{t('finance.statementsTable.gross')}</th>
                  <th>{t('finance.statementsTable.commission')}</th>
                  <th>{t('finance.statementsTable.net')}</th>
                  <th>{t('finance.statementsTable.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {statements.statements.map((s) => (
                  <tr key={s._id}>
                    <td style={{ fontSize: '12px' }}>{s.payoutRun?.weekKey}</td>
                    <td>{formatLKR(s.grossSalesCents)}</td>
                    <td>{formatLKR(s.commissionCents)}</td>
                    <td style={{ fontWeight: 700 }}>{formatLKR(s.netCents)}</td>
                    <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{t(`finance.payoutStatus.${s.status}`)}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => downloadStatement(s._id, s.payoutRun?.weekKey)}>
                        <Download size={12} /> {t('finance.statementsTable.csv')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Wallet} title={t('finance.noStatements')} />
      ) : (
        payouts?.payouts?.length ? (
          <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('finance.payoutsTable.period')}</th>
                  <th>{t('finance.payoutsTable.net')}</th>
                  <th>{t('finance.payoutsTable.status')}</th>
                  <th>{t('finance.payoutsTable.reference')}</th>
                  <th>{t('finance.payoutsTable.date')}</th>
                </tr>
              </thead>
              <tbody>
                {payouts.payouts.map((p) => (
                  <tr key={p._id}>
                    <td style={{ fontSize: '12px' }}>{p.payoutRun?.weekKey}</td>
                    <td style={{ fontWeight: 700 }}>{formatLKR(p.netCents)}</td>
                    <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{t(`finance.payoutStatus.${p.status}`)}</span></td>
                    <td style={{ fontSize: '12px' }}>{p.paidReference || p.failedReason || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Banknote} title={t('finance.noPayouts')} />
      )}
    </div>
  );
}

