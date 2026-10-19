"use client";

import ReactECharts from "echarts-for-react";

export type ChartSeries = {
  name: string;
  type?: "bar" | "line" | "pie";
  data: number[];
  color?: string;
  smooth?: boolean;
  areaStyle?: any;
  lineStyle?: any;
};

export type ChartData = {
  labels: string[];
  values?: number[];
  series?: ChartSeries[];
};

export type DynamicChartProps = {
  type?: "bar" | "line" | "pie" | "area";
  title: string;
  subtitle?: string;
  data: ChartData;
  height?: number;
  formatAsCurrency?: boolean;
  formatAsPercent?: boolean;
};

export default function DynamicChart({
  type = "bar",
  title,
  subtitle,
  data,
  height = 320,
  formatAsCurrency = false,
  formatAsPercent = false,
}: DynamicChartProps) {
  if (!data || !data.labels) {
    return null;
  }

  const isPie = type === "pie";

  // Build series config
  let seriesList: any[] = [];

  if (isPie && data.values) {
    seriesList = [
      {
        name: title,
        type: "pie",
        radius: ["45%", "72%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: "{b}: {d}%",
          fontSize: 11,
          color: "#475569",
        },
        data: data.labels.map((lbl, idx) => ({
          name: lbl,
          value: data.values ? data.values[idx] || 0 : 0,
        })),
      },
    ];
  } else if (data.series && data.series.length > 0) {
    seriesList = data.series.map((s, idx) => {
      const palette = ["#192A56", "#10B981", "#F59E0B", "#6366F1", "#EC4899", "#8B5CF6"];
      const col = s.color || palette[idx % palette.length];
      const sType = s.type || (type === "area" ? "line" : type);

      return {
        name: s.name,
        type: sType,
        data: s.data,
        smooth: s.smooth !== false,
        barMaxWidth: 42,
        itemStyle: {
          color: col,
          borderRadius: sType === "bar" ? [6, 6, 0, 0] : 0,
        },
        lineStyle: s.lineStyle || {
          color: col,
          width: 2.5,
        },
        areaStyle:
          s.areaStyle || (type === "area" ? { opacity: 0.15, color: col } : undefined),
        symbol: "circle",
        symbolSize: 6,
      };
    });
  } else if (data.values) {
    const defaultColor = "#192A56";
    seriesList = [
      {
        name: title,
        type: type === "area" ? "line" : type,
        data: data.values,
        smooth: type === "line" || type === "area",
        barMaxWidth: 48,
        itemStyle: {
          color: defaultColor,
          borderRadius: type === "bar" ? [6, 6, 0, 0] : 0,
        },
        lineStyle: {
          color: defaultColor,
          width: 3,
        },
        areaStyle: type === "area" ? { opacity: 0.15, color: defaultColor } : undefined,
        symbol: "circle",
        symbolSize: 7,
      },
    ];
  }

  const option = isPie
    ? {
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b}: {c} ({d}%)",
        },
        legend: {
          bottom: "2%",
          left: "center",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { fontSize: 11, color: "#64748B" },
        },
        series: seriesList,
      }
    : {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", crossStyle: { color: "#999" } },
          formatter: (params: any) => {
            if (!params || !params.length) return "";
            let res = `<div class="font-bold text-xs mb-1 text-slate-800">${params[0].axisValue}</div>`;
            params.forEach((item: any) => {
              let valFormatted = item.value;
              if (formatAsCurrency && typeof valFormatted === "number") {
                valFormatted = `$${valFormatted.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
              } else if (formatAsPercent && typeof valFormatted === "number") {
                valFormatted = `${valFormatted.toFixed(1)}%`;
              } else if (typeof valFormatted === "number") {
                valFormatted = valFormatted.toLocaleString();
              }
              res += `<div class="flex items-center gap-2 text-xs text-slate-600">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};"></span>
                <span>${item.seriesName}:</span>
                <span class="font-semibold text-slate-900">${valFormatted}</span>
              </div>`;
            });
            return res;
          },
        },
        legend:
          seriesList.length > 1
            ? {
                top: "2%",
                right: "4%",
                itemWidth: 12,
                itemHeight: 10,
                textStyle: { fontSize: 11, color: "#64748B" },
              }
            : undefined,
        grid: {
          left: "3%",
          right: "4%",
          bottom: "8%",
          top: seriesList.length > 1 ? "18%" : "12%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: data.labels,
          axisLine: { lineStyle: { color: "#E2E8F0" } },
          axisLabel: { color: "#64748B", fontSize: 11, interval: 0, rotate: data.labels.length > 7 ? 25 : 0 },
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          axisLabel: {
            color: "#64748B",
            fontSize: 11,
            formatter: (val: number) => {
              if (formatAsCurrency) {
                if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
                if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
                return `$${val}`;
              }
              if (formatAsPercent) return `${val}%`;
              if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
              if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
              return `${val}`;
            },
          },
          splitLine: { lineStyle: { color: "#F1F5F9" } },
        },
        series: seriesList,
      };

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-[#192A56]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      <div style={{ height: `${height}px`, width: "100%" }}>
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge={true}
        />
      </div>
    </div>
  );
}