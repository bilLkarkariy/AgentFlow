import { NavLink } from 'react-router-dom';
import {
  Squares2X2Icon,
  ShareIcon,
  QueueListIcon,
  ChevronDoubleLeftIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const items = [
  { to: '/dashboard', label: 'Tableau de bord', Icon: Squares2X2Icon },
  { to: '/flows', label: 'Flows', Icon: ShareIcon },
  { to: '/runs', label: 'Exécutions', Icon: QueueListIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => (
  <aside
    className={[
      'h-full bg-rail flex flex-col transition-[width] duration-200 ease-out',
      collapsed ? 'w-[60px]' : 'w-[216px]',
    ].join(' ')}
  >
    <div className={['flex items-center h-16 shrink-0', collapsed ? 'justify-center' : 'px-4'].join(' ')}>
      <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center shrink-0">
        <span className="text-white text-[13px] font-semibold leading-none">A</span>
      </div>
      {!collapsed && (
        <div className="ml-2.5 min-w-0">
          <div className="text-white text-[13.5px] font-semibold leading-tight">AgentFlow</div>
          <div className="text-railtext/60 text-[10.5px] leading-tight">Studio</div>
        </div>
      )}
    </div>

    <nav className="flex-1 px-2 space-y-0.5">
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            [
              'relative flex items-center h-9 rounded-md transition-colors group',
              collapsed ? 'justify-center' : 'px-2.5 gap-2.5',
              isActive
                ? 'bg-white/[0.07] text-white'
                : 'text-railtext hover:text-white hover:bg-white/[0.04]',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-white" />
              )}
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.7} />
              {!collapsed && <span className="text-[13px] font-medium truncate">{label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>

    {onToggle && (
      <button
        onClick={onToggle}
        title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
        className={[
          'flex items-center h-9 mx-2 mb-3 rounded-md text-railtext hover:text-white hover:bg-white/[0.04] transition-colors',
          collapsed ? 'justify-center' : 'px-2.5 gap-2.5',
        ].join(' ')}
      >
        <ChevronDoubleLeftIcon
          className={['w-[18px] h-[18px] shrink-0 transition-transform duration-200', collapsed ? 'rotate-180' : ''].join(' ')}
          strokeWidth={1.7}
        />
        {!collapsed && <span className="text-[13px]">Replier</span>}
      </button>
    )}
  </aside>
);

export default Sidebar;
