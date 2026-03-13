import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';

const PERIOD_OPTIONS = [
  { label: 'Daily', days: 1 },
  { label: 'Weekly', days: 7 },
  { label: 'Monthly', days: 30 }
];

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const formatDateLabel = (value) => {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const Reports = () => {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState({
    start_date: '',
    end_date: '',
    transactions: 0,
    gross_sales: 0,
    returns_amount: 0,
    net_sales: 0,
    net_cost: 0,
    gross_profit: 0,
    avg_sale: 0,
    void_count: 0,
    void_amount: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError('');
      try {
        const [summaryRes, topProductsRes, lowStockRes, returnsRes] = await Promise.all([
          api.get(`/reports/summary?days=${days}`),
          api.get(`/reports/top-products?days=${days}`),
          api.get('/reports/low-stock'),
          api.get(`/reports/returns?days=${days}`)
        ]);
        setSummary(summaryRes.data);
        setTopProducts(topProductsRes.data);
        setLowStock(lowStockRes.data);
        setReturns(returnsRes.data);
      } catch (err) {
        console.error('Failed to load reports', err);
        setError('Failed to load reports.');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [days]);

  const selectedPeriod = PERIOD_OPTIONS.find((option) => option.days === days) || PERIOD_OPTIONS[1];
  const reportRangeLabel = summary.start_date && summary.end_date
    ? `${formatDateLabel(summary.start_date)} to ${formatDateLabel(summary.end_date)}`
    : 'Current period';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=960,height=900');
    if (!printWindow) return;

    const metricRows = [
      ['Transactions', summary.transactions || 0],
      ['Gross Sales', formatPeso(summary.gross_sales)],
      ['Returns', formatPeso(summary.returns_amount)],
      ['Net Sales', formatPeso(summary.net_sales)],
      ['Net Cost', formatPeso(summary.net_cost)],
      ['Gross Profit', formatPeso(summary.gross_profit)],
      ['Voids', `${summary.void_count || 0} / ${formatPeso(summary.void_amount)}`],
      ['Average Net Sale', formatPeso(summary.avg_sale)]
    ];

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedPeriod.label)} Report</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: "Times New Roman", Georgia, serif; margin: 0; background: #f4f1ea; color: #111827; }
            h1, h2, h3, p { margin: 0; }
            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              background: #fffdf8;
              box-sizing: border-box;
              padding: 10mm;
            }
            .masthead {
              border-bottom: 2px solid #1f2937;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .eyebrow {
              font-size: 9px;
              letter-spacing: 0.24em;
              text-transform: uppercase;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .masthead h1 {
              font-size: 22px;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }
            .masthead p {
              margin-top: 2px;
              font-size: 11px;
              color: #4b5563;
            }
            .info-grid {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 10px;
            }
            .info-grid td {
              border: 1px solid #d1d5db;
              padding: 5px 7px;
              width: 25%;
            }
            .info-grid .label {
              display: block;
              font-size: 8px;
              text-transform: uppercase;
              letter-spacing: 0.14em;
              color: #6b7280;
              margin-bottom: 2px;
            }
            .summary-title {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.14em;
              margin: 12px 0 6px;
            }
            .summary-table,
            .report-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            .summary-table th,
            .summary-table td,
            .report-table th,
            .report-table td {
              border: 1px solid #9ca3af;
              padding: 5px 6px;
              vertical-align: top;
            }
            .summary-table th,
            .report-table th {
              background: #f3f4f6;
              font-size: 8px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #374151;
            }
            .summary-table td.value {
              font-weight: 700;
              font-family: Arial, sans-serif;
            }
            .section {
              margin-top: 14px;
              page-break-inside: avoid;
            }
            .section h2 {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              margin-bottom: 6px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 4px;
            }
            .text-right { text-align: right; }
            .muted { color: #6b7280; }
            .signature-block {
              margin-top: 20px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 18px;
              font-size: 10px;
            }
            .signature-line {
              margin-top: 24px;
              border-top: 1px solid #111827;
              padding-top: 4px;
              text-align: center;
            }
            @media print {
              body { background: #fff; }
              .page {
                width: auto;
                min-height: auto;
                margin: 0;
                padding: 0;
                background: #fff;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="masthead">
              <div class="eyebrow">PharmaDesk Retail Console</div>
              <h1>${escapeHtml(selectedPeriod.label)} Sales Report</h1>
              <p>${escapeHtml(reportRangeLabel)}</p>
            </div>

            <table class="info-grid">
              <tr>
                <td>
                  <span class="label">Report Type</span>
                  ${escapeHtml(selectedPeriod.label)} Report
                </td>
                <td>
                  <span class="label">Covered Dates</span>
                  ${escapeHtml(reportRangeLabel)}
                </td>
                <td>
                  <span class="label">Printed On</span>
                  ${escapeHtml(new Date().toLocaleDateString())}
                </td>
                <td>
                  <span class="label">Printed Time</span>
                  ${escapeHtml(new Date().toLocaleTimeString())}
                </td>
              </tr>
            </table>

            <h2 class="summary-title">Financial Summary</h2>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                ${Array.from({ length: Math.ceil(metricRows.length / 2) }, (_, index) => {
                  const left = metricRows[index * 2];
                  const right = metricRows[index * 2 + 1];
                  return `
                    <tr>
                      <td>${escapeHtml(left?.[0] || '')}</td>
                      <td class="value">${escapeHtml(left?.[1] || '')}</td>
                      <td>${escapeHtml(right?.[0] || '')}</td>
                      <td class="value">${escapeHtml(right?.[1] || '')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="section">
              <h2>Top Products</h2>
              <table class="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="text-right">Sold</th>
                  <th class="text-right">Returned</th>
                  <th class="text-right">Net Qty</th>
                  <th class="text-right">Net Revenue</th>
                  <th class="text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody>
                ${topProducts.length ? topProducts.map((product) => `
                  <tr>
                    <td>${escapeHtml(product.name)}</td>
                    <td class="text-right">${escapeHtml(product.gross_qty)}</td>
                    <td class="text-right">${escapeHtml(product.returned_qty)}</td>
                    <td class="text-right">${escapeHtml(product.net_qty)}</td>
                    <td class="text-right">${escapeHtml(formatPeso(product.net_revenue))}</td>
                    <td class="text-right">${escapeHtml(formatPeso(product.gross_profit))}</td>
                  </tr>
                `).join('') : '<tr><td colspan="6">No sales data for this period.</td></tr>'}
              </tbody>
            </table>
            </div>

            <div class="section">
              <h2>Low Stock Items</h2>
              <table class="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th class="text-right">Current Stock</th>
                  <th class="text-right">Reorder Level</th>
                </tr>
              </thead>
              <tbody>
                ${lowStock.length ? lowStock.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.sku || '—')}</td>
                    <td class="text-right">${escapeHtml(item.current_stock)}</td>
                    <td class="text-right">${escapeHtml(item.reorder_level)}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4">No low stock items.</td></tr>'}
              </tbody>
            </table>
            </div>

            <div class="section">
              <h2>Return Details</h2>
              <table class="report-table">
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Sale</th>
                  <th>Product</th>
                  <th>Batch</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Amount</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${returns.length ? returns.map((item) => `
                  <tr>
                    <td>#${escapeHtml(item.return_id)}</td>
                    <td>Sale #${escapeHtml(item.sale_id)}</td>
                    <td>${escapeHtml(item.product_name)}</td>
                    <td>${escapeHtml(item.batch_no || '—')}</td>
                    <td class="text-right">${escapeHtml(item.quantity)}</td>
                    <td class="text-right">${escapeHtml(formatPeso(item.total_price))}</td>
                    <td>${escapeHtml(item.notes || '—')}</td>
                    <td>${escapeHtml(formatDateTime(item.created_at))}</td>
                  </tr>
                `).join('') : '<tr><td colspan="8">No returns recorded for this period.</td></tr>'}
              </tbody>
            </table>
            </div>

            <div class="signature-block">
              <div>
                <div class="signature-line">Prepared by</div>
              </div>
              <div>
                <div class="signature-line">Checked by</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Business Report</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Reports</h1>
            <p className="mt-2 text-sm text-gray-600">
              Printable summary for {selectedPeriod.label.toLowerCase()} sales, returns, profit, and stock watch items.
            </p>
            <p className="mt-1 text-sm text-slate-500">{reportRangeLabel}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              onClick={handlePrint}
              disabled={loading}
            >
              Print Report
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
          <p className="text-sm text-slate-500">Quick business view for the selected period.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transactions</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{loading ? '...' : summary.transactions || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gross Sales</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{loading ? '...' : formatPeso(summary.gross_sales)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Net Sales</p>
            <p className="mt-2 text-2xl font-bold text-emerald-800">{loading ? '...' : formatPeso(summary.net_sales)}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Returns</p>
            <p className="mt-2 text-2xl font-bold text-amber-800">{loading ? '...' : formatPeso(summary.returns_amount)}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Voids</p>
            <p className="mt-2 text-2xl font-bold text-red-800">
              {loading ? '...' : `${summary.void_count || 0} / ${formatPeso(summary.void_amount)}`}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Gross Profit</p>
            <p className="mt-2 text-2xl font-bold text-blue-800">{loading ? '...' : formatPeso(summary.gross_profit)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="card overflow-hidden">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Top Products</h2>
            <p className="mt-1 text-sm text-slate-500">Best-performing products for the selected period.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Sold</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Returned</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Net Qty</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Net Cost</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Net Revenue</th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {topProducts.map((product) => (
                  <tr key={product.name} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{product.name}</td>
                    <td className="px-4 py-4 text-right text-sm text-gray-600">{product.gross_qty}</td>
                    <td className="px-4 py-4 text-right text-sm text-amber-700">{product.returned_qty}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">{product.net_qty}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-slate-700">{formatPeso(product.net_cost)}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-emerald-700">{formatPeso(product.net_revenue)}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-blue-700">{formatPeso(product.gross_profit)}</td>
                  </tr>
                ))}
                {!topProducts.length && !loading && (
                  <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-500">No sales data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Inventory Watch</h2>
              <p className="mt-1 text-sm text-slate-500">Items that may need attention soon.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                    <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">SKU</th>
                    <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
                    <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Reorder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lowStock.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-900">{item.name}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{item.sku || '—'}</td>
                      <td className="px-4 py-4 text-right text-sm font-medium text-red-600">{item.current_stock}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">{item.reorder_level}</td>
                    </tr>
                  ))}
                  {!lowStock.length && !loading && (
                    <tr><td colSpan="4" className="px-4 py-10 text-center text-gray-500">No low stock items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card border border-slate-200 bg-slate-50/70">
            <h3 className="text-lg font-semibold text-slate-900">Reading Guide</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p><span className="font-medium text-slate-900">Gross Sales</span> is the full sales amount before returns.</p>
              <p><span className="font-medium text-slate-900">Net Sales</span> is the amount after returns are deducted.</p>
              <p><span className="font-medium text-slate-900">Gross Profit</span> shows what remains after subtracting stock cost from net sales.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Returns Details</h2>
            <p className="mt-1 text-sm text-gray-500">
              Returned products, linked sale, processed by, and return reason.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Return</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sale</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Qty</th>
                <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cashier</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Processed By</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reason</th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {returns.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">#{item.return_id}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-blue-700">Sale #{item.sale_id}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div>{item.product_name}</div>
                    <div className="text-xs text-gray-500">{item.sku || 'No SKU'}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{item.batch_no || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-gray-700">{item.quantity}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium text-amber-700">{formatPeso(item.total_price)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{item.cashier_name || 'Unknown cashier'}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{item.processed_by || 'Unknown user'}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.notes || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!returns.length && !loading && (
                <tr>
                  <td colSpan="10" className="px-4 py-10 text-center text-gray-500">
                    No returns recorded in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
