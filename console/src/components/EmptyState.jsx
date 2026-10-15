// Shared "nothing here yet / nothing here at all" visual — used both
// for pages genuinely parked on a later milestone and for real pages
// whose current result set is just empty (e.g. "no sellers match your
// filters"). Never shows fabricated data; just an icon + a message.
export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {Icon && (
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px', background: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color="var(--accent-primary)" />
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: '15px' }}>{title}</div>
      {description && <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '360px' }}>{description}</div>}
    </div>
  );
}
