const sections = [
  {
    title: 'Before You Start',
    steps: [
      'Log in using the account given to you.',
      'Check the dashboard for low stock alerts, expiring items, and today’s activity.',
      'If stock arrived today, record it first in Receiving before using POS.'
    ]
  },
  {
    title: 'Daily Selling Flow',
    steps: [
      'Open POS from the sidebar.',
      'Search the product and click it to add it to the cart.',
      'Review the quantity and total amount before checkout.',
      'Click Checkout, confirm the sale, then print the receipt if needed.'
    ]
  },
  {
    title: 'Adding A Product First',
    steps: [
      'You may add a product in Products even if there is no stock yet.',
      'Adding a product only creates the product in the catalog. It does not add inventory.',
      'The product becomes sellable only after stock is received and a batch is created.'
    ]
  },
  {
    title: 'When New Stock Arrives',
    steps: [
      'Open Receiving.',
      'Choose the supplier, then enter the delivery receipt or invoice number.',
      'Add all delivered products, quantity, batch number, expiry, and cost price.',
      'Save the receiving entry. The batches will be created automatically.'
    ]
  },
  {
    title: 'If a Customer Returns an Item',
    steps: [
      'Open Sales.',
      'Find the sale, then open Details.',
      'Enter the returned quantity for the correct product line.',
      'Add the reason, then process the return.'
    ]
  },
  {
    title: 'If a Whole Sale Needs to Be Cancelled',
    steps: [
      'Open Sales.',
      'Find the transaction.',
      'Use Void Sale only if the whole sale should be cancelled, not just one product.',
      'After voiding, the stock is returned to inventory.'
    ]
  },
  {
    title: 'Checking Inventory',
    steps: [
      'Open Products to see the product list and selling prices.',
      'Open Batches to check batch numbers, expiry dates, and remaining stock.',
      'Open Stock History if you need to trace stock in, stock out, returns, voids, or adjustments.'
    ]
  },
  {
    title: 'Backup Reminder',
    steps: [
      'The system can create automatic backups if the backend is running.',
      'It is still good practice to export a backup at the end of the day.',
      'Before restoring a backup, make sure you really want to replace the current data.'
    ]
  }
];

const quickTips = [
  'Use Receiving for new deliveries. Do not manually re-encode the same stock in Batches unless it is a special correction.',
  'Use Return if only some products are being brought back. Use Void Sale only for cancelling the whole transaction.',
  'If you see warnings about low stock or expiry, check them early before they affect selling.'
];

const Manual = () => {
  return (
    <div className="space-y-5">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Quick Guide</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">How To Use PharmaDesk</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          This page is for daily use. Follow the steps below if you are selling, receiving stock,
          checking inventory, or handling returns. Keep it simple: receive stock first, sell through POS,
          then check Sales or Stock History if you need to trace anything.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {sections.map((section, index) => (
            <section key={section.title} className="card">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-semibold text-blue-700">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {section.steps.map((step, stepIndex) => (
                      <li key={step} className="flex gap-3">
                        <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          {stepIndex + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="card border border-emerald-200 bg-emerald-50/70">
            <h2 className="text-lg font-semibold text-emerald-900">Easy Reminders</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-emerald-900/80">
              {quickTips.map((tip) => (
                <li key={tip} className="rounded-xl bg-white/70 px-3 py-3">
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="card border border-amber-200 bg-amber-50/70">
            <h2 className="text-lg font-semibold text-amber-900">If Something Looks Wrong</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/80">
              <li>Check Sales first if the issue is about a transaction.</li>
              <li>Check Batches or Stock History if the issue is about inventory.</li>
              <li>Ask an admin before restoring a backup, because restore replaces current data.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Manual;
