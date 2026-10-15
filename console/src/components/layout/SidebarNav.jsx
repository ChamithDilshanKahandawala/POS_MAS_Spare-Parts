import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/useAuth';
import { NAV_ITEMS } from './navConfig';

// Rendered twice — once as the desktop sidebar's contents, once inside
// the mobile bottom drawer — so the nav list and its active-state logic
// live in exactly one place.
export default function SidebarNav({ onNavigate }) {
  const { t } = useTranslation();
  const { isPlatformOwner } = useAuth();

  return (
    <>
      {NAV_ITEMS.filter((item) => !item.ownerOnly || isPlatformOwner).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) => `console-nav-item${isActive ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <Icon size={16} />
            <span>{t(`common:nav.${item.key}`)}</span>
          </NavLink>
        );
      })}
    </>
  );
}
