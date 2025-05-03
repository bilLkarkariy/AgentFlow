import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => (
  <aside className="w-64 bg-white border-r h-screen">
    <nav className="p-4 space-y-4 flex flex-col">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          isActive ? 'font-semibold text-blue-600' : 'text-gray-700'
        }
      >
        Dashboard
      </NavLink>
      <NavLink
        to="/flows"
        className={({ isActive }) =>
          isActive ? 'font-semibold text-blue-600' : 'text-gray-700'
        }
      >
        Flows
      </NavLink>
      <NavLink
        to="/runs"
        className={({ isActive }) =>
          isActive ? 'font-semibold text-blue-600' : 'text-gray-700'
        }
      >
        Runs
      </NavLink>
    </nav>
  </aside>
);

export default Sidebar;
