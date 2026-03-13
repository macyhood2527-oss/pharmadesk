import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChartBarIcon, 
  ShoppingCartIcon, 
  CubeIcon, 
  ClipboardDocumentListIcon, 
  BuildingOfficeIcon, 
  UserGroupIcon,
  ArrowsRightLeftIcon,
  ArchiveBoxArrowDownIcon,
  CogIcon,
  BookOpenIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../services/api.js';

const Sidebar = ({ isOpen, isCollapsed, onClose, onToggleCollapse }) => {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const [sectionState, setSectionState] = useState({
    Main: true,
    Inventory: true,
    Sales: true,
    Administration: false,
    Account: true,
    Help: true
  });
  const [navBadges, setNavBadges] = useState({ lowStock: 0, nearExpiry: 0 });

  const sections = [
    {
      title: 'Main',
      collapsible: false,
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: ChartBarIcon, description: 'Overview and alerts', featured: true },
        { path: '/pos', label: 'Point of Sale', icon: ShoppingCartIcon, description: 'Fast checkout screen', featured: true }
      ]
    },
    ...(isAdmin ? [
      {
        title: 'Inventory',
        collapsible: true,
        items: [
          { path: '/receiving', label: 'Receive Delivery', icon: ArchiveBoxArrowDownIcon, description: 'Record incoming stock' },
          { path: '/products', label: 'Products', icon: CubeIcon, description: 'Catalog and pricing', badgeKey: 'lowStock', badgeTone: 'amber' },
          { path: '/batches', label: 'Batch Inventory', icon: ClipboardDocumentListIcon, description: 'Expiry and stock per batch', badgeKey: 'nearExpiry', badgeTone: 'rose' },
          { path: '/stock-history', label: 'Stock Movements', icon: ArrowsRightLeftIcon, description: 'Trace stock in and out' }
        ]
      },
      {
        title: 'Sales',
        collapsible: true,
        items: [
          { path: '/sales', label: 'Sales History', icon: ClipboardDocumentListIcon, description: 'Past transactions and returns' },
          { path: '/reports', label: 'Reports', icon: ChartBarIcon, description: 'Business summaries' }
        ]
      },
      {
        title: 'Administration',
        collapsible: true,
        items: [
          { path: '/suppliers', label: 'Suppliers', icon: BuildingOfficeIcon, description: 'Vendor records' },
          { path: '/users', label: 'Users', icon: UserGroupIcon, description: 'Manage staff access' },
          { path: '/settings', label: 'Settings', icon: CogIcon, description: 'System preferences' }
        ]
      }
    ] : [
      {
        title: 'Account',
        collapsible: false,
        items: [
          { path: '/settings', label: 'Settings', icon: CogIcon, description: 'Profile and app settings' }
        ]
      }
    ]),
    {
      title: 'Help',
      collapsible: false,
      items: [
        { path: '/manual', label: 'User Manual', icon: BookOpenIcon, description: 'Daily-use instructions' }
      ]
    }
  ];

  const isActivePath = (path) => location.pathname === path;

  useEffect(() => {
    if (!isAdmin) return undefined;

    let cancelled = false;

    const loadBadges = async () => {
      try {
        const [lowStockRes, nearExpiryRes] = await Promise.all([
          api.get('/reports/low-stock'),
          api.get('/batches?near_expiry=true&limit=100')
        ]);

        if (cancelled) return;

        setNavBadges({
          lowStock: lowStockRes.data.length,
          nearExpiry: nearExpiryRes.data?.pagination?.total || (nearExpiryRes.data?.batches || []).length
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load sidebar badges', error);
        }
      }
    };

    loadBadges();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    const matchingSection = ['Inventory', 'Sales', 'Administration'].find((title) => {
      const section = sections.find((entry) => entry.title === title);
      return section?.items.some((item) => item.path === location.pathname);
    });
    if (!matchingSection) return;

    setSectionState((current) => (
      current[matchingSection]
        ? current
        : { ...current, [matchingSection]: true }
    ));
  }, [location.pathname, isAdmin]);

  const toggleSection = (title) => {
    setSectionState((current) => ({ ...current, [title]: !current[title] }));
  };

  const sectionAlertCount = (section) => section.items.reduce((sum, item) => sum + (item.badgeKey ? (navBadges[item.badgeKey] || 0) : 0), 0);

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const active = isActivePath(item.path);
    const badgeCount = item.badgeKey ? navBadges[item.badgeKey] : 0;
    const badgeClass = item.badgeTone === 'rose'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-700';

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onClose}
        className={`group flex items-center rounded-2xl px-3 py-3 text-sm transition-all duration-200 ${
          active
            ? item.featured
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
            : item.featured
              ? 'bg-slate-900 text-slate-100 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        } ${isCollapsed ? 'lg:justify-center' : ''}`}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'lg:mr-3'} ${active && item.featured ? 'text-white' : ''}`} />
        <div className={isCollapsed ? 'lg:sr-only' : 'min-w-0 flex-1'}>
          <div className="flex items-center justify-between gap-3">
            <div className={`truncate font-semibold ${item.featured && !active ? 'text-slate-50' : ''}`}>{item.label}</div>
            {!item.featured && badgeCount > 0 ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
                {badgeCount}
              </span>
            ) : null}
          </div>
          <div className={`truncate text-xs ${active ? (item.featured ? 'text-blue-100' : 'text-blue-600') : item.featured ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-500'}`}>
            {item.description}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-72'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-72 lg:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div className={isCollapsed ? 'lg:sr-only' : ''}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Retail Console</p>
            <h1 className="text-xl font-bold text-slate-900">PharmaDesk</h1>
            <p className="mt-1 text-xs text-slate-500">{isAdmin ? 'Admin workspace' : 'Cashier workspace'}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Close sidebar"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-between px-3 py-4">
          <nav className="space-y-5 overflow-y-auto pr-1">
            {sections.map((section) => (
              <div key={section.title}>
                {section.collapsible && !isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <span>{section.title}</span>
                    <span className="flex items-center gap-2">
                      {sectionAlertCount(section) > 0 ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {sectionAlertCount(section)}
                        </span>
                      ) : null}
                      <ChevronDownIcon className={`h-4 w-4 transition-transform ${sectionState[section.title] ? 'rotate-0' : '-rotate-90'}`} />
                    </span>
                  </button>
                ) : (
                  <div className={`${isCollapsed ? 'lg:sr-only' : 'mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400'}`}>
                    {section.title}
                  </div>
                )}
                {(isCollapsed || !section.collapsible || sectionState[section.title]) ? (
                  <div className="space-y-1.5">
                    {section.items.map(renderNavItem)}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>

          <div className={`border-t border-slate-200 pt-4 ${isCollapsed ? 'lg:px-0' : 'px-3'}`}>
            <div className={`rounded-2xl bg-slate-50 px-3 py-3 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name || user?.email}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
