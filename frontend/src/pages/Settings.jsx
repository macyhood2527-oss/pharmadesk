import { useEffect, useRef, useState } from 'react';
import api from '../services/api.js';

const summaryGroups = [
  {
    title: 'Key Totals',
    columns: 3,
    items: [
      { key: 'products', label: 'Products' },
      { key: 'product_batches', label: 'Batches' },
      { key: 'sales', label: 'Sales' },
      { key: 'returns', label: 'Returns' },
      { key: 'suppliers', label: 'Suppliers' },
      { key: 'users', label: 'Users' }
    ]
  },
  {
    title: 'Inventory',
    columns: 3,
    items: [
      { key: 'products', label: 'Products' },
      { key: 'product_batches', label: 'Batches' },
      { key: 'suppliers', label: 'Suppliers' },
      { key: 'categories', label: 'Categories' }
    ]
  },
  {
    title: 'Transactions',
    columns: 3,
    items: [
      { key: 'sales', label: 'Sales' },
      { key: 'sale_items', label: 'Sold Line Items' },
      { key: 'returns', label: 'Returns' },
      { key: 'return_items', label: 'Returned Line Items' }
    ]
  },
  {
    title: 'Receiving And Audit',
    columns: 3,
    items: [
      { key: 'purchase_receipts', label: 'Receiving Records' },
      { key: 'purchase_receipt_items', label: 'Received Items' },
      { key: 'stock_movements', label: 'Stock History Records' }
    ]
  }
];

const Settings = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const loadSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/settings/summary');
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to load settings summary', err);
      setError('Failed to load settings summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const response = await api.get('/settings/export');
      const fileName = `pharmadesk-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup exported successfully.');
    } catch (err) {
      console.error('Failed to export backup', err);
      setError('Failed to export backup.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || parsed.app !== 'PharmaDesk' || !parsed.tables || typeof parsed.tables !== 'object') {
        throw new Error('Invalid backup file.');
      }

      const counts = parsed.counts || Object.fromEntries(
        Object.entries(parsed.tables).map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0])
      );

      setPendingImport({
        fileName: file.name,
        payload: parsed,
        exportVersion: parsed.export_version ?? 'Unknown',
        exportedAt: parsed.exported_at || null,
        counts
      });
      setRestoreConfirmation('');
    } catch (err) {
      console.error('Failed to import backup', err);
      setError(err.message || 'Failed to read backup file.');
      event.target.value = '';
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;

    setImporting(true);
    setError('');
    setMessage('');

    try {
      await api.post('/settings/import', {
        ...pendingImport.payload,
        confirm_restore: restoreConfirmation
      });
      setMessage('Backup imported successfully. Refresh the page or re-login if data changed significantly.');
      setPendingImport(null);
      setRestoreConfirmation('');
      await loadSummary();
    } catch (err) {
      console.error('Failed to import backup', err);
      const responseMessage = err.response?.data?.error;
      setError(responseMessage || 'Failed to import backup.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-600">Backup, restore, and review database contents.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Export Data</h2>
            <p className="mt-1 text-sm text-gray-600">
              Download a full JSON backup of the current app data.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export Backup'}
          </button>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Data</h2>
            <p className="mt-1 text-sm text-gray-600">
              Restore from a previously exported JSON backup.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            onClick={handleImportClick}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import Backup'}
          </button>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Warning: importing will replace the current data in the app.
          </div>
        </div>
      </div>

      {pendingImport && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Preview</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review this backup before replacing the current database.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p><span className="font-medium text-slate-900">File:</span> {pendingImport.fileName}</p>
            <p><span className="font-medium text-slate-900">App:</span> PharmaDesk</p>
            <p><span className="font-medium text-slate-900">Export Version:</span> {pendingImport.exportVersion}</p>
            <p>
              <span className="font-medium text-slate-900">Exported At:</span>{' '}
              {pendingImport.exportedAt ? new Date(pendingImport.exportedAt).toLocaleString() : 'Unknown'}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Backup Contents</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(pendingImport.counts).map(([name, count]) => (
                <div key={name} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name.replace(/_/g, ' ')}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Importing this backup will overwrite the current live data in the app.
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Type <span className="font-semibold text-slate-900">RESTORE</span> to confirm full data replacement
            </label>
            <input
              type="text"
              value={restoreConfirmation}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="RESTORE"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              onClick={confirmImport}
              disabled={importing || restoreConfirmation !== 'RESTORE'}
            >
              {importing ? 'Importing...' : 'Confirm Import'}
            </button>
            <button
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
              onClick={() => {
                setPendingImport(null);
                setRestoreConfirmation('');
              }}
              disabled={importing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Data Summary</h2>
          <p className="mt-1 text-sm text-gray-600">Grouped record counts for the current database.</p>
        </div>

        {summary?.backups && (
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto Backup</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.backups.auto_backup_enabled ? summary.backups.auto_backup_time : 'Disabled'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Backup Files</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.backups.total_files}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retention</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.backups.keep_latest}</p>
            </div>
          </div>
        )}

        {summary?.backups?.latest && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Latest Backup:</span> {summary.backups.latest.fileName}
            </p>
            <p>
              <span className="font-medium text-slate-900">Modified:</span>{' '}
              {new Date(summary.backups.latest.modifiedAt).toLocaleString()}
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading summary...</div>
        ) : summary ? (
          <div className="space-y-5">
            {summaryGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{group.title}</h3>
                </div>
                <div className={`grid gap-3 ${group.columns === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
                  {group.items.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{summary.counts[item.key] ?? 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Settings;
