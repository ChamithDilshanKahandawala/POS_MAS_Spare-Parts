import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadListingMedia, deleteMyMedia } from '../../../../api/services';
import MediaImage from '../../../../components/MediaImage';

const MAX_IMAGES = 8;

export default function StepPhotos({ listing, onChange, listingId }) {
  const { t } = useTranslation(['seller', 'common']);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);

  const images = listing.images || [];

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).slice(0, MAX_IMAGES - images.length);
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { data } = await uploadListingMedia(listingId, files, setUploadProgress);
      onChange({ images: [...images, ...data.media] });
      toast.success(t('wizard.photos.uploaded', { count: data.media.length }));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = async (media) => {
    try {
      await deleteMyMedia(media._id);
      onChange({ images: images.filter((img) => img._id !== media._id) });
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange({ images: next });
    setDragIndex(null);
  };

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('wizard.photos.guidance')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {images.map((media, idx) => (
          <div
            key={media._id}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-light)', cursor: 'grab' }}
          >
            <MediaImage mediaId={media._id} size="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {idx === 0 && (
              <span style={{ position: 'absolute', top: '4px', left: '4px', display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--accent-primary)', color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: '999px' }}>
                <Star size={9} /> {t('wizard.photos.cover')}
              </span>
            )}
            <button
              type="button" onClick={() => removeImage(media)}
              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={12} color="#fff" />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              aspectRatio: '1', borderRadius: '10px', border: '2px dashed var(--border)', background: 'var(--bg-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <Upload size={18} />
            <span style={{ fontSize: '11px' }}>{uploading ? t('wizard.photos.uploading') : t('wizard.photos.add')}</span>
          </button>
        )}
      </div>

      {uploading && (
        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-secondary)', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent-primary)', transition: 'width 150ms linear' }} />
        </div>
      )}

      <input
        ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple
        style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)}
      />

      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('wizard.photos.countHint', { count: images.length, max: MAX_IMAGES })}</div>
    </div>
  );
}
