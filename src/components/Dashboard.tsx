"use client";

import { ParsedItem } from "@/app/page";
import { DollarSign, Package, User, Hash } from "lucide-react";

export default function Dashboard({ data }: { data: ParsedItem[] }) {
  // Sort by lowest price automatically
  const sortedData = [...data].sort((a, b) => a.unit_price - b.unit_price);

  if (data.length === 0) {
    return (
      <div className="h-full min-h-[300px] flex items-center justify-center p-8 rounded-xl border border-border bg-slate-50 text-slate-500">
        No quotes analyzed yet. Upload a document to see the magic.
      </div>
    );
  }

  const bestPrice = sortedData[0];

  return (
    <div className="space-y-6">
      {/* Lowest Price Highlight */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 shadow-sm transition-all">
        <h2 className="text-sm font-semibold text-emerald-700 mb-2 uppercase tracking-wider">
          Best Option Detected
        </h2>
        <div className="flex items-end gap-4">
          <div className="text-4xl font-bold text-emerald-950">
            ${bestPrice.unit_price.toFixed(2)}
          </div>
          <div className="text-emerald-700/80 pb-1 font-medium">/ unit</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-emerald-900">
          <div className="flex items-center gap-1.5 bg-emerald-100/80 px-3 py-1.5 rounded-full font-medium">
            <Package className="w-4 h-4 text-emerald-600" />
            <span className="truncate max-w-[150px]">{bestPrice.item}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-100/80 px-3 py-1.5 rounded-full font-medium">
            <User className="w-4 h-4 text-emerald-600" />
            <span className="truncate max-w-[150px]">{bestPrice.vendor}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-100/80 px-3 py-1.5 rounded-full font-medium">
            <Hash className="w-4 h-4 text-emerald-600" />
            <span>Qty: {bestPrice.qty}</span>
          </div>
        </div>
      </div>

      {/* Full Comparison Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Vendor</th>
                <th className="px-6 py-4 font-semibold text-right">Qty</th>
                <th className="px-6 py-4 font-semibold text-right">Unit Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {sortedData.map((item, idx) => (
                <tr 
                  key={idx} 
                  className={`
                    hover:bg-slate-50 transition-colors
                    ${idx === 0 ? "bg-emerald-50/50" : ""}
                  `}
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{item.item}</td>
                  <td className="px-6 py-4 text-slate-600">{item.vendor}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{item.qty}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">
                    ${item.unit_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
