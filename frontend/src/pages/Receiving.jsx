import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';
import { formatDateOnly } from '../utils/dates.js';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const createItem = () => ({
  product_id: '',
  product_name: '',
  batch_no: '',
  expiry_date: '',
  cost_price: '',
  qty_received: ''
});

const initialForm = {
  supplier_id: '',
  reference_no: '',
  notes: '',
  items: [createItem()]
};

const createEditForm = (item, products) => {
  const product = products.find((entry) => String(entry.id) === String(item.product_id));

  return ({
  id: item.id,
  product_name: item.product_name,
  sku: item.sku,
  batch_no: item.batch_no || '',
  expiry_date: item.expiry_date || '',
  cost_price: String(item.cost_price ?? ''),
  qty_received: String(item.qty_received ?? ''),
  selling_price: Number(item.selling_price || product?.selling_price || 0)
  });
};

const Receiving = () => {
  const [receipts, setReceipts] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [receiptsRes, productsRes, suppliersRes] = await Promise.all([
        api.get(`/receiving?page=${page}&limit=10&search=${encodeURIComponent(search)}`),
        api.get('/products?limit=100'),
        api.get('/suppliers')
      ]);
      setReceipts(receiptsRes.data.receipts);
      setPagination(receiptsRes.data.pagination);
      setProducts(productsRes.data.products);
      setSuppliers(suppliersRes.data);
    } catch (err) {
      console.error('Failed to load receiving data', err);
      setError('Failed to load receiving data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const updateItem = (index, patch) => {
    setFormData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    }));
  };

  const handleProductInputChange = (index, value) => {
    const exactMatch = products.find((product) => product.name.toLowerCase() === value.toLowerCase());
    updateItem(index, {
      product_name: value,
      product_id: exactMatch ? String(exactMatch.id) : ''
    });
  };

  const addItemRow = () => {
    setFormData((current) => ({ ...current, items: [...current.items, createItem()] }));
  };

  const removeItemRow = (index) => {
    setFormData((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const hasInvalidProduct = formData.items.some((item) => item.product_name && !item.product_id);
  const hasCostWarning = formData.items.some((item) => {
    const product = products.find((entry) => String(entry.id) === String(item.product_id));
    const costPrice = Number(item.cost_price || 0);
    return product && costPrice > 0 && costPrice >= Number(product.selling_price || 0);
  });

  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm(createEditForm(item, products));
    setError('');
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/receiving', {
        supplier_id: Number(formData.supplier_id),
        reference_no: formData.reference_no,
        notes: formData.notes,
        items: formData.items.map((item) => ({
          product_id: Number(item.product_id),
          batch_no: item.batch_no,
          expiry_date: item.expiry_date || null,
          cost_price: Number(item.cost_price || 0),
          qty_received: Number(item.qty_received)
        }))
      });
      setFormData(initialForm);
      await loadData();
    } catch (err) {
      console.error('Failed to receive stock', err);
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to receive stock.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm) return;

    setSaving(true);
    setError('');
    try {
      await api.put(`/receiving/items/${editForm.id}`, {
        batch_no: editForm.batch_no,
        expiry_date: editForm.expiry_date || null,
        cost_price: Number(editForm.cost_price || 0),
        qty_received: Number(editForm.qty_received)
      });
      closeEditModal();
      await loadData();
    } catch (err) {
      console.error('Failed to update receipt item', err);
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to update receipt item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
        <div className="card">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Receive Stock</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <select
              className="w-full rounded-xl border border-gray-300 px-3 py-3"
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              required
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>

            <input
              className="w-full rounded-xl border border-gray-300 px-3 py-3"
              placeholder="Reference no. / DR / Invoice"
              value={formData.reference_no}
              onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
              required
            />

            <textarea
              className="w-full rounded-xl border border-gray-300 px-3 py-3"
              rows="3"
              placeholder="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Item {index + 1}</h3>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                      onClick={() => removeItemRow(index)}
                      disabled={formData.items.length === 1}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <input
                        className="w-full rounded-xl border border-gray-300 px-3 py-3"
                        type="text"
                        list={`receiving-product-options-${index}`}
                        placeholder="Type product name"
                        value={item.product_name}
                        onChange={(e) => handleProductInputChange(index, e.target.value)}
                        required
                      />
                      <datalist id={`receiving-product-options-${index}`}>
                        {products.map((product) => (
                          <option key={product.id} value={product.name} />
                        ))}
                      </datalist>
                      {item.product_name && !item.product_id && (
                        <p className="mt-2 text-sm text-red-600">
                          Invalid product. Add it in the Products tab first.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="w-full rounded-xl border border-gray-300 px-3 py-3"
                        placeholder="Batch number"
                        value={item.batch_no}
                        onChange={(e) => updateItem(index, { batch_no: e.target.value })}
                        required
                      />
                      <input
                        className="w-full rounded-xl border border-gray-300 px-3 py-3"
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => updateItem(index, { expiry_date: e.target.value })}
                      />
                      <input
                        className="w-full rounded-xl border border-gray-300 px-3 py-3"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Cost price"
                        value={item.cost_price}
                        onChange={(e) => updateItem(index, { cost_price: e.target.value })}
                        required
                      />
                      <input
                        className="w-full rounded-xl border border-gray-300 px-3 py-3"
                        type="number"
                        min="1"
                        placeholder="Qty received"
                        value={item.qty_received}
                        onChange={(e) => updateItem(index, { qty_received: e.target.value })}
                        required
                      />
                    </div>
                    {(() => {
                      const product = products.find((entry) => String(entry.id) === String(item.product_id));
                      const costPrice = Number(item.cost_price || 0);
                      if (!product || !costPrice || costPrice < Number(product.selling_price || 0)) return null;

                      return (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          Warning: cost price {formatPeso(costPrice)} is greater than or equal to selling price {formatPeso(product.selling_price)} for {product.name}.
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={addItemRow}
            >
              Add Another Item
            </button>

            <button className="btn-primary w-full" disabled={saving || hasInvalidProduct}>
              {saving ? 'Receiving...' : 'Save Receipt'}
            </button>
            {hasCostWarning && (
              <p className="text-sm text-amber-700">
                One or more items have a cost price that is greater than or equal to the current selling price.
              </p>
            )}
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Receiving</h1>
            <p className="mt-1 text-gray-600">{pagination.total} stock receipts</p>
          </div>

          <div className="mb-4">
            <div className="relative max-w-sm">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search reference, notes, supplier..."
                className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /></div>
          ) : (
            <div className="space-y-4">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{receipt.reference_no}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {receipt.supplier_name} • {new Date(receipt.received_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-500">
                        Received by: {receipt.received_by || 'Unknown user'}{receipt.notes ? ` • ${receipt.notes}` : ''}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600 lg:text-right">
                      <div>{receipt.items_count} item(s)</div>
                      <div>{receipt.total_units} unit(s)</div>
                      <div className="font-semibold text-slate-900">{formatPeso(receipt.total_cost)}</div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Expiry</th>
                          <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Qty</th>
                          <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cost</th>
                          <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {receipt.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-3 text-sm text-slate-900">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-slate-500">{item.sku || 'No SKU'}</div>
                            </td>
                            <td className="px-3 py-3 text-sm text-slate-600">{item.batch_no}</td>
                            <td className="px-3 py-3 text-sm text-slate-600">
                              {formatDateOnly(item.expiry_date)}
                            </td>
                            <td className="px-3 py-3 text-right text-sm text-slate-700">{item.qty_received}</td>
                            <td className="px-3 py-3 text-right text-sm font-medium text-slate-900">{formatPeso(item.cost_price)}</td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                                onClick={() => openEditModal(item)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {!receipts.length && (
                <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">
                  No receiving records yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Page {pagination.page} of {pagination.pages} • Showing up to {pagination.limit} receipts per page
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

      {editingItem && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-gray-900">Edit Receipt Item</h2>
              <p className="mt-1 text-sm text-gray-600">
                {editForm.product_name} {editForm.sku ? `• ${editForm.sku}` : ''}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Batch Number</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 px-3 py-3"
                    value={editForm.batch_no}
                    onChange={(e) => setEditForm((current) => ({ ...current, batch_no: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Expiry Date</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 px-3 py-3"
                    type="date"
                    value={editForm.expiry_date}
                    onChange={(e) => setEditForm((current) => ({ ...current, expiry_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Quantity Received</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 px-3 py-3"
                    type="number"
                    min="1"
                    value={editForm.qty_received}
                    onChange={(e) => setEditForm((current) => ({ ...current, qty_received: e.target.value }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Cost Price</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 px-3 py-3"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.cost_price}
                    onChange={(e) => setEditForm((current) => ({ ...current, cost_price: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {Number(editForm.cost_price || 0) >= Number(editForm.selling_price || 0) && Number(editForm.cost_price || 0) > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Warning: cost price {formatPeso(editForm.cost_price)} is greater than or equal to the current selling price {formatPeso(editForm.selling_price)}.
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Edit is allowed only while the batch has not yet been sold or manually adjusted.
              </div>

              <div className="flex gap-3 pt-2">
                <button className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  onClick={closeEditModal}
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

export default Receiving;
