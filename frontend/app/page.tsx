"use client";

import { useState } from "react";
import {
  Menu,
  Plus,
  MessageSquare,
  Send,
  BarChart3,
  Database,
  X,
  Sparkles,
  User,
  Bot,
  ChevronRight,
  Globe,
} from "lucide-react";

import DynamicChart, { ChartData } from "./components/charts/DynamicChart";
import MarkdownRenderer from "./components/MarkdownRenderer";
import KpiCards, { BusinessSummaryData } from "./components/KpiCards";
import RegionalLeaderboard, { RegionalItem } from "./components/RegionalLeaderboard";

/* =========================================================
   TYPES
========================================================= */

type ChartInfo = {
  type: "bar" | "line";
  title: string;
  subtitle?: string;
  data: ChartData;
};

type ApiInfo = {
  method: string;
  endpoint: string;
  request: Record<string, unknown>;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  chart?: ChartInfo;
  api?: ApiInfo;
  sql?: string;
  kpis?: BusinessSummaryData;
  regionalItems?: RegionalItem[];
};

type CubeFilter = {
  member: string;
  operator: string;
  values?: (string | number)[];
};

type CubeQuery = {
  measures?: string[];
  dimensions?: string[];
  filters?: CubeFilter[];
  order?: Record<string, "asc" | "desc">;
  limit?: number;
};

type CubeRecord = Record<string, string | number | null | undefined>;

type CubeApiResponse = {
  data?: CubeRecord[];
  query?: CubeQuery;
  sql?: string;
  error?: string;
};

type ParsedIntent =
  | {
      type: "unsupported";
      message: string;
    }
  | {
      type: "query";
      query: CubeQuery;
      context: string;
      dimensionKey?: string;
      isCostProfit?: boolean;
    };

/* =========================================================
   SUGGESTIONS
========================================================= */

const suggestions = [
  {
    title: "Business Summary",
    description: "Show me the overall business summary",
    icon: BarChart3,
  },
  {
    title: "Regional Performance",
    description: "Show me regional performance",
    icon: Globe,
  },
  {
    title: "Cost & Profit",
    description: "Show me cost and profit summary",
    icon: Database,
  },
];

/* =========================================================
   NUMBER FORMATTING HELPERS
========================================================= */

