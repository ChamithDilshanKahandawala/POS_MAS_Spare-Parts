import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAdminContent, saveAdminContentDraft, createAdminBanner, uploadAdminBannerImage, getAdminContentImageBlob,
  publishAdminContent, unpublishAdminContent, deleteAdminBanner,
} from '../../api/services';
import { formatDateTime } from '../../utils/formatDateTime';
import AuthImage from '../../components/AuthImage';
import ContentBody from '../../components/content/ContentBody';

const LANGS = ['en', 'si', 'ta'];
const TABS = ['pages', 'banners', 'announcement'];

const toLocalInput = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

// Admin → Content: info pages, homepage banners and the announcement bar.
// Staff edit drafts; only "Publish" changes what the storefront shows.
export default function ContentPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [tab, setTab] = useState('pages');
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    getAdminContent().then(({ data: d }) => setData(d)).catch(() => toast.error(t('common:error.generic')));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const replaceBlock = (block) => setData((d) => ({
    pages: d.pages.map((p) => (p._id === block._id ? block : p)),
    announcement: d.announcement._id === block._id ? block : d.announcement,
    banners: d.banners.some((b) => b._id === block._id) ? d.banners.map((b) => (b._id === block._id ? block : b)) : [...d.banners, block],
  }));

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '6px' }}>{t('nav.content', { ns: 'common' })}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{t('contentPage.subtitle')}</p>

      <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'btn-primary' : 'btn-secondary'} style={{ padding: '7px 14px', fontSize: '13px' }} onClick={() => setTab(k)}>
            {t(`contentPage.tabs.${k}`)}
          </button>
        ))}
      </div>

      {!data ? <div>{t('common:loading')}</div> : (
        <>
          {tab === 'pages' && data.pages.map((block) => <BlockEditor key={block._id} block={block} onChange={replaceBlock} />)}
          {tab === 'announcement' && <BlockEditor block={data.announcement} onChange={replaceBlock} />}
          {tab === 'banners' && (
            <>
              <button
                className="btn-secondary" style={{ marginBottom: '14px' }}
                onClick={async () => {
                  try {
                    const { data: d } = await createAdminBanner({ title: { en: '' } });
                    replaceBlock(d.block);
                  } catch (err) { toast.error(err.response?.data?.message || t('common:error.generic')); }
                }}
              >
                <Plus size={14} /> {t('contentPage.addBanner')}
              </button>
              {data.banners.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('contentPage.noBanners')}</div>}
              {data.banners.map((block) => (
                <BlockEditor key={block._id} block={block} onChange={replaceBlock} onDeleted={() => setData((d) => ({ ...d, banners: d.banners.filter((b) => b._id !== block._id) }))} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ block }) {
  const { t } = useTranslation('admin');
  if (!block.published) return <span className="badge badge-yellow">{t('contentPage.status.notPublished')}</span>;
  if (block.hasUnpublishedChanges) return <span className="badge badge-blue">{t('contentPage.status.unpublishedChanges')}</span>;
  return <span className="badge badge-green">{t('contentPage.status.published')}</span>;
}

function BlockEditor({ block, onChange, onDeleted }) {
  const { t } = useTranslation(['admin', 'common']);
  const [lang, setLang] = useState('en');
  const [draft, setDraft] = useState(block.draft);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  const set = (field, value) => { setDraft((d) => ({ ...d, [field]: value })); setDirty(true); };
  const setLocalized = (field, value) => set(field, { ...(draft[field] || {}), [lang]: value });

  const payload = () => {
    if (block.kind === 'page') return { title: draft.title, body: draft.body };
    const windowFields = { link: draft.link || '', startsAt: draft.startsAt || null, endsAt: draft.endsAt || null };
    if (block.kind === 'announcement') return { text: draft.text, ...windowFields };
    return { title: draft.title, language: draft.language || 'all', ...windowFields };
  };

  const run = async (fn, successKey) => {
    setBusy(true);
    try {
      const { data } = await fn();
      if (data?.block) { onChange(data.block); setDraft(data.block.draft); }
      setDirty(false);
      if (successKey) toast.success(t(successKey));
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(() => saveAdminContentDraft(block._id, payload()), 'contentPage.toast.saved');
  const publish = async () => {
    if (dirty && !(await run(() => saveAdminContentDraft(block._id, payload())))) return;
    await run(() => publishAdminContent(block._id), 'contentPage.toast.published');
  };

  const heading = block.kind === 'page' ? t(`contentPage.pages.${block.key}`) : block.kind === 'announcement' ? t('contentPage.tabs.announcement') : (draft.title?.en || t('contentPage.untitledBanner'));
  const fetchImage = useCallback(() => getAdminContentImageBlob(block._id, 'draft'), [block._id]);

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>{heading}</h2>
        <StatusBadge block={block} />
        {block.publishedAt && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('contentPage.publishedOn', { date: formatDateTime(block.publishedAt) })}</span>}
      </div>

      {block.kind === 'banner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {block.draft.hasImage
            ? <AuthImage key={imageVersion} fetchBlob={fetchImage} index={0} alt="" style={{ width: '100%', maxWidth: '640px', aspectRatio: '10 / 3', objectFit: 'cover', borderRadius: '12px' }} />
            : <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{t('contentPage.noImage')}</div>}
          <label className="btn-secondary" style={{ alignSelf: 'flex-start', cursor: 'pointer', fontSize: '12.5px' }}>
            <Upload size={13} /> {t('contentPage.uploadImage')}
            <input
              type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file && await run(() => uploadAdminBannerImage(block._id, file), 'contentPage.toast.imageUploaded')) setImageVersion((v) => v + 1);
              }}
            />
          </label>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('contentPage.imageHint')}</div>
        </div>
      )}

      <div role="tablist" aria-label={t('contentPage.language')} style={{ display: 'flex', gap: '4px' }}>
        {LANGS.map((l) => (
          <button key={l} role="tab" aria-selected={lang === l} className={lang === l ? 'btn-primary' : 'btn-secondary'} style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setLang(l)}>
            {t(`contentPage.languages.${l}`)}
          </button>
        ))}
      </div>

      {(block.kind === 'page' || block.kind === 'banner') && (
        <label style={{ fontSize: '12px', fontWeight: 700 }}>
          {block.kind === 'page' ? t('contentPage.fields.title') : t('contentPage.fields.headline')}
          <input className="input-field" style={{ width: '100%', marginTop: '4px' }} value={draft.title?.[lang] || ''} onChange={(e) => setLocalized('title', e.target.value)} />
        </label>
      )}
      {block.kind === 'announcement' && (
        <label style={{ fontSize: '12px', fontWeight: 700 }}>
          {t('contentPage.fields.text')}
          <input className="input-field" style={{ width: '100%', marginTop: '4px' }} maxLength={200} value={draft.text?.[lang] || ''} onChange={(e) => setLocalized('text', e.target.value)} />
        </label>
      )}
      {block.kind === 'page' && (
        <label style={{ fontSize: '12px', fontWeight: 700 }}>
          {t('contentPage.fields.body')}
          <textarea className="input-field" rows={12} style={{ width: '100%', marginTop: '4px', fontFamily: 'monospace', fontSize: '12.5px' }} value={draft.body?.[lang] || ''} onChange={(e) => setLocalized('body', e.target.value)} />
          <span style={{ display: 'block', fontWeight: 400, fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('contentPage.markupHint')}</span>
        </label>
      )}
      {lang !== 'en' && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('contentPage.fallbackHint')}</div>}

      {block.kind !== 'page' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700 }}>
            {t('contentPage.fields.link')}
            <input className="input-field" style={{ width: '100%', marginTop: '4px' }} placeholder="/category/brakes" value={draft.link || ''} onChange={(e) => set('link', e.target.value)} />
          </label>
          {block.kind === 'banner' && (
            <label style={{ fontSize: '12px', fontWeight: 700 }}>
              {t('contentPage.fields.audience')}
              <select className="input-field" style={{ width: '100%', marginTop: '4px' }} value={draft.language || 'all'} onChange={(e) => set('language', e.target.value)}>
                {['all', ...LANGS].map((l) => <option key={l} value={l}>{t(`contentPage.audience.${l}`)}</option>)}
              </select>
            </label>
          )}
          <label style={{ fontSize: '12px', fontWeight: 700 }}>
            {t('contentPage.fields.startsAt')}
            <input type="datetime-local" className="input-field" style={{ width: '100%', marginTop: '4px' }} value={toLocalInput(draft.startsAt)} onChange={(e) => set('startsAt', fromLocalInput(e.target.value))} />
          </label>
          <label style={{ fontSize: '12px', fontWeight: 700 }}>
            {t('contentPage.fields.endsAt')}
            <input type="datetime-local" className="input-field" style={{ width: '100%', marginTop: '4px' }} value={toLocalInput(draft.endsAt)} onChange={(e) => set('endsAt', fromLocalInput(e.target.value))} />
          </label>
        </div>
      )}

      {preview && (
        <div style={{ border: '1px dashed var(--border-light)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>{t('contentPage.previewLabel', { lang: t(`contentPage.languages.${lang}`) })}</div>
          {block.kind === 'page' && (
            <>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>{draft.title?.[lang] || draft.title?.en}</h3>
              <ContentBody text={draft.body?.[lang] || draft.body?.en || ''} />
            </>
          )}
          {block.kind === 'announcement' && (
            <div style={{ background: 'var(--accent-strong)', color: 'var(--accent-contrast)', textAlign: 'center', padding: '6px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '6px' }}>
              {draft.text?.[lang] || draft.text?.en}
            </div>
          )}
          {block.kind === 'banner' && <div style={{ fontSize: '13px' }}>{draft.title?.[lang] || draft.title?.en} → {draft.link || '—'}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="btn-secondary" disabled={busy || !dirty} onClick={save}>{t('contentPage.saveDraft')}</button>
        <button className="btn-secondary" onClick={() => setPreview((p) => !p)} aria-expanded={preview}>{preview ? t('contentPage.hidePreview') : t('contentPage.preview')}</button>
        <button className="btn-primary" disabled={busy || (!dirty && !block.hasUnpublishedChanges)} onClick={publish}>{t('contentPage.publish')}</button>
        {block.published && <button className="btn-secondary" disabled={busy} onClick={() => run(() => unpublishAdminContent(block._id), 'contentPage.toast.unpublished')}>{t('contentPage.unpublish')}</button>}
        {block.kind === 'banner' && (
          <button
            className="btn-secondary" disabled={busy} style={{ marginLeft: 'auto' }}
            onClick={async () => {
              if (!window.confirm(t('contentPage.confirmDelete'))) return;
              try { await deleteAdminBanner(block._id); onDeleted(); toast.success(t('contentPage.toast.deleted')); } catch (err) { toast.error(err.response?.data?.message || t('common:error.generic')); }
            }}
          >
            <Trash2 size={13} /> {t('contentPage.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
