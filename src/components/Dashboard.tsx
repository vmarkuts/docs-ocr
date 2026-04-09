"use client";

import { ParsedItem } from "@/app/page";
import { DollarSign, Package, User, TrendingDown, Trophy } from "lucide-react";

type ItemGroup = {
  itemName: string;
  offers: ParsedItem[];
  bestOffer: ParsedItem;
  worstPrice: number;
  savings: number;
};

function normalizeItem(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function groupByItem(data: ParsedItem[]): ItemGroup[] {
  const map = new Map<string, ParsedItem[]>();

  for (const item of data) {
    const key = normalizeItem(item.item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const groups: ItemGroup[] = [];
  for (const [, offers] of map.entries()) {
    const sorted = [...offers].sort((a, b) => a.unit_price - b.unit_price);
    const bestOffer = sorted[0];
    const worstPrice = sorted[sorted.length - 1].unit_price;
    const savings = worstPrice - bestOffer.unit_price;
    groups.push({ itemName: bestOffer.item, offers: sorted, bestOffer, worstPrice, savings });
  }

  // Sort groups by biggest absolute savings first
  return groups.sort((a, b) => b.savings - a.savings);
}

export default function Dashboard({ data }: { data: ParsedItem[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-[300px] flex items-center justify-center p-8 rounded-xl border border-border bg-slate-50 text-slate-500">
        No quotes analyzed yet. Upload a document to see the magic.
      </div>
    );
  }

  const groups = groupByItem(data);
  const totalSavings = groups.reduce((sum, g) => sum + g.savings, 0);
  const multiVendorGroups = groups.filter(g => g.offers.length > 1);

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      {totalSavings > 0 && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 shadow-sm flex items-center gap-4">
          <Trophy className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">Potential Savings Found</p>
            <p className="text-2xl font-bold text-emerald-900">${totalSavings.toFixed(2)}</p>
            <p className="text-xs text-emerald-700 mt-0.5">Across {multiVendorGroups.length} item(s) with multiple vendor quotes</p>
          </div>
        </div>
      )}

      {/* Per-Item Comparison */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.itemName} className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            {/* Item Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-800 text-sm">{group.itemName}</span>
              </div>
              {group.savings > 0 && (
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <TrendingDown className="w-3 h-3" />
                  Save ${group.savings.toFixed(2)} vs worst
                </div>
              )}
            </div>

            {/* Offers Table */}
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Vendor</th>
                  <th className="px-5 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-5 py-2.5 font-medium text-right">Unit Price</th>
                  <th className="px-5 py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {group.offers.map((offer, idx) => {
                  const isBest = idx === 0;
                  return (
                    <tr key={idx} className={`${isBest ? "bg-emerald-50/60" : "hover:bg-slate-50"} transition-colors`}>
                      <td className="px-5 py-3 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className={`font-medium ${isBest ? "text-emerald-800" : "text-slate-700"}`}>{offer.vendor}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">{offer.qty}</td>
                      <td className={`px-5 py-3 text-right font-bold ${isBest ? "text-emerald-700" : "text-slate-700"}`}>
                        ${offer.unit_price.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isBest ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            ✓ Best
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-medium">
                            +${(offer.unit_price - group.bestOffer.unit_price).toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
