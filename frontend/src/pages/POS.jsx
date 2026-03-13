import { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';
import { parseDateOnlyToLocalTime } from '../utils/dates.js';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const isBatchSellable = (batch) => {
  if (!batch || batch.qty_remaining <= 0) return false;
  if (!batch.expiry_date) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = parseDateOnlyToLocalTime(batch.expiry_date);
  expiryDate.setHours(0, 0, 0, 0);

  return expiryDate >= today;
};

const sortBatchesForFifo = (a, b) => {
  const expiryA = a.expiry_date ? parseDateOnlyToLocalTime(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
  const expiryB = b.expiry_date ? parseDateOnlyToLocalTime(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;

  if (expiryA !== expiryB) return expiryA - expiryB;
  return new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
};

const POS = () => {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  const getSellableBatches = useCallback((productId) => (
    batches
      .filter((batch) => batch.product_id === productId && isBatchSellable(batch))
      .sort(sortBatchesForFifo)
  ), [batches]);

  useEffect(() => {
    Promise.all([
      api.get('/products?limit=100'),
      api.get('/batches')
    ]).then(([productsRes, batchesRes]) => {
      setProducts(productsRes.data.products);
      setFilteredProducts(productsRes.data.products);
      setBatches(batchesRes.data.batches || []);
    }).catch((err) => {
      console.error('Failed to load POS data', err);
      setError('Failed to load POS data.');
    });
  }, []);

  useEffect(() => {
    const sellableProducts = products.filter((product) => getSellableBatches(product.id).length > 0);

    if (!search) {
      setFilteredProducts(sellableProducts);
      return;
    }

    const lowerSearch = search.toLowerCase();
    setFilteredProducts(sellableProducts.filter((product) =>
      product.name.toLowerCase().includes(lowerSearch) ||
      product.sku?.toLowerCase().includes(lowerSearch) ||
      product.barcode?.toLowerCase().includes(lowerSearch)
    ));
  }, [search, products, getSellableBatches]);

  const addToCart = useCallback((product) => {
    const sellableBatches = getSellableBatches(product.id);
    const availableStock = sellableBatches.reduce((sum, batch) => sum + batch.qty_remaining, 0);

    if (availableStock <= 0) return;

    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= availableStock) return;

      setCart(cart.map((item) => (
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              available_stock: availableStock,
              next_batch_no: sellableBatches[0]?.batch_no || null
            }
          : item
      )));
      return;
    }

    setCart([
      ...cart,
      {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        price: product.selling_price,
        quantity: 1,
        available_stock: availableStock,
        next_batch_no: sellableBatches[0]?.batch_no || null
      }
    ]);
  }, [cart, getSellableBatches]);

  const updateQuantity = (productId, delta) => {
    setCart(cart.map((item) => {
      if (item.product_id !== productId) return item;

      const newQty = Math.max(0, Math.min(item.available_stock, item.quantity + delta));
      return newQty > 0 ? { ...item, quantity: newQty } : null;
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const getTotal = () => cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/sales/checkout', {
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      });
      setReceipt(response.data.receipt);
      setCart([]);
    } catch (checkoutError) {
      const validationMessage = checkoutError.response?.data?.errors?.[0]?.msg;
      const message = checkoutError.response?.data?.error || validationMessage || 'Checkout failed';
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;

    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) {
      setError('Please allow pop-ups to print the receipt.');
      return;
    }

    const itemsMarkup = receipt.items.map((item) => `
      <tr>
        <td>${item.product_name} x${item.quantity}${item.batch_no ? ` (${item.batch_no})` : ''}</td>
        <td style="text-align:right;">${formatPeso(item.total_price)}</td>
      </tr>
    `).join('');

    const receiptDate = receipt.created_at
      ? new Date(receipt.created_at).toLocaleString()
      : new Date().toLocaleString();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${receipt.sale_id}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 24px;
              color: #0f172a;
            }
            h1, p { margin: 0; }
            .header, .total {
              margin-bottom: 16px;
            }
            .muted {
              color: #64748b;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
            }
            td {
              padding: 8px 0;
              border-bottom: 1px solid #e2e8f0;
              font-size: 14px;
            }
            .total {
              display: flex;
              justify-content: space-between;
              font-weight: 700;
              font-size: 18px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PharmaDesk</h1>
            <p class="muted">Receipt #${receipt.sale_id}</p>
            <p class="muted">${receiptDate}</p>
          </div>
          <table>
            <tbody>${itemsMarkup}</tbody>
          </table>
          <div class="total">
            <span>Total</span>
            <span>${formatPeso(receipt.total_amount)}</span>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 xl:col-span-2">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name, SKU, barcode..."
            className="w-full rounded-xl border border-gray-300 py-3 pl-12 pr-4 text-base shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid max-h-[calc(100vh-14rem)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-2">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              batches={getSellableBatches(product.id)}
              onAdd={addToCart}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card min-h-[360px] overflow-y-auto">
          <h3 className="mb-4 flex items-center text-lg font-semibold">
            <ShoppingCartIcon className="mr-2 h-5 w-5" />
            Cart ({cart.length})
          </h3>

          <div className="space-y-3">
            {cart.map((item) => (
              <CartItem key={item.product_id} item={item} onUpdate={updateQuantity} onRemove={removeFromCart} />
            ))}
          </div>

          {cart.length === 0 && (
            <div className="py-10 text-center text-gray-500">
              <ShoppingCartIcon className="mx-auto mb-3 h-14 w-14 opacity-25" />
              <p className="text-base">Cart is empty</p>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="flex justify-between text-xl font-bold">
            <span>Total:</span>
            <span>{formatPeso(getTotal())}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              className="flex items-center justify-center space-x-2 rounded-xl bg-gray-100 p-3 text-base font-medium text-gray-900 transition-all hover:bg-gray-200"
              onClick={() => cart.length > 0 && handleCheckout()}
              disabled={loading || cart.length === 0}
            >
              <CreditCardIcon className="h-6 w-6" />
              <span>Checkout</span>
            </button>

            <button
              className="flex items-center justify-center space-x-2 rounded-xl bg-blue-600 p-3 text-base font-bold text-white transition-all hover:bg-blue-700"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
            >
              <TrashIcon className="h-6 w-6" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-6 text-center">
              <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Sale Complete!</h2>
              <p className="font-medium text-green-700">Receipt #{receipt.sale_id}</p>
            </div>

            <div className="mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Date:</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total:</span>
                <span>{formatPeso(receipt.total_amount)}</span>
              </div>
            </div>

            <div className="mb-6 space-y-1 text-xs">
              <p><strong>Items:</strong></p>
              {receipt.items.map((item, i) => (
                <p key={i} className="flex justify-between py-1">
                  <span>
                    {item.product_name} x{item.quantity}
                    {item.batch_no ? ` (${item.batch_no})` : ''}
                  </span>
                  <span>{formatPeso(item.total_price)}</span>
                </p>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 py-3 text-lg"
                onClick={() => setReceipt(null)}
              >
                New Sale
              </button>
              <button
                className="flex-1 rounded-xl bg-gray-100 px-6 py-3 text-lg font-medium text-gray-900 transition-colors hover:bg-gray-200"
                onClick={handlePrintReceipt}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductCard = ({ product, batches, onAdd }) => {
  const nextBatch = batches[0] || null;
  const availableStock = batches.reduce((sum, batch) => sum + batch.qty_remaining, 0);

  return (
    <div className="card group cursor-pointer border-2 border-transparent p-4 transition-all hover:border-blue-200 hover:shadow-lg">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <h4 className="mb-1 text-lg font-semibold leading-tight">{product.name}</h4>
          <p className="mb-1 text-xs text-gray-500">{product.sku || 'No SKU'}</p>
          {availableStock === 0 ? (
            <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
              Out of Stock / Expired
            </span>
          ) : (
            <p className="text-xs text-gray-500">FIFO batch: {nextBatch?.batch_no || 'N/A'}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">{formatPeso(product.selling_price)}</p>
          <p className="text-sm text-gray-500">{availableStock} sellable stock</p>
        </div>
      </div>

      <button
        className="flex w-full items-center justify-center space-x-2 rounded-xl bg-blue-600 px-4 py-3 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onAdd(product)}
        disabled={!nextBatch || availableStock === 0}
      >
        <PlusIcon className="h-5 w-5" />
        <span>Add</span>
      </button>
    </div>
  );
};

const CartItem = ({ item, onUpdate, onRemove }) => (
  <div className="group flex items-center space-x-3 rounded-xl bg-gray-50 p-3">
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium text-gray-900">{item.product_name}</p>
      <p className="text-sm text-gray-500">{item.sku} • Next FIFO: {item.next_batch_no || 'N/A'}</p>
    </div>

    <div className="flex items-center space-x-2">
      <div className="flex items-center rounded-lg border bg-white px-3 py-1">
        <button
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onUpdate(item.product_id, -1)}
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <span className="mx-3 min-w-[2rem] text-center font-semibold">{item.quantity}</span>
        <button
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onUpdate(item.product_id, 1)}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold">{formatPeso(item.quantity * item.price)}</p>
        <p className="text-xs text-gray-500">{formatPeso(item.price)} each</p>
      </div>
    </div>

    <button
      className="-m-2 rounded-xl p-2 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
      onClick={() => onRemove(item.product_id)}
      title="Remove"
    >
      <TrashIcon className="h-5 w-5" />
    </button>
  </div>
);

export default POS;
