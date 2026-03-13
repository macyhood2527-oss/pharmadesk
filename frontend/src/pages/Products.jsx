import { useState, useEffect } from 'react';
import api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    generic_name: '',
    brand_name: '',
    dosage_form: '',
    unit: '',
    selling_price: '',
    reorder_level: 10
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const loadProducts = async (searchQuery = '', pageNumber = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        limit: '20',
        page: String(pageNumber)
      });
      const productsRes = await api.get(`/products?${params}`);
      setProducts(productsRes.data.products);
      setPagination(productsRes.data.pagination);
    } catch (err) {
      console.error('Failed to load products', err);
      setError('Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(search, page);
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...formData,
        selling_price: Number(formData.selling_price),
        reorder_level: Number(formData.reorder_level)
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', sku: '', barcode: '', generic_name: '', brand_name: '', dosage_form: '', unit: '', selling_price: '', reorder_level: 10 });
      loadProducts(search, page);
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      const message = err.response?.data?.error || validationMessage || 'Operation failed';
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const editProduct = (product) => {
    setFormData({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      generic_name: product.generic_name || '',
      brand_name: product.brand_name || '',
      dosage_form: product.dosage_form || '',
      unit: product.unit || '',
      selling_price: product.selling_price,
      reorder_level: product.reorder_level
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const deleteProduct = async (id) => {
    if (confirm('Deactivate this product?')) {
      try {
        await api.delete(`/products/${id}`);
        loadProducts(search, page);
      } catch (err) {
        alert('Delete failed');
      }
    }
  };

  const getMarkupAmount = (product) => {
    const cost = Number(product.latest_cost_price || 0);
    const retail = Number(product.selling_price || 0);
    return retail - cost;
  };

  const getMarkupPercent = (product) => {
    const cost = Number(product.latest_cost_price || 0);
    const retail = Number(product.selling_price || 0);
    if (cost <= 0) return null;
    return ((retail - cost) / cost) * 100;
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header & Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-gray-600">
            {loading ? 'Loading products...' : `${pagination.total} products`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-80">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full rounded-xl border border-gray-300 py-3 pl-12 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({ name: '', sku: '', barcode: '', generic_name: '', brand_name: '', dosage_form: '', unit: '', selling_price: '', reorder_level: 10 });
            }}
            className="flex items-center justify-center space-x-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white shadow-sm transition-all hover:bg-blue-700 whitespace-nowrap"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Paracetamol 500mg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    placeholder="PARA-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barcode</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.barcode}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                    placeholder="1234567890123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selling Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({...formData, selling_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reorder Level</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({...formData, reorder_level: parseInt(e.target.value) || 10})}
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Generic Name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.generic_name}
                  onChange={(e) => setFormData({...formData, generic_name: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Brand Name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.brand_name}
                  onChange={(e) => setFormData({...formData, brand_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Dosage Form"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.dosage_form}
                  onChange={(e) => setFormData({...formData, dosage_form: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Unit"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-blue-600 px-8 py-3 text-lg font-bold text-white transition-all hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? 'Saving...' : (editingId ? 'Update Product' : 'Add Product')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl bg-gray-200 px-8 py-3 font-medium text-gray-900 transition-all hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Brand</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Dosage</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">SKU</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Retail</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Supplier Cost</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Markup</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reorder</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.generic_name}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {product.brand_name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {product.dosage_form || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      <span className="rounded bg-gray-50 px-2 py-1 font-mono text-xs">
                        {product.sku || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="text-lg font-semibold text-green-600">{formatPeso(product.selling_price)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {product.latest_cost_price != null ? formatPeso(product.latest_cost_price) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="text-sm font-semibold text-blue-700">{formatPeso(getMarkupAmount(product))}</div>
                      <div className="text-xs text-slate-500">
                        {getMarkupPercent(product) != null ? `${getMarkupPercent(product).toFixed(1)}%` : 'No cost yet'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={product.total_stock <= product.reorder_level ? 'text-red-600 font-semibold' : 'text-gray-900 font-medium'}>
                        {product.total_stock || 0}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">{product.reorder_level}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => editProduct(product)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg hover:shadow-sm transition-all"
                        title="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 hover:bg-red-100 text-red-600 rounded-lg hover:shadow-sm transition-all"
                        title="Deactivate"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                      <div className="text-lg mb-2">No products found</div>
                      <button
                        onClick={() => {
                          setShowForm(true);
                          setEditingId(null);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add first product
                      </button>
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
          Page {pagination.page} of {pagination.pages} • Showing up to {pagination.limit} products per page
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

export default Products;
