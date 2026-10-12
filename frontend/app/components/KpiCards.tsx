"use client";

import React from "react";
import {
  TrendingUp,
  CircleDollarSign,
  WalletCards,
  ShoppingBag,
  Boxes,
  Percent,
  Info,
} from "lucide-react";

export type BusinessSummaryData = {
  totalRevenue?: number;
  totalProfit?: number;
  totalCost?: number;
  totalOrders?: number;
  totalUnitsSold?: number;
  averageMargin?: number;
};

type KpiCardsProps = {
  data: BusinessSummaryData;
  title?: string;
  isConfirmedCurrency?: boolean;
};

function formatCompactCurrency(val: number): string {
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

function formatExactCurrency(val: number): string {
  return "$" + val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactCount(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return (val / 1_000_000).toFixed(2) + "M";
  }
  if (Math.abs(val) >= 1_000) {
    return (val / 1_000).toFixed(1) + "K";
  }
  return val.toLocaleString("en-US");
}

export default function KpiCards({
  data,
  title = "Key Performance Indicators (Cube Governed)",
  isConfirmedCurrency = false,
}: KpiCardsProps) {
  const {
    totalRevenue,
    totalProfit,
    totalCost,
    totalOrders,
    totalUnitsSold,
    averageMargin,
  } = data;

  const marginPct =
    averageMargin !== undefined
      ? averageMargin <= 1 && averageMargin !== 0
        ? averageMargin * 100
        : averageMargin
      : undefined;

  const cards = [
    {
      id: "revenue",
      label: "Total Revenue",
      primary: totalRevenue !== undefined ? formatCompactCurrency(totalRevenue) : "—",
      secondary: totalRevenue !== undefined ? formatExactCurrency(totalRevenue) : "",
      subtext: isConfirmedCurrency ? "Verified currency (USD)" : "Standard Currency ($)",
      icon: TrendingUp,
      accentColor: "bg-[#192A56] text-[#F7D794]",
      borderAccent: "border-l-4 border-l-[#192A56]",
    },
    {
      id: "profit",
      label: "Total Profit",
      primary: totalProfit !== undefined ? formatCompactCurrency(totalProfit) : "—",
      secondary: totalProfit !== undefined ? formatExactCurrency(totalProfit) : "",
      subtext: isConfirmedCurrency ? "Net earnings (USD)" : "Standard Currency ($)",
      icon: CircleDollarSign,
      accentColor: "bg-emerald-700 text-emerald-100",
      borderAccent: "border-l-4 border-l-emerald-600",
    },
    {
      id: "cost",
      label: "Total Cost",
      primary: totalCost !== undefined ? formatCompactCurrency(totalCost) : "—",
      secondary: totalCost !== undefined ? formatExactCurrency(totalCost) : "",
      subtext: isConfirmedCurrency ? "COGS & operational (USD)" : "Standard Currency ($)",
      icon: WalletCards,
      accentColor: "bg-rose-700 text-rose-100",
      borderAccent: "border-l-4 border-l-rose-500",
    },
    {
      id: "orders",
      label: "Total Orders",
      primary: totalOrders !== undefined ? formatCompactCount(totalOrders) : "—",
      secondary: totalOrders !== undefined ? `${totalOrders.toLocaleString("en-US")} orders` : "",
      subtext: "Corporate sales transactions",
      icon: ShoppingBag,
      accentColor: "bg-blue-700 text-blue-100",
      borderAccent: "border-l-4 border-l-blue-600",
    },
    {
      id: "units",
      label: "Total Units Sold",
      primary: totalUnitsSold !== undefined ? formatCompactCount(totalUnitsSold) : "—",
      secondary: totalUnitsSold !== undefined ? `${totalUnitsSold.toLocaleString("en-US")} units` : "",
      subtext: "Aggregate hardware volume",
      icon: Boxes,
      accentColor: "bg-indigo-700 text-indigo-100",
      borderAccent: "border-l-4 border-l-indigo-600",
    },
    {
      id: "margin",
      label: "Average Margin",
      primary: marginPct !== undefined ? `${marginPct.toFixed(2)}%` : "—",
      secondary:
        totalProfit !== undefined && totalRevenue && totalRevenue > 0
          ? `${((totalProfit / totalRevenue) * 100).toFixed(2)}% net margin`
          : "Profit / Revenue ratio",
      subtext: "Governance target: >25.00%",
      icon: Percent,
      accentColor: "bg-amber-600 text-amber-100",
      borderAccent: "border-l-4 border-l-amber-500",
    },
  ];

  return (
    <div className="w-full my-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#192A56]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#192A56]">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <Info size={12} className="text-gray-400" />
          <span>
            {isConfirmedCurrency
              ? "Currency confirmed from dataset (USD)"
              : "Financial metrics formatted in standard currency ($)."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div
              key={card.id}
              className={`
                group rounded-xl border border-[#192A56]/10 bg-white p-3.5 shadow-sm
                transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
                hover:border-[#192A56]/25 ${card.borderAccent}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600">
                  {card.label}
                </span>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${card.accentColor}`}
                >
                  <IconComponent size={15} />
                </div>
              </div>

              <div className="mt-2.5">
                <div className="text-xl font-bold tracking-tight text-[#192A56] sm:text-2xl">
                  {card.primary}
                </div>
                {card.secondary && (
                  <div className="mt-0.5 truncate text-[11px] font-medium text-gray-500">
                    {card.secondary}
                  </div>
                )}
              </div>

              <div className="mt-2 border-t border-gray-100 pt-1.5 text-[10px] text-gray-400">
                {card.subtext}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
