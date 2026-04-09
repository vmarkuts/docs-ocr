"use client";

import { ParsedItem } from "@/app/page";
import { DollarSign, Package, User, Hash } from "lucide-react";

export default function Dashboard({ data }: { data: ParsedItem[] }) {
  // Sort by lowest price automatically
  const sortedData = [...data].sort((a, b) => a.unit_price - b.unit_price);

  if (data.length === 0) {
    return (
      <div className="h-full min-h-[300px] flex items-center justify-center p-8 rounded-xl border border-border bg-card/50 text-muted-foreground">
        No quotes analyzed yet. Upload a document to see the magic.
      </div>
    );
  }

  const bestPrice = sortedData[0];

  return (
    <div className="space-y-6">
      {/* Lowest Price Highlight */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 shadow-lg shadow-emerald-500/5 transition-all">
        <h2 className="text-sm font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
          Best Option Detected
        </h2>
        <div className="flex items-end gap-4">
          <div className="text-4xl font-bold text-emerald-50">
            ${bestPrice.unit_price.toFixed(2)}
          </div>
          <div className="text-emerald-200/60 pb-1">/ unit</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-emerald-100/80">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <Package className="w-4 h-4" />
            <span className="truncate max-w-[150px]">{bestPrice.item}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <User className="w-4 h-4" />
            <span className="truncate max-w-[150px]">{bestPrice.vendor}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <Hash className="w-4 h-4" />
            <span>Qty: {bestPrice.qty}</span>
          </div>
        </div>
      </div>

      {/* Full Comparison Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Item</th>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium text-right">Qty</th>
                <th className="px-6 py-4 font-medium text-right">Unit Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedData.map((item, idx) => (
                <tr 
                  key={idx} 
                  className={`
                    hover:bg-muted/30 transition-colors
                    ${idx === 0 ? "bg-emerald-500/5" : ""}
                  `}
                >
                  <td className="px-6 py-4 font-medium text-foreground">{item.item}</td>
                  <td className="px-6 py-4 text-muted-foreground">{item.vendor}</td>
                  <td className="px-6 py-4 text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">
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
