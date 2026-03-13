import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowPathIcon, BellIcon, Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';
import api from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDateOnly } from '../utils/dates.js';

const Topbar = ({ onMenuClick, onToggleSidebar, sidebarCollapsed }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [nearExpiryAlerts, setNearExpiryAlerts] = useState([]);
  const alertsRef = useRef(null);

  useEffect(() => {
    if (!alertsOpen) return;

    const handleClickOutside = (event) => {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setAlertsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [alertsOpen]);

  const loadAlerts = async () => {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const [lowStockRes, nearExpiryRes] = await Promise.all([
        api.get('/reports/low-stock'),
        api.get('/batches?near_expiry=true')
      ]);
      setLowStockAlerts(lowStockRes.data.slice(0, 5));
      setNearExpiryAlerts((nearExpiryRes.data.batches || []).slice(0, 5));
    } catch (error) {
      console.error('Failed to load alerts', error);
      setAlertsError('Failed to load alerts.');
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleToggleAlerts = async () => {
    const nextOpen = !alertsOpen;
    setAlertsOpen(nextOpen);
    if (nextOpen) {
      await loadAlerts();
    }
  };

  const titleMap = {
    '/dashboard': 'Dashboard',
    '/pos': 'Point of Sale',
    '/products': 'Products',
    '/receiving': 'Receive Delivery',
    '/batches': 'Batch Inventory',
    '/stock-history': 'Stock Movements',
    '/suppliers': 'Suppliers',
    '/sales': 'Sales History',
    '/reports': 'Reports',
    '/users': 'Users',
    '/manual': 'User Manual',
    '/settings': 'Settings'
  };

  const pageTitle = titleMap[location.pathname] || 'PharmaDesk';
  const alertCount = lowStockAlerts.length + nearExpiryAlerts.length;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenuClick}
            className="inline-flex rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Open sidebar"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <button
            onClick={onToggleSidebar}
            className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <h2 className="truncate text-xl font-semibold text-slate-900 md:text-2xl">{pageTitle}</h2>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Refresh page"
            title="Refresh page"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>

          <div className="relative" ref={alertsRef}>
            <button
              onClick={handleToggleAlerts}
              className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <BellIcon className="h-6 w-6" />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                  {alertCount}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute right-0 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Alerts</h3>
                      <p className="text-xs text-slate-500">Low stock and near-expiry items</p>
                    </div>
                    <button
                      onClick={loadAlerts}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="max-h-[26rem] overflow-y-auto p-3">
                  {alertsLoading ? (
                    <div className="py-8 text-center text-sm text-slate-500">Loading alerts...</div>
                  ) : alertsError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {alertsError}
                    </div>
                  ) : alertCount === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">No active alerts.</div>
                  ) : (
                    <div className="space-y-4">
                      {lowStockAlerts.length > 0 && (
                        <div>
                          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Low Stock
                          </div>
                          <div className="space-y-2">
                            {lowStockAlerts.map((item) => (
                              <Link
                                key={`low-${item.id}`}
                                to="/products"
                                onClick={() => setAlertsOpen(false)}
                                className="block rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 transition-colors hover:bg-amber-100"
                              >
                                <div className="text-sm font-medium text-slate-900">{item.name}</div>
                                <div className="mt-1 text-xs text-slate-600">
                                  Stock: {item.current_stock} • Reorder: {item.reorder_level}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {nearExpiryAlerts.length > 0 && (
                        <div>
                          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Near Expiry
                          </div>
                          <div className="space-y-2">
                            {nearExpiryAlerts.map((item) => (
                              <Link
                                key={`expiry-${item.id}`}
                                to="/batches"
                                onClick={() => setAlertsOpen(false)}
                                className="block rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 transition-colors hover:bg-rose-100"
                              >
                                <div className="text-sm font-medium text-slate-900">{item.product_name}</div>
                                <div className="mt-1 text-xs text-slate-600">
                                  Batch: {item.batch_no} • Expiry: {formatDateOnly(item.expiry_date)}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-100">
            <UserCircleIcon className="h-8 w-8 text-slate-500 group-hover:text-slate-700" />
            <div className="hidden md:block">
              <p className="text-sm font-medium text-slate-900">{user?.name || user?.email}</p>
              <p className="text-xs capitalize text-slate-500">{user?.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="hidden items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 md:inline-flex"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
