import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowPathRoundedSquareIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
  TruckIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import api from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatPeso } from '../utils/currency.js';
import { formatDateOnly } from '../utils/dates.js';

const toneMap = {
  blue: {
    card: 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100/70',
    icon: 'border-blue-200 bg-blue-100 text-blue-700',
    label: 'text-blue-800',
    value: 'text-blue-950',
    subtitle: 'text-blue-900/75',
    accent: 'bg-blue-500'
  },
  emerald: {
    card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70',
    icon: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    label: 'text-emerald-800',
    value: 'text-emerald-950',
    subtitle: 'text-emerald-900/75',
    accent: 'bg-emerald-500'
  },
  amber: {
    card: 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/80',
    icon: 'border-amber-300 bg-amber-100 text-amber-700',
    label: 'text-amber-800',
    value: 'text-amber-950',
    subtitle: 'text-amber-900/75',
    accent: 'bg-amber-500'
  },
  rose: {
    card: 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100/80',
    icon: 'border-rose-200 bg-rose-100 text-rose-700',
    label: 'text-rose-800',
    value: 'text-rose-950',
    subtitle: 'text-rose-900/75',
    accent: 'bg-rose-500'
  },
  slate: {
    card: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80',
    icon: 'border-slate-200 bg-slate-100 text-slate-700',
    label: 'text-slate-700',
    value: 'text-slate-950',
    subtitle: 'text-slate-600',
    accent: 'bg-slate-400'
  }
};

const formatDateTime = (value) => {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleString();
};

const StatCard = ({ title, value, subtitle, icon: Icon, tone = 'slate' }) => {
  const styles = toneMap[tone] || toneMap.slate;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${styles.card}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${styles.label}`}>{title}</p>
          <p className={`mt-3 text-3xl font-bold ${styles.value}`}>{value}</p>
          {subtitle ? <p className={`mt-2 text-sm ${styles.subtitle}`}>{subtitle}</p> : null}
        </div>
        <div className={`rounded-2xl border p-3 shadow-sm ${styles.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

const weekdayLabel = (value) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed);
};

