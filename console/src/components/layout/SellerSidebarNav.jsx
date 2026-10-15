import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/useAuth';
import { SELLER_NAV_ITEMS } from './sellerNavConfig';

// Desktop sidebar for the Seller Center — mirrors admin/SidebarNav.jsx's
// shape (same CSS classes), filtered by isActiveSellerOwner for the
// owner-only Staff item (a view-as session always counts as owner-level
// read access — see context/AuthContext.jsx).
export default function SellerSidebarNav({ onNavigate }) {
  const { t } = useTranslation(['seller', 'common']);
  const { isActiveSellerOwner } = useAuth();

  return (
    <>
      {SELLER_NAV_ITEMS.filter((item) => !item.ownerOnly || isActiveSellerOwner).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/seller'}
            className={({ isActive }) => `console-nav-item${isActive ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <Icon size={16} />
            <span>{t(`seller:nav.${item.key}`)}</span>
          </NavLink>
        );
      })}
    </>
  );
}
