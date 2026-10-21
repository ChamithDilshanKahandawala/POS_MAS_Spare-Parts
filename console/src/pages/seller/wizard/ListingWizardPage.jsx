import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyListing, createMyListing, updateMyListing, checkMyListing, submitMyListing } from '../../../api/services';
import StepCategory from './steps/StepCategory';
import StepBasics from './steps/StepBasics';
import StepDetails from './steps/StepDetails';
import StepPhotos from './steps/StepPhotos';
import StepPricing from './steps/StepPricing';
import StepReturns from './steps/StepReturns';
import StepPreview from './steps/StepPreview';

const STEPS = ['category', 'basics', 'details', 'photos', 'pricing', 'returns', 'preview'];
const CONTENT_FIELDS = ['title', 'description', 'categoryId', 'brand', 'condition', 'sku', 'attributes', 'fitment', 'images', 'weightGrams', 'dimensions', 'warranty'];
const SAVE_DELAY_MS = 3000;
// Backoff for automatic retries after a failed/timed-out autosave — after
// the last one also fails, we stop and surface a manual "Try again".
const RETRY_DELAYS_MS = [3000, 10000, 30000];

function buildPatch(listing) {
  const patch = {};
  for (const field of CONTENT_FIELDS) if (listing[field] !== undefined) patch[field] = listing[field];
  // `images` holds populated Media objects client-side (so <img> tags
  // can read e.g. img._id directly) — the API expects plain id strings.
  if (patch.images) patch.images = patch.images.map((img) => (img && img._id ? img._id : img));
  patch.priceCents = listing.priceCents || 0;
  patch.wasPriceCents = listing.wasPriceCents ?? null;
  patch.stock = listing.stock || 0;
  patch.lowStockAlert = listing.lowStockAlert ?? null;
  return patch;
}