const TrendChart = ({ title, hint, data, formatter, valueKey, strokeColor, pointColor, fillStart, fillEnd, fillId }) => {
  const width = 640;
  const height = 210;
  const paddingX = 34;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const values = data.map((item) => Number(item[valueKey] || 0));
  const max = Math.max(...values, 1);
  const weeklyTotal = values.reduce((sum, value) => sum + value, 0);
  const averagePerDay = weeklyTotal / Math.max(values.length, 1);
  const bestPoint = data.reduce((best, item) => {
    if (!best || Number(item[valueKey] || 0) > Number(best[valueKey] || 0)) {
      return item;
    }
    return best;
  }, null);
  const totalTransactions = data.reduce((sum, item) => sum + Number(item.transactions || 0), 0);
  const lowActivity = values.filter((value) => value > 0).length <= 1;
  const insight = lowActivity
    ? 'Limited sales activity this week, with most movement concentrated in one day.'
    : `Strongest day so far: ${weekdayLabel(bestPoint?.day)} with ${formatter(bestPoint?.[valueKey] || 0)}.`;
  const scaleLabels = [max, max / 2, 0];

  const points = data.map((item, index) => {
    const value = Number(item[valueKey] || 0);
    const x = paddingX + (index * chartWidth) / Math.max(data.length - 1, 1);
    const y = paddingTop + chartHeight - (value / max) * chartHeight;
    return { x, y, value, day: item.day };
  });

  const makeSmoothPath = (pts) => {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let index = 0; index < pts.length - 1; index += 1) {
      const current = pts[index];
      const next = pts[index + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const linePath = makeSmoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
    : '';

  return (
    <div className="card h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
        <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">This Week</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatter(weeklyTotal)}</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-2">
        <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-slate-50 via-white to-slate-50/70 px-2 pt-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label={title}>
            <defs>
              <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={fillStart} stopOpacity="0.32" />
                <stop offset="100%" stopColor={fillEnd} stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {scaleLabels.map((label, row) => {
              const y = paddingTop + (row * chartHeight) / 2;
              return (
                <g key={row}>
                  <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x={paddingX + 4} y={y - 6} className="fill-slate-400 text-[11px] font-medium">
                    {formatter(label)}
                  </text>
                </g>
              );
            })}

            {areaPath ? <path d={areaPath} fill={`url(#${fillId})`} /> : null}
            {linePath ? (
              <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="4" strokeLinecap="round" />
            ) : null}

            {points.map((point) => (
              <g key={`${title}-${point.day}`}>
                <circle cx={point.x} cy={point.y} r="6.5" fill="#ffffff" fillOpacity="0.92" stroke={pointColor} strokeWidth="1.5" />
                <circle cx={point.x} cy={point.y} r="3.5" fill={pointColor} />
                <text
                  x={point.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-500 text-[12px] font-medium"
                >
                  {weekdayLabel(point.day)}
                </text>
                <title>{`${formatDateOnly(point.day, point.day)}: ${formatter(point.value)}`}</title>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Average / Day</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatter(averagePerDay)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Best Day</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {bestPoint ? `${weekdayLabel(bestPoint.day)} · ${formatter(bestPoint[valueKey] || 0)}` : 'No activity'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Transactions</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{totalTransactions}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {insight}
      </div>
    </div>
  );
};

const SectionHeader = ({ title, description, to, label }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    {to ? (
      <Link to={to} className="text-sm font-medium text-blue-600 hover:text-blue-700">
        {label}
      </Link>
    ) : null}
  </div>
);

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/dashboard');
        setData(response.data);
      } catch (err) {
        console.error('Failed to load dashboard', err);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const today = data?.today || {};
  const operations = data?.operations || {};
  const alerts = data?.alerts || {};
  const trends = data?.trends || [];
  const weeklyTopProducts = data?.weekly_top_products || [];
  const recentSales = data?.recent_sales || [];
  const recentReceipts = data?.recent_receipts || [];

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Net Sales Today"
          value={formatPeso(today.today_sales || 0)}
          subtitle={`${today.today_transactions || 0} completed transactions`}
          icon={BanknotesIcon}
          tone="blue"
        />
        <StatCard
          title="Gross Profit Today"
          value={formatPeso(today.gross_profit || 0)}
          subtitle={`Net cost ${formatPeso(today.net_cost || 0)}`}
          icon={ArrowTrendingUpIcon}
          tone="emerald"
        />
        <StatCard
          title="Transactions"
          value={Number(today.today_transactions || 0).toLocaleString()}
          subtitle={`${Number(today.net_units || 0).toLocaleString()} net units sold`}
          icon={ShoppingBagIcon}
          tone="slate"
        />
        <StatCard
          title="Returns Today"
          value={formatPeso(today.returns_amount || 0)}
          subtitle="Deducted from net sales"
          icon={ArrowPathRoundedSquareIcon}
          tone="amber"
        />
        <StatCard
          title="Low Stock Alerts"
          value={Number(alerts.low_stock_count || 0).toLocaleString()}
          subtitle="Products that may need reorder"
          icon={ExclamationTriangleIcon}
          tone="amber"
        />
        <StatCard
          title="Expiring Soon"
          value={Number(alerts.near_expiry_count || 0).toLocaleString()}
          subtitle={`Voided today: ${operations.void_count || 0}`}
          icon={XCircleIcon}
          tone="rose"
        />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <div>
          <TrendChart
            title="Net Sales Trend"
            hint="Last 7 days"
            data={trends}
            valueKey="net_sales"
            formatter={(value) => formatPeso(value)}
            strokeColor="#8b7cf8"
            pointColor="#b7acff"
            fillStart="#c4b5fd"
            fillEnd="#ffffff"
            fillId="net-sales-fill"
          />
        </div>

        <div className="card flex h-full flex-col">
          <SectionHeader
            title="Top Products This Week"
            description="Best-performing products over the last 7 days"
            to="/reports"
            label="Reports"
          />
          <div className="flex-1 space-y-3">
            {weeklyTopProducts.map((product, index) => (
              <div key={`${product.name}-${product.sku || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700 shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku || 'No SKU'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatPeso(product.net_revenue)}</p>
                        <p className="text-xs text-slate-500">{product.net_qty} units</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!weeklyTopProducts.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No weekly top products yet.
              </div>
            ) : null}
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Top Product Today</p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {operations.top_product_today?.name || 'No sales yet'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {operations.top_product_today
                ? `${operations.top_product_today.net_qty} units • ${formatPeso(operations.top_product_today.net_revenue)}`
                : 'Waiting for completed sales.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
        <div className="card overflow-hidden">
          <SectionHeader
            title="Recent Sales"
            description="Latest completed sales with net and profit visibility"
            to="/sales"
            label="View all"
          />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Sale</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Cashier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Net</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">#{sale.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{sale.cashier || 'Unknown cashier'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatPeso(sale.net_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-blue-700">
                      {formatPeso(sale.gross_profit)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{formatDateTime(sale.created_at)}</td>
                  </tr>
                ))}
                {!recentSales.length ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-500">
                      No recent completed sales.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <SectionHeader
            title="Inventory Watch"
            description="The fastest things to inspect today"
          />
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">Low Stock Focus</h4>
                <Link to="/products" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Products
                </Link>
              </div>
              <div className="space-y-2">
                {alerts.low_stock_items?.map((item) => (
                  <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.sku || 'No SKU'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-amber-700">{item.current_stock}</p>
                        <p className="text-xs text-slate-500">Reorder {item.reorder_level}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!alerts.low_stock_items?.length ? (
                  <p className="text-sm text-slate-500">No low stock items.</p>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">Near Expiry</h4>
                <Link to="/batches" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Batches
                </Link>
              </div>
              <div className="space-y-2">
                {alerts.near_expiry_items?.map((item) => (
                  <div key={item.id} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{item.product_name}</p>
                        <p className="text-xs text-slate-500">Batch {item.batch_no}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-rose-700">{formatDateOnly(item.expiry_date)}</p>
                        <p className="text-xs text-slate-500">{item.qty_remaining} left</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!alerts.near_expiry_items?.length ? (
                  <p className="text-sm text-slate-500">No near-expiry batches.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAdmin ? (
        <section className="card">
          <SectionHeader
            title="Recent Receiving"
            description="Latest stock receipts recorded from suppliers"
            to="/receiving"
            label="Receiving"
          />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {recentReceipts.map((receipt) => (
              <div key={receipt.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{receipt.reference_no}</p>
                    <p className="text-sm text-slate-500">{receipt.supplier_name}</p>
                  </div>
                  <TruckIcon className="h-5 w-5 flex-shrink-0 text-slate-400" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Units</p>
                    <p className="font-semibold text-slate-900">{receipt.total_units}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cost</p>
                    <p className="font-semibold text-slate-900">{formatPeso(receipt.total_cost)}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">{formatDateTime(receipt.received_at)}</p>
              </div>
            ))}
            {!recentReceipts.length ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 xl:col-span-3">
                <TruckIcon className="h-4 w-4" />
                No recent receiving records.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default Dashboard;
