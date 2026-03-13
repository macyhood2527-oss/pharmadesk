import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';
import { formatDateOnly } from '../utils/dates.js';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const initialForm = {
  product_id: '',
  product_name: '',
  supplier_id: '',
  batch_no: '',
  expiry_date: '',
  cost_price: '',
  qty_received: ''
};

const Batches = () => {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [nearExpiryOnly, setNearExpiryOnly] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [adjustingBatch, setAdjustingBatch] = useState(null);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantity_delta: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const batchParams = new URLSearchParams({
        page: String(page),
        limit: '10'
      });
      if (search) batchParams.set('search', search);
      if (supplierFilter !== 'all') batchParams.set('supplier_id', supplierFilter);
      if (nearExpiryOnly) batchParams.set('near_expiry', 'true');

      const [batchesRes, productsRes, suppliersRes] = await Promise.all([
        api.get(`/batches?${batchParams.toString()}`),
        api.get('/products?limit=100'),
        api.get('/suppliers')
      ]);
      setBatches(batchesRes.data.batches);
      setPagination(batchesRes.data.pagination);
      setProducts(productsRes.data.products);
      setSuppliers(suppliersRes.data);
    } catch (err) {
      console.error('Failed to load batches', err);
      setError('Failed to load batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, supplierFilter, nearExpiryOnly]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, supplierFilter, nearExpiryOnly]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/batches', {
        product_id: Number(formData.product_id),
        supplier_id: Number(formData.supplier_id),
        batch_no: formData.batch_no,
        expiry_date: formData.expiry_date || null,
        cost_price: Number(formData.cost_price || 0),
        qty_received: Number(formData.qty_received)
      });
      setFormData(initialForm);
      setShowAddBatch(false);
      loadData();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to create batch.');
    } finally {
      setSaving(false);
    }
  };

  const matchingProducts = formData.product_name
    ? products.filter((product) => product.name.toLowerCase().includes(formData.product_name.toLowerCase())).slice(0, 8)
    : products.slice(0, 8);

  const selectedProductValid = formData.product_id !== '' && products.some((product) => String(product.id) === String(formData.product_id));

  const handleProductInputChange = (value) => {
    const exactMatch = products.find((product) => product.name.toLowerCase() === value.toLowerCase());
    setFormData({
      ...formData,
      product_name: value,
      product_id: exactMatch ? String(exactMatch.id) : ''
    });
  };

  const handleProductSelect = (product) => {
    setFormData({
      ...formData,
      product_id: String(product.id),
      product_name: product.name
    });
  };

  const openAdjustmentModal = (batch) => {
    setAdjustingBatch(batch);
    setAdjustmentForm({
      quantity_delta: '',
      notes: ''
    });
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustingBatch) return;

    setSaving(true);
    setError('');
    try {
      await api.post(`/batches/${adjustingBatch.id}/adjust`, {
        quantity_delta: Number(adjustmentForm.quantity_delta),
        notes: adjustmentForm.notes
      });
      setAdjustingBatch(null);
      setAdjustmentForm({ quantity_delta: '', notes: '' });
      loadData();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to adjust stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Batches</h1>
            <p className="mt-1 text-gray-600">
              {loading ? 'Loading batches...' : `${pagination.total} active batches`}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddBatch((current) => !current)}
          >
            {showAddBatch ? 'Close Add Batch' : 'Add Batch'}
          </button>
        </div>

        {showAddBatch && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Add Batch</h2>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Product</label>
                <input
                  className="w-full rounded-xl border border-gray-300 px-3 py-3"
                  type="text"
                  list="batch-product-options"
                  placeholder="Type product name"
                  value={formData.product_name}
                  onChange={(e) => handleProductInputChange(e.target.value)}
                  required
                />
                <datalist id="batch-product-options">
                  {matchingProducts.map((product) => (
                    <option key={product.id} value={product.name} />
                  ))}
                </datalist>
                {formData.product_name && !selectedProductValid && (
                  <p className="mt-2 text-sm text-red-600">
                    Invalid product. If you want to add a new product, please go to the Products tab first.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Supplier</label>
                <select className="w-full rounded-xl border border-gray-300 px-3 py-3" value={formData.supplier_id} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}>
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                {!formData.supplier_id && (
                  <p className="mt-2 text-sm text-red-600">Please select a supplier before saving the batch.</p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Batch Number</label>
                <input className="w-full rounded-xl border border-gray-300 px-3 py-3" placeholder="Batch number" value={formData.batch_no} onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Expiry Date</label>
                <input className="w-full rounded-xl border border-gray-300 px-3 py-3" type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Cost Price</label>
                <input className="w-full rounded-xl border border-gray-300 px-3 py-3" type="number" step="0.01" placeholder="Cost price" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Quantity Received</label>
                <input className="w-full rounded-xl border border-gray-300 px-3 py-3" type="number" min="1" placeholder="Quantity received" value={formData.qty_received} onChange={(e) => setFormData({ ...formData, qty_received: e.target.value })} required />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <button className="btn-primary" disabled={saving || !selectedProductValid || !formData.supplier_id}>
                  {saving ? 'Saving...' : 'Add Batch'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search product, batch, supplier..."
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={nearExpiryOnly}
                onChange={(e) => setNearExpiryOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Near expiry only
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Supplier</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Expiry</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Qty</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cost</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{batch.product_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{batch.batch_no}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{batch.supplier_name || 'Unassigned'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDateOnly(batch.expiry_date)}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">{batch.qty_remaining}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">{formatPeso(batch.cost_price)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                        onClick={() => openAdjustmentModal(batch)}
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                ))}
                {!batches.length && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                      No batches matched the selected filters.
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
          Page {pagination.page} of {pagination.pages} • Showing up to {pagination.limit} batches per page
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

      {adjustingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-gray-900">Adjust Stock</h2>
              <p className="mt-1 text-sm text-gray-600">
                {adjustingBatch.product_name} • {adjustingBatch.batch_no}
              </p>
              <p className="text-sm text-gray-500">Current qty: {adjustingBatch.qty_remaining}</p>
            </div>

            <form className="space-y-4" onSubmit={handleAdjustmentSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Quantity Change</label>
                <input
                  className="w-full rounded-xl border border-gray-300 px-3 py-3"
                  type="number"
                  placeholder="Use negative for deduction, positive for addition"
                  value={adjustmentForm.quantity_delta}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity_delta: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Reason</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 px-3 py-3"
                  rows="3"
                  placeholder="Example: Damaged stock, physical count correction, expired items"
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Adjustment'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  onClick={() => setAdjustingBatch(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;