// Local-only safety net: the full client-side listing is mirrored here on
// every edit and cleared once a save actually succeeds, so a crash, a
// reload, or a stuck connection during a retry doesn't lose the seller's
// work. localStorage can throw (private browsing, quota, disabled) or
// just not be there — never let a backup failure break editing.
const backupKey = (id) => `apexora_wizard_draft_${id}`;
function writeBackup(id, listing) {
  if (!id) return;
  try { localStorage.setItem(backupKey(id), JSON.stringify({ listing, at: Date.now() })); } catch { /* best-effort */ }
}
function readBackup(id) {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearBackup(id) {
  if (!id) return;
  try { localStorage.removeItem(backupKey(id)); } catch { /* best-effort */ }
}

export default function ListingWizardPage() {
  const { t } = useTranslation(['seller', 'common']);
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = Math.min(Math.max(Number(searchParams.get('step') || 1), 1), STEPS.length);

  const [listingId, setListingId] = useState(routeId || null);
  const [listing, setListing] = useState(null);
  const [effective, setEffective] = useState(null);
  const [loading, setLoading] = useState(!!routeId);
  // 'idle' | 'saving' | 'saved' | 'retrying' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSaved, setLastSaved] = useState(null);
  const [problems, setProblems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const listingRef = useRef(null);
  const saveTimer = useRef(null);
  const retryTimer = useRef(null);
  const retryAttempt = useRef(0);
  // Bumped on every local edit. flushSave snapshots this when it STARTS
  // a save; if a newer edit has happened by the time that save's
  // response comes back (e.g. the immediate flushSave() a step-change
  // fires races against the user already typing into the next step),
  // the response is stale and must not overwrite the newer local state —
  // otherwise an older in-flight save finishing late silently wipes out
  // whatever the user just entered. The save itself still succeeded
  // server-side; the next (newer) autosave re-syncs everything shortly.
  const editGeneration = useRef(0);
  // The highest generation actually confirmed saved — compared against
  // editGeneration to know whether there's anything unsaved right now
  // (drives the beforeunload warning).
  const syncedGeneration = useRef(0);
  // Chains every flushSave() call onto whatever save is already in
  // flight, so requests for the same listing are never sent
  // concurrently — two overlapping PATCHes race on Mongoose's optimistic
  // concurrency check (__v) and the second one 500s outright, silently
  // dropping whatever it was trying to save. goToStep() calling
  // flushSave() immediately, right as a debounced autosave might also be
  // about to fire, is exactly the kind of overlap this guards against.
  const saveQueue = useRef(Promise.resolve());

  const flushSave = useCallback(() => {
    if (!listingId || !listingRef.current) return Promise.resolve();
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }

    const run = async () => {
      const myGeneration = editGeneration.current;
      setSaveStatus('saving');
      try {
        const { data } = await updateMyListing(listingId, buildPatch(listingRef.current));
        if (editGeneration.current === myGeneration) {
          setListing(data.listing);
          listingRef.current = data.listing;
          if (data.problems) setProblems(data.problems);
          else setProblems([]);
        }
        syncedGeneration.current = myGeneration;
        retryAttempt.current = 0;
        setLastSaved(new Date());
        setSaveStatus('saved');
        clearBackup(listingId);
      } catch (err) {
        // Any failure (network error, 5xx, a timed-out request, or a 429
        // from the autosave rate limiter) goes through the same backoff —
        // a seller on a flaky connection, and a seller who's just typed
        // fast enough to trip the limiter, see the same "not saved"
        // problem either way, and never lose what they typed (it stays in
        // listingRef + the localStorage backup regardless). The retry
        // re-enqueues `run` itself (not `flushSave`) so it stays
        // serialized on saveQueue exactly like any other save attempt,
        // with no self-reference to the memoized `flushSave` callback.
        const attempt = retryAttempt.current;
        if (attempt < RETRY_DELAYS_MS.length) {
          setSaveStatus('retrying');
          retryAttempt.current = attempt + 1;
          // A 429 carries how long to actually wait (Retry-After, in
          // seconds) — prefer that over the fixed backoff when present,
          // rather than guessing and possibly retrying into the same
          // still-active limit window.
          const retryAfterHeader = err?.response?.status === 429 ? err.response.headers?.['retry-after'] : null;
          const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
          const delay = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : RETRY_DELAYS_MS[attempt];
          retryTimer.current = setTimeout(() => {
            saveQueue.current = saveQueue.current.then(run, run);
          }, delay);
        } else {
          setSaveStatus('error');
        }
      }
    };

    saveQueue.current = saveQueue.current.then(run, run);
    return saveQueue.current;
  }, [listingId]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DELAY_MS);
  }, [flushSave]);

  const load = useCallback(() => {
    if (!listingId) return;
    setLoading(true);
    getMyListing(listingId)
      .then(({ data }) => {
        // A local backup newer than what the server has means a save
        // never completed (crash, reload mid-retry, closed the tab past
        // the warning) — restore it over the server copy and let the
        // normal autosave path try to persist it again.
        const backup = readBackup(listingId);
        const restored = backup?.listing ? { ...data.listing, ...backup.listing, _id: data.listing._id } : data.listing;
        setListing(restored);
        listingRef.current = restored;
        setEffective(data.effective);
        if (backup?.listing) {
          editGeneration.current += 1;
          toast.success(t('wizard.unsavedRestored'));
          scheduleSave();
        }
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [listingId, t, scheduleSave]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const retryNow = useCallback(() => {
    retryAttempt.current = 0;
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    flushSave();
  }, [flushSave]);

  const updateLocal = useCallback((patch) => {
    editGeneration.current += 1;
    setListing((prev) => {
      const next = { ...prev, ...patch };
      listingRef.current = next;
      writeBackup(listingId, next);
      return next;
    });
    scheduleSave();
  }, [scheduleSave, listingId]);

  // Native "are you sure you want to leave" — covers tab close, refresh,
  // and navigating away by URL. editGeneration vs syncedGeneration is
  // true whenever there's an edit (including one still mid-debounce or
  // mid-retry) that hasn't been confirmed saved yet.
  useEffect(() => {
    const handler = (e) => {
      if (editGeneration.current !== syncedGeneration.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Step 1 (no listing yet): picking a category creates the draft.
  const handleCreate = async (categoryId) => {
    try {
      const { data } = await createMyListing(categoryId);
      setListingId(data.listing._id);
      setListing(data.listing);
      listingRef.current = data.listing;
      navigate(`/seller/products/${data.listing._id}/edit?step=2`, { replace: true });
      const detail = await getMyListing(data.listing._id);
      setEffective(detail.data.effective);
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const goToStep = (n) => {
    flushSave();
    const next = new URLSearchParams(searchParams);
    next.set('step', String(n));
    setSearchParams(next);
  };

  const runCheck = useCallback(async () => {
    if (!listingId) return [];
    await flushSave();
    const { data } = await checkMyListing(listingId);
    setProblems(data.problems);
    return data.problems;
  }, [listingId, flushSave]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await flushSave();
      const { data } = await submitMyListing(listingId);
      if (data.problems?.length) {
        setProblems(data.problems);
        toast.error(t('wizard.stillHasProblems'));
      } else {
        toast.success(data.listing.status === 'published' ? t('wizard.publishedNow') : t('wizard.sentForReview'));
        navigate(`/seller/products/${listingId}/edit`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  if (loading) return <div>{t('common:loading')}</div>;

  const stepProps = { listing, effective, onChange: updateLocal, onSaveNow: flushSave };

  return (
    <div className="animate-fade">
      <Link className="btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '12px', display: 'inline-flex' }} to="/seller/products">
        <ArrowLeft size={14} /> {t('wizard.backToProducts')}
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <h1 className="page-title">{listingId ? (listing?.title?.en || t('wizard.editListing')) : t('wizard.newListing')}</h1>
        <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {saveStatus === 'saving' && (
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={12} className="spin" /> {t('wizard.saving')}
            </span>
          )}
          {saveStatus === 'saved' && lastSaved && (
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={12} /> {t('wizard.saved')}
            </span>
          )}
          {saveStatus === 'retrying' && (
            <span style={{ color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={12} className="spin" /> {t('wizard.notSavedRetrying')}
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ color: 'var(--badge-red-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={12} /> {t('wizard.saveFailed')}
              <button type="button" className="btn-secondary" style={{ padding: '3px 10px', fontSize: '11px' }} onClick={retryNow}>
                {t('wizard.tryAgain')}
              </button>
            </span>
          )}
        </div>
      </div>

      {listing?.status === 'rejected' && (
        <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '16px', borderColor: 'var(--accent-red)' }}>
          <strong style={{ color: 'var(--badge-red-text)' }}>{t('wizard.rejectedBanner')}</strong>
          {listing.rejectionNote && <div style={{ fontSize: '13px', marginTop: '4px' }}>{listing.rejectionNote}</div>}
        </div>
      )}
      {listing?.pendingRevision?.fields && (
        <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '16px' }}>
          <AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: '6px', color: 'var(--accent-yellow)' }} />
          {t('wizard.pendingRevisionBanner')}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        {STEPS.map((key, i) => (
          <button
            key={key}
            className={step === i + 1 ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 12px', fontSize: '12px' }}
            disabled={!listingId && i > 0}
            onClick={() => goToStep(i + 1)}
          >
            {i + 1}. {t(`wizard.steps.${key}`)}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '760px' }}>
        {step === 1 && <StepCategory listing={listing} onCreate={handleCreate} onChange={updateLocal} />}
        {step === 2 && listingId && <StepBasics {...stepProps} />}
        {step === 3 && listingId && <StepDetails {...stepProps} />}
        {step === 4 && listingId && <StepPhotos listing={listing} onChange={updateLocal} listingId={listingId} onReload={load} />}
        {step === 5 && listingId && <StepPricing {...stepProps} />}
        {step === 6 && listingId && <StepReturns {...stepProps} />}
        {step === 7 && listingId && <StepPreview listing={listing} problems={problems} onRunCheck={runCheck} onGoToStep={goToStep} />}
      </div>

      {listingId && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', maxWidth: '760px' }}>
          <button className="btn-secondary" disabled={step === 1} onClick={() => goToStep(step - 1)}>{t('wizard.back')}</button>
          {step < STEPS.length ? (
            <button className="btn-primary" onClick={() => goToStep(step + 1)}>{t('wizard.next')}</button>
          ) : (
            <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>{t('wizard.submit')}</button>
          )}
        </div>
      )}
    </div>
  );
}
