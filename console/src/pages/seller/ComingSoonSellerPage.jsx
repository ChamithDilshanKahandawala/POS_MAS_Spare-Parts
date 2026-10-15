import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import EmptyState from '../../components/EmptyState';

// One real route per parked sidebar item (Products, Orders, Returns,
// Finance, Performance) — never a dead link, and never fake data
// standing in for a milestone that doesn't exist yet.
export default function ComingSoonSellerPage({ navKey, milestone }) {
  const { t } = useTranslation(['seller', 'common']);

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t(`seller:nav.${navKey}`)}</h1>
      <EmptyState icon={Clock} title={t('common:comingSoon', { milestone })} />
    </div>
  );
}