function formatCurrency(val: number): string {
  return "$" + val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(val: number): string {
  return Math.round(val).toLocaleString("en-US");
}

function formatPercent(val: number): string {
  const pct = Math.abs(val) <= 1 && val !== 0 ? val * 100 : val;
  return pct.toFixed(2) + "%";
}

/* =========================================================
   QUERY PARSER FOR NATURAL-LANGUAGE BUSINESS QUESTIONS
========================================================= */

function parseBusinessQuestion(question: string): ParsedIntent {
  const q = question.toLowerCase().trim();

  // Check for unsupported dimensions
  const unsupportedMonthMatch = q.match(
    /\b(month|monthly|january|february|march|april|may|june|july|august|september|october|november|december)\b/i
  );
  if (unsupportedMonthMatch) {
    return {
      type: "unsupported",
      message:
        "The semantic data model currently supports Year (2024, 2025, 2026) and Quarter (Q1, Q2, Q3, Q4) time dimensions, but does not include a Month dimension. Please query by quarter or year instead.",
    };
  }

  // Extract Quarter filter
  let quarterFilter: string | null = null;
  const qMatch = q.match(/\bq([1-4])\b/i);
  if (qMatch) {
    quarterFilter = `Q${qMatch[1]}`;
  } else if (q.includes("first quarter") || q.includes("quarter one")) {
    quarterFilter = "Q1";
  } else if (q.includes("second quarter") || q.includes("quarter two")) {
    quarterFilter = "Q2";
  } else if (q.includes("third quarter") || q.includes("quarter three")) {
    quarterFilter = "Q3";
  } else if (q.includes("fourth quarter") || q.includes("quarter four")) {
    quarterFilter = "Q4";
  }

  // Extract Year filter
  let yearFilter: string | null = null;
  const yMatch = q.match(/\b(202[4-6])\b/);
  if (yMatch) {
    yearFilter = yMatch[1];
  }

  // Common filters builder
  const buildFilters = (): CubeFilter[] => {
    const filters: CubeFilter[] = [];
    if (yearFilter) {
      filters.push({
        member: "Sales.year",
        operator: "equals",
        values: [yearFilter],
      });
    }
    if (quarterFilter) {
      filters.push({
        member: "Sales.quarter",
        operator: "equals",
        values: [quarterFilter],
      });
    }
    return filters;
  };

  // 1. Cost & Profit summary
  if (
    q.includes("cost") ||
    q.includes("margin") ||
    q.includes("cost and profit") ||
    q.includes("cost & profit")
  ) {
    const filters = buildFilters();
    return {
      type: "query",
      isCostProfit: true,
      context: "Cost & Profit",
      query: {
        measures: [
          "Sales.totalCost",
          "Sales.totalProfit",
          "Sales.totalRevenue",
          "Sales.averageMargin",
        ],
        filters: filters.length ? filters : undefined,
      },
    };
  }

  // 2. Regional comparison / breakdown
  const isRegionComparison =
    q.includes("regional") ||
    (q.includes("region") &&
      (q.includes("all") ||
        q.includes("comparison") ||
        q.includes("performance") ||
        q.includes("by region") ||
        q.includes("breakdown") ||
        q.includes("compare")));

  if (isRegionComparison) {
    const filters = buildFilters();
    return {
      type: "query",
      dimensionKey: "Sales.region",
      context: "Regional Performance",
      query: {
        measures: ["Sales.totalRevenue", "Sales.totalProfit"],
        dimensions: ["Sales.region"],
        filters: filters.length ? filters : undefined,
        order: { "Sales.totalRevenue": "desc" },
      },
    };
  }

  // Specific Region filter
  const regionNames: Record<string, string> = {
    europe: "Europe",
    european: "Europe",
    "asia pacific": "Asia Pacific",
    asia: "Asia Pacific",
    "north america": "North America",
    "latin america": "Latin America",
    "south america": "Latin America",
    "middle east": "Middle East",
  };
  const matchedRegion = Object.keys(regionNames).find((r) => q.includes(r));
  if (matchedRegion) {
    const filters = buildFilters();
    filters.push({
      member: "Sales.region",
      operator: "equals",
      values: [regionNames[matchedRegion]],
    });
    return {
      type: "query",
      context: `${regionNames[matchedRegion]} Region`,
      query: {
        measures: [
          "Sales.totalRevenue",
          "Sales.totalProfit",
          "Sales.totalOrders",
          "Sales.totalUnitsSold",
        ],
        filters,
      },
    };
  }

  // 3. Product comparison / breakdown
  const isProductComparison =
    (q.includes("product") &&
      (q.includes("all") ||
        q.includes("comparison") ||
        q.includes("performance") ||
        q.includes("by product") ||
        q.includes("breakdown") ||
        q.includes("compare") ||
        q.includes("top"))) ||
    q.includes("products");

  if (isProductComparison) {
    const filters = buildFilters();
    return {
      type: "query",
      dimensionKey: "Sales.product",
      context: "Product Performance",
      query: {
        measures: ["Sales.totalRevenue", "Sales.totalProfit"],
        dimensions: ["Sales.product"],
        filters: filters.length ? filters : undefined,
        order: { "Sales.totalRevenue": "desc" },
      },
    };
  }

  // Specific Product filter
  const productNames = ["laptop", "server", "desktop", "tablet", "monitor", "printer"];
  const matchedProduct = productNames.find((p) => q.includes(p));
  if (matchedProduct) {
    const title = matchedProduct.charAt(0).toUpperCase() + matchedProduct.slice(1);
    const filters = buildFilters();
    filters.push({
      member: "Sales.product",
      operator: "equals",
      values: [title],
    });
    return {
      type: "query",
      context: `${title} Product`,
      query: {
        measures: [
          "Sales.totalRevenue",
          "Sales.totalProfit",
          "Sales.totalOrders",
          "Sales.totalUnitsSold",
        ],
        filters,
      },
    };
  }

  // 4. Channel comparison / breakdown
  const isChannelComparison =
    (q.includes("channel") &&
      (q.includes("all") ||
        q.includes("comparison") ||
        q.includes("performance") ||
        q.includes("by channel") ||
        q.includes("breakdown") ||
        q.includes("compare"))) ||
    q.includes("channels");

  if (isChannelComparison) {
    const filters = buildFilters();
    return {
      type: "query",
      dimensionKey: "Sales.channel",
      context: "Sales Channel Performance",
      query: {
        measures: ["Sales.totalRevenue", "Sales.totalProfit"],
        dimensions: ["Sales.channel"],
        filters: filters.length ? filters : undefined,
        order: { "Sales.totalRevenue": "desc" },
      },
    };
  }

  // Specific Channel filter
  const channelNames = ["online", "retail", "distributor", "enterprise"];
  const matchedChannel = channelNames.find((c) => q.includes(c));
  if (matchedChannel) {
    const title = matchedChannel.charAt(0).toUpperCase() + matchedChannel.slice(1);
    const filters = buildFilters();
    filters.push({
      member: "Sales.channel",
      operator: "equals",
      values: [title],
    });
    return {
      type: "query",
      context: `${title} Channel`,
      query: {
        measures: [
          "Sales.totalRevenue",
          "Sales.totalProfit",
          "Sales.totalOrders",
          "Sales.totalUnitsSold",
        ],
        filters,
      },
    };
  }

  // 5. Country analysis / comparison
  const isCountryComparison =
    q.includes("country") ||
    q.includes("countries") ||
    q.includes("by country") ||
    q.includes("top countries");

  if (isCountryComparison) {
    const filters = buildFilters();
    return {
      type: "query",
      dimensionKey: "Sales.country",
      context: "Country Analysis",
      query: {
        measures: ["Sales.totalRevenue", "Sales.totalProfit"],
        dimensions: ["Sales.country"],
        filters: filters.length ? filters : undefined,
        order: { "Sales.totalRevenue": "desc" },
        limit: 10,
      },
    };
  }

  // Specific Country filter
  const countryList = [
    "mexico", "usa", "canada", "japan", "france", "spain", "germany",
    "singapore", "qatar", "australia", "brazil", "india", "italy",
    "uk", "chile", "argentina", "uae", "saudi arabia"
  ];
  const matchedCountry = countryList.find((c) => q.includes(c));
  if (matchedCountry) {
    const title =
      matchedCountry.toUpperCase() === "USA" ||
      matchedCountry.toUpperCase() === "UK" ||
      matchedCountry.toUpperCase() === "UAE"
        ? matchedCountry.toUpperCase()
        : matchedCountry.charAt(0).toUpperCase() + matchedCountry.slice(1);

    const filters = buildFilters();
    filters.push({
      member: "Sales.country",
      operator: "equals",
      values: [title],
    });
    return {
      type: "query",
      context: `${title} Country Analysis`,
      query: {
        measures: [
          "Sales.totalRevenue",
          "Sales.totalProfit",
          "Sales.totalOrders",
          "Sales.totalUnitsSold",
        ],
        filters,
      },
    };
  }

  // 6. Quarter and/or Year Filtered Performance
  if (quarterFilter || yearFilter) {
    const filters = buildFilters();
    const periodDesc = [yearFilter, quarterFilter].filter(Boolean).join(" ");
    return {
      type: "query",
      context: `${periodDesc} Performance`,
      query: {
        measures: [
          "Sales.totalRevenue",
          "Sales.totalProfit",
          "Sales.totalOrders",
          "Sales.totalUnitsSold",
        ],
        filters,
      },
    };
  }

  // 7. Overall Business Summary (Default)
  return {
    type: "query",
    context: "Overall Business Summary",
    query: {
      measures: [
        "Sales.totalRevenue",
        "Sales.totalProfit",
        "Sales.totalOrders",
        "Sales.totalCost",
        "Sales.totalUnitsSold",
        "Sales.averageMargin",
      ],
    },
  };
}

/* =========================================================
   RESPONSE FORMATTER
========================================================= */

function formatCubeAnswer(
  data: CubeRecord[],
  context: string,
  dimensionKey?: string,
  isCostProfit?: boolean
): string {
  if (!data || data.length === 0) {
    return `No records were found for ${context}. Please try adjusting your filters.`;
  }

  // Grouped results (multiple categories, e.g. Regional Performance)
  if (dimensionKey && data.length > 1) {
    // Sort strictly by revenue descending
    const sortedData = [...data].sort((a, b) => {
      const revA = Number(a["Sales.totalRevenue"] || 0);
      const revB = Number(b["Sales.totalRevenue"] || 0);
      return revB - revA;
    });

    const items = sortedData.map((d, index) => {
      const cat = String(d[dimensionKey] || "Unknown");
      const rev = Number(d["Sales.totalRevenue"] || 0);
      const prof = Number(d["Sales.totalProfit"] || 0);
      return `${index + 1}. **${cat}**: ${formatCurrency(rev)} Revenue, ${formatCurrency(prof)} Profit`;
    });

    const topItem = sortedData[0];
    const topCat = String(topItem[dimensionKey] || "Unknown");
    const topRev = Number(topItem["Sales.totalRevenue"] || 0);
    const topProf = Number(topItem["Sales.totalProfit"] || 0);

    return (
      `Here is the **${context}** breakdown across ${sortedData.length} categories:\n\n` +
      `**Top Performer:** **${topCat}** generated **${formatCurrency(topRev)}** in revenue and **${formatCurrency(topProf)}** in profit.\n\n` +
      items.join("\n")
    );
  }

  // Single aggregate record
  const rec = data[0];
  const rev = rec["Sales.totalRevenue"] !== undefined ? Number(rec["Sales.totalRevenue"]) : null;
  const prof = rec["Sales.totalProfit"] !== undefined ? Number(rec["Sales.totalProfit"]) : null;
  const cost = rec["Sales.totalCost"] !== undefined ? Number(rec["Sales.totalCost"]) : null;
  const orders = rec["Sales.totalOrders"] !== undefined ? Number(rec["Sales.totalOrders"]) : null;
  const units = rec["Sales.totalUnitsSold"] !== undefined ? Number(rec["Sales.totalUnitsSold"]) : null;
  const margin = rec["Sales.averageMargin"] !== undefined ? Number(rec["Sales.averageMargin"]) : null;

  // Overall Business Summary
  if (
    context.includes("Business Summary") ||
    (rev !== null && prof !== null && cost !== null && orders !== null && units !== null && margin !== null)
  ) {
    return (
      `Here is the verified executive **${context}**:\n\n` +
      `- Total Revenue: **${formatCurrency(rev ?? 0)}**\n` +
      `- Total Profit: **${formatCurrency(prof ?? 0)}**\n` +
      `- Total Cost: **${formatCurrency(cost ?? 0)}**\n` +
      `- Total Orders: **${formatNumber(orders ?? 0)}**\n` +
      `- Total Units Sold: **${formatNumber(units ?? 0)}**\n` +
      `- Average Margin: **${formatPercent(margin ?? 0)}**`
    );
  }

  if (isCostProfit) {
    const parts: string[] = [];
    if (rev !== null) parts.push(`Total Revenue: **${formatCurrency(rev)}**`);
    if (prof !== null) parts.push(`Total Profit: **${formatCurrency(prof)}**`);
    if (cost !== null) parts.push(`Total Cost: **${formatCurrency(cost)}**`);
    if (margin !== null) parts.push(`Average Profit Margin: **${formatPercent(margin)}**`);

    return (
      `Here is the financial **${context}** breakdown:\n\n- ` +
      parts.join("\n- ")
    );
  }

  const bulletPoints: string[] = [];
  if (rev !== null) bulletPoints.push(`Total Revenue: **${formatCurrency(rev)}**`);
  if (prof !== null) bulletPoints.push(`Total Profit: **${formatCurrency(prof)}**`);
  if (orders !== null) bulletPoints.push(`Total Orders: **${formatNumber(orders)}**`);
  if (units !== null) bulletPoints.push(`Total Units Sold: **${formatNumber(units)}**`);
  if (cost !== null) bulletPoints.push(`Total Cost: **${formatCurrency(cost)}**`);
  if (margin !== null) bulletPoints.push(`Average Margin: **${formatPercent(margin)}**`);

  return (
    `Here is the **${context}**:\n\n- ` +
    bulletPoints.join("\n- ")
  );
}

/* =========================================================
   CHART BUILDER
========================================================= */

function buildChartFromCubeData(
  data: CubeRecord[],
  context: string,
  dimensionKey?: string,
  isCostProfit?: boolean
): ChartInfo | undefined {
  if (!data || data.length === 0) return undefined;

  // Grouped comparison across categories (e.g. Regional Performance)
  if (dimensionKey && data.length > 1) {
    // Sort strictly by revenue descending to ensure identical order with ranked list
    const sortedData = [...data].sort((a, b) => {
      const revA = Number(a["Sales.totalRevenue"] || 0);
      const revB = Number(b["Sales.totalRevenue"] || 0);
      return revB - revA;
    });

    const labels = sortedData.map((d) => String(d[dimensionKey] || "Unknown"));
    const revenueValues = sortedData.map((d) => Number(d["Sales.totalRevenue"] || 0));
    const profitValues = sortedData.map((d) => Number(d["Sales.totalProfit"] || 0));

    return {
      type: "bar",
      title: context,
      subtitle: `Comparison by ${dimensionKey.replace("Sales.", "")} (Cube Analytics)`,
      data: {
        labels,
        series: [
          { name: "Revenue", values: revenueValues, color: "#192A56" },
          { name: "Profit", values: profitValues, color: "#F7D794" },
        ],
      },
    };
  }

  // Cost & Profit single breakdown
  const rec = data[0];
  if (isCostProfit) {
    const cost = Number(rec["Sales.totalCost"] || 0);
    const profit = Number(rec["Sales.totalProfit"] || 0);
    const revenue = Number(rec["Sales.totalRevenue"] || 0);

    return {
      type: "bar",
      title: "Cost & Profit Comparison",
      subtitle: "Verified metrics from Cube Semantic Layer",
      data: {
        labels: ["Total Revenue", "Total Cost", "Total Profit"],
        values: [revenue, cost, profit],
      },
    };
  }

  // Single aggregate comparison: Revenue vs Cost vs Profit
  const rev = rec["Sales.totalRevenue"] !== undefined ? Number(rec["Sales.totalRevenue"]) : null;
  const cost = rec["Sales.totalCost"] !== undefined ? Number(rec["Sales.totalCost"]) : null;
  const prof = rec["Sales.totalProfit"] !== undefined ? Number(rec["Sales.totalProfit"]) : null;

  const labels: string[] = [];
  const values: number[] = [];

  if (rev !== null) {
    labels.push("Total Revenue");
    values.push(rev);
  }
  if (cost !== null) {
    labels.push("Total Cost");
    values.push(cost);
  }
  if (prof !== null) {
    labels.push("Total Profit");
    values.push(prof);
  }

  if (labels.length === 0) return undefined;

  return {
    type: "bar",
    title: `${context} Overview`,
    subtitle: "Aggregate financial metrics from Cube Analytics",
    data: {
      labels,
      values,
    },
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showApiCall, setShowApiCall] = useState<number | null>(null);
  const [showSql, setShowSql] = useState<number | null>(null);

  const handleSend = async (providedQuestion?: string) => {
    const question = (providedQuestion ?? input).trim();

    if (!question || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const intent = parseBusinessQuestion(question);

      if (intent.type === "unsupported") {
        const assistantMessage: Message = {
          id: Date.now() + 1,
          role: "assistant",
          content: intent.message,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: intent.query }),
      });

      let responseJson: CubeApiResponse;
      try {
        responseJson = await response.json();
      } catch {
        throw new Error(`Analytics service returned malformed JSON (HTTP ${response.status}).`);
      }

      if (!response.ok) {
        const errorDetail = responseJson?.error || `Analytics query failed with HTTP ${response.status}.`;
        throw new Error(errorDetail);
      }

      const data = responseJson.data ?? [];
      const answer = formatCubeAnswer(data, intent.context, intent.dimensionKey, intent.isCostProfit);
      const chart = buildChartFromCubeData(data, intent.context, intent.dimensionKey, intent.isCostProfit);

      // Check if this response contains the business summary metrics (6 KPI metrics)
      let kpis: BusinessSummaryData | undefined = undefined;
      if (!intent.dimensionKey && data.length > 0) {
        const rec = data[0];
        if (
          rec["Sales.totalRevenue"] !== undefined ||
          rec["Sales.totalOrders"] !== undefined
        ) {
          kpis = {
            totalRevenue: rec["Sales.totalRevenue"] !== undefined ? Number(rec["Sales.totalRevenue"]) : undefined,
            totalProfit: rec["Sales.totalProfit"] !== undefined ? Number(rec["Sales.totalProfit"]) : undefined,
            totalCost: rec["Sales.totalCost"] !== undefined ? Number(rec["Sales.totalCost"]) : undefined,
            totalOrders: rec["Sales.totalOrders"] !== undefined ? Number(rec["Sales.totalOrders"]) : undefined,
            totalUnitsSold: rec["Sales.totalUnitsSold"] !== undefined ? Number(rec["Sales.totalUnitsSold"]) : undefined,
            averageMargin: rec["Sales.averageMargin"] !== undefined ? Number(rec["Sales.averageMargin"]) : undefined,
          };
        }
      }

      // Check if regional items are returned to render the ranked leaderboard
      let regionalItems: RegionalItem[] | undefined = undefined;
      if (intent.dimensionKey === "Sales.region" && data.length > 0) {
        const sorted = [...data].sort(
          (a, b) => Number(b["Sales.totalRevenue"] || 0) - Number(a["Sales.totalRevenue"] || 0)
        );
        regionalItems = sorted.map((d) => ({
          region: String(d["Sales.region"] || "Unknown"),
          revenue: Number(d["Sales.totalRevenue"] || 0),
          profit: Number(d["Sales.totalProfit"] || 0),
        }));
      }

      const api: ApiInfo = {
        method: "POST",
        endpoint: "/api/analytics -> Cube (http://localhost:4000/cubejs-api/v1/load)",
        request: { query: intent.query },
      };

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: answer,
        chart,
        kpis,
        regionalItems,
        api,
        sql: responseJson.sql,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("MetricMind Analytics Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unable to retrieve analytics results.";

      const assistantError: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: `I couldn't retrieve the requested data.\n\n${errorMessage}\n\nPlease verify that the Cube analytics service is running on port 4000.`,
        api: {
          method: "POST",
          endpoint: "/api/analytics",
          request: { question },
        },
      };

      setMessages((prev) => [...prev, assistantError]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    handleSend(text);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setShowApiCall(null);
    setShowSql(null);
    setSidebarOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="min-h-screen bg-[#FCFBFB] text-[#192A56]">
      <div className="flex min-h-screen">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed left-0 top-0 z-50
            flex h-screen w-[270px]
            flex-col
            bg-[#192A56]
            text-white
            transition-transform duration-300
            lg:static lg:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* Logo */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7D794]">
                <BarChart3 size={21} className="text-[#192A56]" />
              </div>
              <div>
                <h1 className="text-base font-bold">MetricMind</h1>
                <p className="text-[10px] text-white/50">Semantic BI Engine</p>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* New Chat */}
          <div className="px-4 py-4">
            <button
              onClick={handleNewChat}
              className="
                flex w-full items-center
                gap-3 rounded-xl
                bg-[#F7D794]
                px-4 py-3
                text-sm font-semibold
                text-[#192A56]
                transition
                hover:bg-[#f4cf7a]
              "
            >
              <Plus size={17} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Recent Conversations */}
          <div className="px-4">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Recent Conversations
            </p>

            <div className="space-y-1">
              <button
                onClick={() => handleSuggestionClick("Show me regional performance")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/75 transition hover:bg-white/10"
              >
                <Globe size={15} />
                <span className="truncate">Regional Performance</span>
              </button>

              <button
                onClick={() => handleSuggestionClick("Show me the overall business summary")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/75 transition hover:bg-white/10"
              >
                <BarChart3 size={15} />
                <span className="truncate">Overall Business Summary</span>
              </button>

              <button
                onClick={() => handleSuggestionClick("Show me European sales")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/75 transition hover:bg-white/10"
              >
                <MessageSquare size={15} />
                <span className="truncate">European Sales Analysis</span>
              </button>

              <button
                onClick={() => handleSuggestionClick("Show me cost and profit summary")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/75 transition hover:bg-white/10"
              >
                <Database size={15} />
                <span className="truncate">Cost & Profit Analysis</span>
              </button>
            </div>
          </div>

          {/* Sidebar Bottom */}
          <div className="mt-auto border-t border-white/10 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDA6A3]">
                  <User size={17} className="text-[#192A56]" />
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#192A56] bg-green-400" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">Analytics Workspace</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span className="text-[10px] text-white/50">Cube Semantic Layer</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Section */}
        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#192A56]/10 bg-[#FCFBFB]/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2 hover:bg-[#192A56]/5 lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={21} />
              </button>

              <div>
                <p className="text-xs font-medium text-gray-400">Analytics Workspace</p>
                <h2 className="text-sm font-semibold text-[#192A56]">MetricMind AI</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-[10px] font-medium text-green-700 sm:text-xs">
                Cube Connected
              </span>
            </div>
          </header>

          {/* Content */}
          <div className="flex flex-1 flex-col">
            {messages.length === 0 ? (
              /* Welcome Screen */
              <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
                <div className="w-full max-w-4xl">
                  <div className="mb-10 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#192A56] shadow-lg">
                      <Sparkles size={28} className="text-[#F7D794]" />
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-[#192A56] sm:text-4xl">
                      Ask your data anything.
                    </h2>

                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
                      Query corporate sales, quarterly performance, regional trends, product rankings, and profitability powered by the Cube semantic layer.
                    </p>
                  </div>

                  {/* Suggestions */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {suggestions.map((suggestion) => {
                      const Icon = suggestion.icon;

                      return (
                        <button
                          key={suggestion.title}
                          onClick={() => handleSuggestionClick(suggestion.description)}
                          className="
                            group rounded-2xl
                            border border-[#192A56]/10
                            bg-white
                            p-5
                            text-left
                            shadow-sm
                            transition
                            hover:-translate-y-0.5
                            hover:border-[#192A56]/20
                            hover:shadow-md
                          "
                        >
                          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7D794]/40">
                            <Icon size={19} className="text-[#192A56]" />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold text-[#192A56]">
                                {suggestion.title}
                              </h3>
                              <p className="mt-1 text-xs leading-5 text-gray-500">
                                {suggestion.description}
                              </p>
                            </div>

                            <ChevronRight
                              size={16}
                              className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#192A56]"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-8 text-center text-[10px] text-gray-400 sm:text-xs">
                    Powered by MetricMind Semantic BI Engine · PostgreSQL · dbt · Cube
                  </p>
                </div>
              </div>
            ) : (
              /* Chat Conversation */
              <div className="flex flex-1 flex-col">
                <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 sm:gap-4 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192A56]">
                            <Bot size={18} className="text-[#F7D794]" />
                          </div>
                        )}

                        <div
                          className={`min-w-0 ${
                            message.role === "user"
                              ? "max-w-[85%] sm:max-w-[75%]"
                              : "w-full max-w-[95%] sm:max-w-[90%]"
                          }`}
                        >
                          <div
                            className={`mb-1.5 flex items-center gap-2 text-xs font-semibold ${
                              message.role === "user" ? "justify-end text-gray-500" : "text-[#192A56]"
                            }`}
                          >
                            <span>{message.role === "user" ? "You" : "MetricMind AI"}</span>
                            {message.role === "assistant" && message.kpis && (
                              <span className="rounded-md bg-[#192A56]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#192A56]">
                                Business Summary
                              </span>
                            )}
                            {message.role === "assistant" && message.regionalItems && (
                              <span className="rounded-md border border-indigo-200/60 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900">
                                Regional Analysis
                              </span>
                            )}
                          </div>

                          {/* Message Bubble with Markdown rendering */}
                          <div
                            className={`rounded-2xl px-5 py-4 shadow-sm ${
                              message.role === "user"
                                ? "rounded-br-md bg-[#192A56] text-white"
                                : "rounded-bl-md border border-[#192A56]/10 bg-white text-[#192A56]"
                            }`}
                          >
                            <MarkdownRenderer
                              content={message.content}
                              isUser={message.role === "user"}
                            />
                          </div>

                          {/* 6 Key Metrics KPI Cards for Business Summary */}
                          {message.kpis && (
                            <div className="mt-4">
                              <KpiCards
                                data={message.kpis}
                                title="Executive Business Summary (Cube Governed)"
                                isConfirmedCurrency={false}
                              />
                            </div>
                          )}

                          {/* Regional Performance Leaderboard (Ranked by Revenue) */}
                          {message.regionalItems && (
                            <div className="mt-4">
                              <RegionalLeaderboard
                                items={message.regionalItems}
                                title="Regional Performance Leaderboard (Ranked by Revenue)"
                              />
                            </div>
                          )}

                          {/* Dynamic Chart */}
                          {message.chart && (
                            <div className="mt-4">
                              <DynamicChart
                                type={message.chart.type}
                                title={message.chart.title}
                                subtitle={message.chart.subtitle}
                                data={message.chart.data}
                              />
                            </div>
                          )}

                          {/* Action Buttons */}
                          {message.role === "assistant" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {/* View API Call */}
                              {message.api && (
                                <button
                                  onClick={() =>
                                    setShowApiCall(showApiCall === message.id ? null : message.id)
                                  }
                                  className="
                                    rounded-lg
                                    border
                                    border-[#192A56]/15
                                    bg-white
                                    px-3 py-2
                                    text-xs
                                    font-medium
                                    text-[#192A56]
                                    transition
                                    hover:border-[#192A56]/30
                                    hover:bg-[#192A56]/5
                                  "
                                >
                                  {showApiCall === message.id ? "Hide API Call" : "View API Call"}
                                </button>
                              )}

                              {/* View SQL */}
                              {message.sql && (
                                <button
                                  onClick={() =>
                                    setShowSql(showSql === message.id ? null : message.id)
                                  }
                                  className="
                                    rounded-lg
                                    border
                                    border-[#192A56]/15
                                    bg-white
                                    px-3 py-2
                                    text-xs
                                    font-medium
                                    text-[#192A56]
                                    transition
                                    hover:border-[#192A56]/30
                                    hover:bg-[#192A56]/5
                                  "
                                >
                                  {showSql === message.id ? "Hide SQL" : "View SQL"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* API Call Details Panel */}
                          {showApiCall === message.id && message.api && (
                            <div className="mt-3 rounded-xl border border-[#192A56]/10 bg-[#192A56] p-4 text-white">
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-[#F7D794]">API CALL</h4>
                                <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/60">
                                  {message.api.method}
                                </span>
                              </div>

                              <p className="mb-3 break-all rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
                                {message.api.endpoint}
                              </p>

                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-white/40">
                                Validated Query Payload
                              </p>

                              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-5 text-[#F7D794]">
                                {JSON.stringify(message.api.request, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Genuine SQL Details Panel */}
                          {showSql === message.id && message.sql && (
                            <div className="mt-3 rounded-xl border border-[#192A56]/10 bg-[#192A56] p-4 text-white">
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-[#F7D794]">
                                  CUBE GENERATED SQL (POSTGRESQL)
                                </h4>
                                <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/60">
                                  Executed on PostgreSQL
                                </span>
                              </div>

                              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-5 text-[#F7D794]">
                                {message.sql}
                              </pre>
                            </div>
                          )}
                        </div>

                        {message.role === "user" && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDA6A3]">
                            <User size={18} className="text-[#192A56]" />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Loading Animation */}
                    {isLoading && (
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192A56]">
                          <Bot size={18} className="text-[#F7D794]" />
                        </div>

                        <div>
                          <div className="mb-1 text-xs font-semibold opacity-60">MetricMind AI</div>
                          <div className="rounded-2xl rounded-bl-md border border-[#192A56]/10 bg-white px-5 py-4 shadow-sm">
                            <div className="flex gap-1.5 items-center">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-[#192A56]" />
                              <span
                                className="h-2 w-2 animate-bounce rounded-full bg-[#192A56]"
                                style={{ animationDelay: "150ms" }}
                              />
                              <span
                                className="h-2 w-2 animate-bounce rounded-full bg-[#192A56]"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Input Form */}
            <div className="sticky bottom-0 border-t border-[#192A56]/10 bg-[#FCFBFB]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-4xl">
                <div className="relative rounded-2xl border border-[#192A56]/15 bg-white shadow-sm transition focus-within:border-[#192A56]/30 focus-within:shadow-md">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about your business data (e.g. 'Show me regional performance', 'Show me the overall business summary', 'What is our cost and profit?')..."
                    rows={1}
                    className="
                      min-h-[58px]
                      w-full
                      resize-none
                      rounded-2xl
                      bg-transparent
                      px-5
                      py-4
                      pr-16
                      text-sm
                      text-[#192A56]
                      outline-none
                      placeholder:text-gray-400
                    "
                  />

                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="
                      absolute
                      bottom-2.5
                      right-2.5
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-[#192A56]
                      text-white
                      transition
                      hover:bg-[#22366d]
                      disabled:cursor-not-allowed
                      disabled:opacity-30
                    "
                    aria-label="Send message"
                  >
                    <Send size={17} />
                  </button>
                </div>

                <div className="mt-2 px-1">
                  <p className="text-[10px] text-gray-400 sm:text-xs">
                    Press Enter to send · Shift + Enter for a new line
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}