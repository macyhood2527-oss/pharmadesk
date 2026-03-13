import { useEffect, useState } from 'react';
import api from '../services/api.js';

const initialForm = {
  name: '',
  email: '',
  password: '',
  role: 'cashier'
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'cashier' });
  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users', err);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users', formData);
      setFormData(initialForm);
      loadUsers();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      name: user.name || '',
      role: user.role
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    setError('');
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const openPasswordModal = (user) => {
    setPasswordUser(user);
    setPasswordForm({ password: '', confirmPassword: '' });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.put(`/users/${passwordUser.id}/password`, { password: passwordForm.password });
      setPasswordUser(null);
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="card">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Add User</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input className="w-full rounded-xl border border-gray-300 px-3 py-3" placeholder="Full name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <input className="w-full rounded-xl border border-gray-300 px-3 py-3" type="email" placeholder="Email address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
            <input className="w-full rounded-xl border border-gray-300 px-3 py-3" type="password" placeholder="Password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
            <select className="w-full rounded-xl border border-gray-300 px-3 py-3" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Create User'}</button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Users</h1>
            <p className="mt-1 text-gray-600">{users.length} user accounts</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                    <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{user.name || '—'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-4 text-sm capitalize text-gray-600">{user.role}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                            onClick={() => openEditModal(user)}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                            onClick={() => openPasswordModal(user)}
                          >
                            Change Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
              <p className="mt-1 text-sm text-gray-600">{editingUser.email}</p>
            </div>

            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                type="email"
                placeholder="Email address"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                placeholder="Full name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <select
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>

              <div className="flex gap-3 pt-2">
                <button className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  onClick={() => setEditingUser(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
              <p className="mt-1 text-sm text-gray-600">{passwordUser.email}</p>
            </div>

            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                type="password"
                placeholder="New password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                required
              />
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />

              <div className="flex gap-3 pt-2">
                <button className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  onClick={() => setPasswordUser(null)}
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

export default Users;
