import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";

export default function OverviewTab({
  totalRevenue,
  totalCost,
  grossProfit,
  byStaff,
  topParts,
  outstandingCredit,
}: {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  byStaff: [string, number][];
  topParts: [string, { qty: number; revenue: number }][];
  outstandingCredit: { name: string; credit_balance: number }[];
}) {
  const currency = useCurrencySymbol();

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">Last 30 days</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Revenue</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currency}
            {totalRevenue.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Cost of Goods Sold</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currency}
            {totalCost.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Gross Profit</div>
          <div className="text-2xl font-bold text-green-700 mt-1">
            {currency}
            {grossProfit.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">Sales by Staff</div>
          <ul className="divide-y divide-slate-100">
            {byStaff.map(([name, total]) => (
              <li key={name} className="px-5 py-3 flex justify-between text-sm">
                <span className="text-slate-800">{name}</span>
                <span className="font-medium">
                  {currency}
                  {total.toFixed(2)}
                </span>
              </li>
            ))}
            {byStaff.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">No sales yet.</li>}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">Top Selling Parts</div>
          <ul className="divide-y divide-slate-100">
            {topParts.map(([name, d]) => (
              <li key={name} className="px-5 py-3 flex justify-between text-sm">
                <span className="text-slate-800">
                  {name} <span className="text-slate-400">x{d.qty}</span>
                </span>
                <span className="font-medium">
                  {currency}
                  {d.revenue.toFixed(2)}
                </span>
              </li>
            ))}
            {topParts.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">No sales yet.</li>}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
            Outstanding Customer Credit
          </div>
          <ul className="divide-y divide-slate-100">
            {outstandingCredit.map((c) => (
              <li key={c.name} className="px-5 py-3 flex justify-between text-sm">
                <span className="text-slate-800">{c.name}</span>
                <span className="font-medium text-red-600">
                  {currency}
                  {c.credit_balance.toFixed(2)}
                </span>
              </li>
            ))}
            {outstandingCredit.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-400">No outstanding balances.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
