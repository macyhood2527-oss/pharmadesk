import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [voidingId, setVoidingId] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnForm, setReturnForm] = useState({ notes: '', quantities: {} });
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const loadSales = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        limit: '10',
        search,
        status
      });
      const response = await api.get(`/sales?${params.toString()}`);
      setSales(response.data.sales);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to load sales', err);
      setError('Failed to load sales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [days, page, search, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [days, search, status]);

  const handleVoidSale = async (sale) => {
    const notes = window.prompt(`Void sale #${sale.id}.\nEnter a short reason:`, 'Customer cancellation');
    if (!notes) return;

    setVoidingId(sale.id);
    setError('');
    try {
      await api.post(`/sales/${sale.id}/void`, { notes });
      await loadSales();
    } catch (err) {
      console.error('Failed to void sale', err);
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to void sale.');
    } finally {
      setVoidingId(null);
    }
  };

  const openSaleDetails = async (saleId) => {
    setDetailsLoading(true);
    setError('');
    try {
      const response = await api.get(`/sales/${saleId}`);
      setSelectedSale(response.data);
      setReturnForm({ notes: '', quantities: {} });
    } catch (err) {
      console.error('Failed to load sale details', err);
      setError(err.response?.data?.error || 'Failed to load sale details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;

    const items = selectedSale.items
      .map((item) => ({
        sale_item_id: item.id,
        quantity: Number(returnForm.quantities[item.id] || 0)
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setError('Enter a return quantity for at least one item.');
      return;
    }

    setReturning(true);
    setError('');
    try {
      await api.post(`/sales/${selectedSale.id}/returns`, {
        items,
        notes: returnForm.notes
      });
      const [detailsRes] = await Promise.all([
        api.get(`/sales/${selectedSale.id}`),
        loadSales()
      ]);
      setSelectedSale(detailsRes.data);
      setReturnForm({ notes: '', quantities: {} });
    } catch (err) {
      console.error('Failed to process return', err);
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to process return.');
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="mt-1 text-gray-600">{pagination.total} recorded sales</p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 lg:w-72">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search receipt, cashier, payment..."
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All status</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
          </select>
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
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Receipt</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cashier</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Items</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Payment</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Gross</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cost</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Returned</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Net</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Profit</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">#{sale.id}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{sale.cashier_name || 'Unknown cashier'}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{sale.items_count || 0}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm capitalize text-gray-600">{sale.payment_method || 'cash'}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        sale.status === 'voided'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {sale.status || 'completed'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-gray-900">
                      {formatPeso(sale.total_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium text-slate-700">
                      {formatPeso(sale.net_cost)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium text-amber-700">
                      {formatPeso(sale.returned_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-emerald-700">
                      {formatPeso(sale.net_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-blue-700">
                      {formatPeso(sale.gross_profit)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                          onClick={() => openSaleDetails(sale.id)}
                        >
                          Details
                        </button>
                        {sale.status === 'voided' ? (
                          <span className="self-center text-xs text-gray-400">Already voided</span>
                        ) : (
                          <button
                            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                            onClick={() => handleVoidSale(sale)}
                            disabled={voidingId === sale.id}
                          >
                            {voidingId === sale.id ? 'Voiding...' : 'Void Sale'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan="12" className="px-4 py-12 text-center text-gray-500">
                      No sales found for this range.
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
          Page {pagination.page} of {pagination.pages} • Showing up to {pagination.limit} sales per page
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

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Sale #{selectedSale.id}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedSale.cashier_name || 'Unknown cashier'} • {new Date(selectedSale.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">
                  Status: {selectedSale.status} • Cost: {formatPeso(selectedSale.net_cost)} • Returned: {formatPeso(selectedSale.returned_amount)} • Net: {formatPeso(selectedSale.net_amount)} • Profit: {formatPeso(selectedSale.gross_profit)}
                </p>
              </div>
              <button
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                onClick={() => setSelectedSale(null)}
              >
                Close
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading sale details...</div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Sold</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cost</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Returned</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Profit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Return Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {selectedSale.items.map((item) => {
                        const maxReturnable = item.quantity - item.returned_quantity;
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-gray-500">{item.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.batch_no}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700">{formatPeso(item.total_cost - item.returned_cost)}</td>
                            <td className="px-4 py-3 text-right text-sm text-amber-700">{item.returned_quantity}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-blue-700">
                              {formatPeso((item.total_price - (item.returned_quantity * item.unit_price)) - (item.total_cost - item.returned_cost))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm"
                                type="number"
                                min="0"
                                max={maxReturnable}
                                value={returnForm.quantities[item.id] || ''}
                                onChange={(e) => setReturnForm({
                                  ...returnForm,
                                  quantities: {
                                    ...returnForm.quantities,
                                    [item.id]: e.target.value
                                  }
                                })}
                                disabled={selectedSale.status === 'voided' || maxReturnable <= 0}
                              />
                              <div className="mt-1 text-[11px] text-gray-400">Max {maxReturnable}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <form className="space-y-4" onSubmit={handleReturnSubmit}>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Return Reason</label>
                    <textarea
                      className="w-full rounded-xl border border-gray-300 px-3 py-3"
                      rows="3"
                      placeholder="Example: Wrong item dispensed, customer changed mind, damaged packaging"
                      value={returnForm.notes}
                      onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                      disabled={selectedSale.status === 'voided'}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-500">
                      {selectedSale.returns?.length ? `${selectedSale.returns.length} return record(s) already logged.` : 'No returns recorded yet.'}
                    </div>
                    <button
                      className="btn-primary"
                      disabled={returning || selectedSale.status === 'voided' || !returnForm.notes.trim()}
                    >
                      {returning ? 'Processing Return...' : 'Process Partial Return'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
