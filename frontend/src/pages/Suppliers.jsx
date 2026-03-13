import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const initialForm = {
  name: '',
  contact: '',
  phone: '',
  email: '',
  address: ''
};

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const loadSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (err) {
      console.error('Failed to load suppliers', err);
      setError('Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/suppliers', formData);
      setFormData(initialForm);
      setShowAddSupplier(false);
      loadSuppliers();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to create supplier.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return [
      supplier.name,
      supplier.contact,
      supplier.phone,
      supplier.email,
      supplier.address
    ].some((value) => String(value || '').toLowerCase().includes(term));
  });

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
            <p className="mt-1 text-gray-600">{filteredSuppliers.length} suppliers</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddSupplier((current) => !current)}
          >
            {showAddSupplier ? 'Close Add Supplier' : 'Add Supplier'}
          </button>
        </div>

        {showAddSupplier && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Add Supplier</h2>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
              <div className="lg:col-span-2">
                <input className="w-full rounded-xl border border-gray-300 px-3 py-3" placeholder="Supplier name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <input className="w-full rounded-xl border border-gray-300 px-3 py-3" placeholder="Contact person" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
              <input className="w-full rounded-xl border border-gray-300 px-3 py-3" placeholder="Phone number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              <input className="w-full rounded-xl border border-gray-300 px-3 py-3 lg:col-span-2" type="email" placeholder="Email address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              <textarea className="w-full rounded-xl border border-gray-300 px-3 py-3 lg:col-span-2" rows="4" placeholder="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              <div className="lg:col-span-2 flex justify-end">
                <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Supplier'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-4">
          <div className="relative max-w-sm">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier, contact, phone..."
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Phone</th>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Batches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{supplier.contact || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{supplier.phone || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{supplier.email || '—'}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">{supplier.batch_count || 0}</td>
                  </tr>
                ))}
                {!filteredSuppliers.length && (
                  <tr>
                    <td colSpan="5" className="px-4 py-12 text-center text-gray-500">
                      No suppliers matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Suppliers;
