"use client";

import { Globe, Trophy } from "lucide-react";

export type RegionalItem = {
  region: string;
  revenue: number;
  profit: number;
};

type RegionalLeaderboardProps = {
  items: RegionalItem[];
  title?: string;
};

function formatCompact(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return "$" + (val / 1_000_000_000).toFixed(2) + "B";
  }
  if (Math.abs(val) >= 1_000_000) {
    return "$" + (val / 1_000_000).toFixed(2) + "M";
  }
  if (Math.abs(val) >= 1_000) {
    return "$" + (val / 1_000).toFixed(1) + "K";
  }
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatExact(val: number): string {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RegionalLeaderboard({
  items,
  title = "Regional Performance Leaderboard (Ranked by Revenue)",
}: RegionalLeaderboardProps) {
  if (!items || items.length === 0) return null;

  // Always enforce sort by revenue descending
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="w-full my-4 rounded-2xl border border-[#192A56]/15 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#192A56] text-[#F7D794]">
            <Globe size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#192A56]">{title}</h3>
            <p className="text-[11px] text-gray-500">
              Verified 5 geographical operating regions · Cube Governed
            </p>
          </div>
        </div>

        <span className="rounded-full bg-[#192A56]/10 px-2.5 py-1 text-[11px] font-semibold text-[#192A56]">
          {sorted.length} Global Regions
        </span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((item, index) => {
          const rank = index + 1;
          const isTop = rank === 1;
          const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
          const share = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;

          return (
            <div
              key={item.region}
              className={`
                flex flex-col sm:flex-row sm:items-center justify-between gap-3
                rounded-xl border p-3 transition-all duration-200
                ${
                  isTop
                    ? "border-[#F7D794] bg-[#FDF9ED] shadow-sm hover:border-[#F7D794]/80"
                    : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200 hover:bg-white"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`
                    flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold
                    ${
                      isTop
                        ? "bg-[#192A56] text-[#F7D794]"
                        : "bg-gray-200 text-gray-700"
                    }
                  `}
                >
                  {isTop ? <Trophy size={14} /> : `#${rank}`}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#192A56]">
                      {item.region}
                    </span>
                    {isTop && (
                      <span className="rounded-md bg-[#192A56] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#F7D794]">
                        Top Performer
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Revenue Share: <span className="font-semibold text-gray-700">{share.toFixed(1)}%</span> · Profit Margin: <span className="font-semibold text-emerald-700">{margin.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5 pl-11 sm:pl-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-200/60">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-gray-500 font-medium">Revenue</div>
                  <div className="text-sm font-bold text-[#192A56]">
                    {formatCompact(item.revenue)}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {formatExact(item.revenue)}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs text-gray-500 font-medium">Profit</div>
                  <div className="text-sm font-bold text-emerald-700">
                    {formatCompact(item.profit)}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {formatExact(item.profit)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
