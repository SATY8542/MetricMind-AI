"use client";

import { useMemo, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";

export type SeriesItem = {
  name: string;
  values: number[];
  color?: string;
};

export type ChartData = {
  labels: string[];
  values?: number[];
  series?: SeriesItem[];
};

export type DynamicChartProps = {
  type: "bar" | "line";
  title: string;
  subtitle?: string;
  data: ChartData;
};

const PALETTE = ["#192A56", "#F7D794", "#4A69BD", "#10AC84", "#EDA6A3", "#7D5FFF"];

/**
 * Metric-aware value formatter that distinguishes currency from counts and percentages
 */
export function formatMetricValue(val: number, metricName?: string): string {
  if (isNaN(val) || val === null || val === undefined) return String(val);

  const lower = (metricName || "").toLowerCase();

  // Percentage / Margin
  if (lower.includes("margin") || lower.includes("percent") || lower.includes("pct")) {
    const pct = Math.abs(val) <= 1 && val !== 0 ? val * 100 : val;
    return pct.toFixed(2) + "%";
  }

  // Count metrics: Orders, Units Sold, Quantities
  const isCount =
    lower.includes("order") ||
    lower.includes("unit") ||
    lower.includes("count") ||
    lower.includes("volume") ||
    lower.includes("quantity");

  if (isCount) {
    if (Math.abs(val) >= 1_000_000) {
      return (val / 1_000_000).toFixed(2) + "M units";
    }
    if (Math.abs(val) >= 1_000) {
      return (val / 1_000).toFixed(1) + "K";
    }
    return Math.round(val).toLocaleString("en-US");
  }

  // Financial / Monetary metrics: Revenue, Profit, Cost (default for BI)
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

export default function DynamicChart({
  type,
  title,
  subtitle,
  data,
}: DynamicChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const echartsRef = useRef<any>(null);

  // Resize listener for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (echartsRef.current) {
        const instance = echartsRef.current.getEchartsInstance?.();
        instance?.resize();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasSeries = Array.isArray(data?.series) && data.series.length > 0;
  const hasValues = Array.isArray(data?.values) && data.values.length > 0;

  // Determine if this chart is monetary or counts
  const isCountChart = useMemo(() => {
    const t = (title || "").toLowerCase();
    if (t.includes("order") || t.includes("unit")) return true;
    if (hasSeries) {
      const allCounts = data.series!.every((s) => {
        const n = s.name.toLowerCase();
        return n.includes("order") || n.includes("unit");
      });
      return allCounts;
    }
    return false;
  }, [title, hasSeries, data?.series]);

  const option = useMemo(() => {
    if (!data || !data.labels || data.labels.length === 0 || (!hasSeries && !hasValues)) {
      return null;
    }

    const seriesList = hasSeries
      ? data.series!.map((s, index) => {
          const color = s.color || PALETTE[index % PALETTE.length];
          return {
            name: s.name,
            type: type,
            data: s.values,
            smooth: type === "line",
            barMaxWidth: 44,
            barGap: "20%",
            itemStyle: {
              color: color,
              borderRadius: type === "bar" ? [6, 6, 0, 0] : 0,
            },
            lineStyle: {
              color: color,
              width: 3,
            },
            symbol: "circle",
            symbolSize: 7,
          };
        })
      : [
          {
            name: title,
            type: type,
            data: data.values!,
            smooth: type === "line",
            barMaxWidth: 52,
            itemStyle: {
              color: "#192A56",
              borderRadius: type === "bar" ? [6, 6, 0, 0] : 0,
            },
            lineStyle: {
              color: "#192A56",
              width: 3,
            },
            symbol: "circle",
            symbolSize: 8,
          },
        ];

    const needsRotation = data.labels.length > 4;

    return {
      tooltip: {
        trigger: "axis",
        confine: true, // Prevents tooltip clipping and overlapping outside chart boundaries
        backgroundColor: "rgba(25, 42, 86, 0.95)",
        borderColor: "rgba(247, 215, 148, 0.4)",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: "#ffffff",
          fontSize: 12,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: function (params: any) {
          if (!Array.isArray(params)) return "";
          let content = `<div style="font-weight: 700; margin-bottom: 6px; color: #F7D794; font-size: 13px;">${params[0]?.axisValueLabel ?? ""}</div>`;
          for (const item of params) {
            const num = typeof item.value === "number" ? item.value : Number(item.value);
            const formatted = isNaN(num) ? item.value : formatMetricValue(num, item.seriesName);
            content += `<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 12px; margin-top: 4px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                ${item.marker} <span style="color: #E0E2E7;">${item.seriesName}:</span>
              </span>
              <span style="font-weight: 600; color: #FFFFFF; font-variant-numeric: tabular-nums;">${formatted}</span>
            </div>`;
          }
          return content;
        },
      },

      legend: hasSeries
        ? {
            top: 6,
            right: "3%",
            icon: "roundRect",
            itemWidth: 13,
            itemHeight: 9,
            itemGap: 16,
            textStyle: {
              color: "#475467",
              fontSize: 12,
              fontWeight: 500,
            },
          }
        : undefined,

      grid: {
        left: "3%",
        right: "4%",
        bottom: needsRotation ? 55 : 35,
        top: hasSeries ? 55 : 30,
        containLabel: true,
      },

      xAxis: {
        type: "category",
        data: data.labels,
        axisLine: {
          lineStyle: {
            color: "#D9DDE5",
          },
        },
        axisTick: {
          alignWithLabel: true,
        },
        axisLabel: {
          color: "#475467",
          fontSize: 11,
          fontWeight: 500,
          interval: 0,
          rotate: needsRotation ? 22 : 0,
          margin: 12,
          formatter: (value: string) => {
            // Truncate overly long labels on mobile
            return value.length > 15 ? value.slice(0, 14) + "…" : value;
          },
        },
      },

      yAxis: {
        type: "value",
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "#667085",
          fontSize: 11,
          margin: 12,
          formatter: (val: number) => {
            if (isCountChart) {
              if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M";
              if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(0) + "K";
              return String(val);
            }
            if (Math.abs(val) >= 1_000_000_000) return "$" + (val / 1_000_000_000).toFixed(1) + "B";
            if (Math.abs(val) >= 1_000_000) return "$" + (val / 1_000_000).toFixed(0) + "M";
            if (Math.abs(val) >= 1_000) return "$" + (val / 1_000).toFixed(0) + "K";
            return "$" + String(val);
          },
        },
        splitLine: {
          lineStyle: {
            color: "#EEF0F4",
            type: "dashed",
          },
        },
      },

      series: seriesList,
    };
  }, [data, hasSeries, hasValues, title, type, isCountChart]);

  if (!option) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl border border-[#192A56]/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
        <div>
          <h3 className="text-sm font-bold text-[#192A56] sm:text-base">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>

      {/* Increased responsive chart height: 380px on mobile, 420px on sm, 440px on lg */}
      <div className="h-[380px] w-full sm:h-[420px] lg:h-[440px]">
        <ReactECharts
          ref={echartsRef}
          option={option}
          notMerge={true}
          lazyUpdate={true}
          style={{
            width: "100%",
            height: "100%",
          }}
          opts={{
            renderer: "canvas",
          }}
        />
      </div>
    </div>
  );
}