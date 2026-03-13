import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { formatDateOnly } from '../utils/dates.js';

const typeStyles = {
  in: 'bg-emerald-100 text-emerald-700',
  out: 'bg-red-100 text-red-700',
  adjustment: 'bg-amber-100 text-amber-700'
};

const formatReference = (movement) => {
  if (!movement.reference_id) return 'Manual';
  if (movement.type === 'out') return `Sale #${movement.reference_id}`;
  if (movement.notes?.toLowerCase().includes('void')) return `Void #${movement.reference_id}`;
  if (movement.notes?.toLowerCase().includes('return')) return `Return #${movement.reference_id}`;
  return `Ref #${movement.reference_id}`;
};

const StockHistory = () => {
  const [days, setDays] = useState(30);
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ summary: {}, movements: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [days, type, search]);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/stock-history', {
          params: { days, type, search, page, limit: 20 }
        });
        setData(response.data);
        setPagination(response.data.pagination);
      } catch (err) {
        console.error('Failed to load stock history', err);
        setError('Failed to load stock history.');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [days, type, search, page]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock History</h1>
          <p className="mt-1 text-gray-600">
            Audit trail for received stock, sales deductions, returns, voids, and manual adjustments.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search product, SKU, batch, note, sale #"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-72"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="adjustment">Adjustments</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Records</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '...' : data.summary.total_records || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Stock In</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{loading ? '...' : data.summary.total_in || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Stock Out</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{loading ? '...' : data.summary.total_out || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Adjustments</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{loading ? '...' : data.summary.total_adjustments || 0}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Qty</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reference</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.movements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                      {new Date(movement.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="font-medium">{movement.product_name || 'Unknown product'}</div>
                      <div className="text-xs text-gray-500">
                        {[movement.sku, movement.brand_name, movement.dosage_form].filter(Boolean).join(' • ') || 'No details'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                      <div>{movement.batch_no || '—'}</div>
                      <div className="text-xs text-gray-500">
                        {movement.expiry_date ? `Expiry ${formatDateOnly(movement.expiry_date, '')}` : 'No expiry'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${typeStyles[movement.type] || 'bg-slate-100 text-slate-700'}`}>
                        {movement.type}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-4 text-right text-sm font-semibold ${
                      movement.type === 'in' ? 'text-emerald-700' : movement.type === 'out' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : ''}{movement.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-blue-700">
                      {formatReference(movement)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {movement.notes || '—'}
                    </td>
                  </tr>
                ))}
                {!data.movements.length && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                      No stock movements found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Page {pagination.page} of {pagination.pages} • Showing up to {pagination.limit} records per page
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            disabled={loading || pagination.page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
            onClick={() => setPage((current) => Math.min(current + 1, pagination.pages))}
            disabled={loading || pagination.page >= pagination.pages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockHistory;
