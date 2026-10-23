import { useTranslation } from 'react-i18next';
import { Car, X, Pencil } from 'lucide-react';

// The persistent "Showing parts for Toyota Aqua 2015 — change / clear"
// bar (Milestone 5 Part D.4) — shown on the category and search pages
// whenever useSelectedVehicle() has an active selection.
export default function VehicleFilterBar({ vehicle, onChange, onClear }) {
  const { t } = useTranslation('marketplace');
  if (!vehicle) return null;
  const label = [vehicle.makeName, vehicle.modelName, vehicle.year].filter(Boolean).join(' ');

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '12px 16px', borderRadius: '14px', marginBottom: '16px', flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
        <Car size={15} color="var(--accent-primary)" /> {t('vehicleFilterBar.showingFor', { vehicle: label })}
      </div>
      <div style={{ display: 'flex', gap: '14px' }}>
        <button
          type="button" onClick={onChange}
          style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Pencil size={12} /> {t('vehicleFilterBar.change')}
        </button>
        <button
          type="button" onClick={onClear}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <X size={12} /> {t('vehicleFilterBar.clear')}
        </button>
      </div>
    </div>
  );
}
