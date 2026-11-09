import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getMyNotificationPrefs, updateMyNotificationPrefs, updateMyPhone } from '../../api/services';

const CHANNELS = ['email', 'sms'];

// The signed-in member's own email/SMS switches. Login codes and security
// messages are not listed: they are always sent.
export default function NotificationPreferences() {
  const { t } = useTranslation(['seller', 'common']);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    getMyNotificationPrefs().then(({ data: d }) => setData(d)).catch(() => toast.error(t('common:error.generic')));
  }, [t]);

  const toggle = async (group, channel) => {
    const value = !data.preferences[group][channel];
    setSaving(`${group}.${channel}`);
    try {
      const { data: d } = await updateMyNotificationPrefs({ [group]: { [channel]: value } });
      setData((prev) => ({ ...prev, preferences: d.preferences }));
      toast.success(t('notificationPrefs.saved'));
    } catch {
      toast.error(t('common:error.generic'));
    } finally {
      setSaving(null);
    }
  };

  const savePhone = async (e) => {
    e.preventDefault();
    setSaving('phone');
    try {
      const { data: d } = await updateMyPhone({ phone: phone.trim(), password });
      setData((prev) => ({ ...prev, phone: d.phone, hasPhone: !!d.phone }));
      setEditingPhone(false);
      setPassword('');
      toast.success(t('notificationPrefs.phoneSaved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(null);
    }
  };

  if (!data) return null;

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '4px' }}>{t('notificationPrefs.title')}</h2>
      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('notificationPrefs.intro')}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px', marginBottom: '14px' }}>
        <strong>{t('notificationPrefs.phoneLabel')}:</strong>
        <span style={{ fontFamily: 'monospace' }}>{data.phone || t('notificationPrefs.phoneNone')}</span>
        {!editingPhone && (
          <button type="button" className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => { setPhone(data.phone); setEditingPhone(true); }}>
            {data.phone ? t('notificationPrefs.phoneChange') : t('notificationPrefs.phoneAdd')}
          </button>
        )}
      </div>
      {editingPhone && (
        <form onSubmit={savePhone} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <input className="input-field" style={{ flex: '1 1 160px' }} inputMode="tel" placeholder="077 123 4567" aria-label={t('notificationPrefs.phoneLabel')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input-field" style={{ flex: '1 1 160px' }} type="password" placeholder={t('notificationPrefs.passwordPlaceholder')} aria-label={t('notificationPrefs.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={!password || saving === 'phone'}>{t('notificationPrefs.phoneSave')}</button>
          <button type="button" className="btn-secondary" onClick={() => { setEditingPhone(false); setPassword(''); }}>{t('common:cancel')}</button>
          <div style={{ flexBasis: '100%', fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('notificationPrefs.phoneHint')}</div>
        </form>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('notificationPrefs.group')}</th>
              {CHANNELS.map((c) => <th key={c} style={{ textAlign: 'center' }}>{t(`notificationPrefs.channel.${c}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.groups.map((group) => (
              <tr key={group}>
                <td style={{ fontSize: '13px' }}>
                  <div style={{ fontWeight: 600 }}>{t(`notificationPrefs.groups.${group}.label`)}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t(`notificationPrefs.groups.${group}.hint`)}</div>
                </td>
                {CHANNELS.map((channel) => {
                  const unavailable = channel === 'sms' ? !data.hasPhone : !data.hasEmail;
                  return (
                    <td key={channel} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        aria-label={`${t(`notificationPrefs.groups.${group}.label`)} — ${t(`notificationPrefs.channel.${channel}`)}`}
                        checked={!unavailable && data.preferences[group][channel]}
                        disabled={unavailable || saving === `${group}.${channel}`}
                        onChange={() => toggle(group, channel)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '10px' }}>
        {t('notificationPrefs.alwaysOn')}{!data.hasPhone && ` ${t('notificationPrefs.noPhone')}`}
      </p>
    </div>
  );
}
