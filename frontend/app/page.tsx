"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Sparkles,
  UploadCloud,
  FileText,
  TrendingUp,
  AlertTriangle,
  Settings,
  Menu,
  X,
  Search,
  Filter,
  Download,
  Plus,
  Send,
  Bot,
  User,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Building2,
  Zap,
  BarChart3,
  Calendar,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

import DynamicChart from "./components/charts/DynamicChart";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type TabKey =
  | "dashboard"
  | "assistant"
  | "import"
  | "reports"
  | "forecasting"
  | "alerts"
  | "settings";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  chart?: any;
  api?: any;
  sql?: string;
  comparison?: any;
  language?: string;
  data?: any[];
};

export default function MetricMindSaaSApp() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Filters State
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  // Dashboard Data State
  const [kpis, setKpis] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Dataset Management State
  const [datasetsInfo, setDatasetsInfo] = useState<{
    active_dataset_id: string;
    active_dataset_name: string;
    active_dataset_row_count: number;
    datasets: any[];
  } | null>(null);
  const [switchingDataset, setSwitchingDataset] = useState(false);

  // AI Assistant State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<any>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reports State
  const [reportPeriod, setReportPeriod] = useState<string>("monthly");
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Forecasting State
  const [forecastHorizon, setForecastHorizon] = useState<number>(6);
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Alerts State
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [alertsHistory, setAlertsHistory] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [scanningAlerts, setScanningAlerts] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleMetric, setNewRuleMetric] = useState("margin_floor");
  const [newRuleThreshold, setNewRuleThreshold] = useState("20");

  // Settings & Subscription State
  const [plans, setPlans] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Notification Banner
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showToast = (type: "success" | "error" | "info", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  // Helper fetch with auth
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `HTTP Error ${res.status}`);
    }
    return res.json();
  };

  // 1. Fetch Dashboard Analytics
  const loadDashboardData = async (datasetId?: string) => {
    setLoadingDashboard(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear !== "all") params.append("year", selectedYear);
      if (selectedQuarter !== "all") params.append("quarter", selectedQuarter);
      if (selectedRegion !== "all") params.append("region", selectedRegion);

      const effectiveDsId = datasetId || datasetsInfo?.active_dataset_id;
      if (effectiveDsId) params.append("dataset_id", effectiveDsId);

      const qs = params.toString() ? `?${params.toString()}` : "";

      const [kpisRes, trendsRes, bdRes] = await Promise.all([
        apiFetch(`/api/analytics/overview${qs}`),
        apiFetch(`/api/analytics/trends${qs}`),
        apiFetch(`/api/analytics/breakdown${qs}`),
      ]);

      setKpis(kpisRes);
      setTrends(trendsRes);
      setBreakdown(bdRes);
    } catch (err: any) {
      console.error("Dashboard load failed:", err);
      showToast("error", `Failed to load dashboard metrics: ${err.message}`);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadDatasets = async () => {
    try {
      const res = await apiFetch("/api/datasets");
      setDatasetsInfo(res);
      return res;
    } catch (err: any) {
      console.error("Failed to load datasets:", err);
    }
  };

  const handleSwitchDataset = async (datasetId: string) => {
    setSwitchingDataset(true);
    try {
      const res = await apiFetch("/api/datasets/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId }),
      });
      setDatasetsInfo(res);
      showToast("success", `Active dataset switched to '${res.active_dataset_name}' (${res.active_dataset_row_count.toLocaleString()} records).`);
      await loadDashboardData(datasetId);
      if (activeTab === "reports") loadReports(datasetId);
      if (activeTab === "forecasting") loadForecast(datasetId);
    } catch (err: any) {
      showToast("error", `Failed to switch dataset: ${err.message}`);
    } finally {
      setSwitchingDataset(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedYear, selectedQuarter, selectedRegion]);

  // 2. Fetch Reports
  const loadReports = async (datasetId?: string) => {
    setReportLoading(true);
    try {
      const effectiveDsId = datasetId || datasetsInfo?.active_dataset_id;
      const dsParam = effectiveDsId ? `&dataset_id=${effectiveDsId}` : "";
      const res = await apiFetch(`/api/reports/summary?period_type=${reportPeriod}${dsParam}`);
      setReportData(res);
    } catch (err: any) {
      console.error("Reports load error:", err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reports") {
      loadReports();
    }
  }, [activeTab, reportPeriod]);

  // 3. Fetch Forecasting
  const loadForecast = async (datasetId?: string) => {
    setForecastLoading(true);
    try {
      const effectiveDsId = datasetId || datasetsInfo?.active_dataset_id;
      const dsParam = effectiveDsId ? `&dataset_id=${effectiveDsId}` : "";
      const res = await apiFetch(`/api/analytics/forecast?horizon_months=${forecastHorizon}${dsParam}`);
      setForecastData(res);
    } catch (err: any) {
      console.error("Forecast load error:", err);
      setForecastData(null);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "forecasting") {
      loadForecast();
    }
  }, [activeTab, forecastHorizon]);

  // 4. Fetch Alerts
  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const [rules, hist] = await Promise.all([
        apiFetch("/api/alerts/rules"),
        apiFetch("/api/alerts/history"),
      ]);
      setAlertsList(rules);
      setAlertsHistory(hist);
    } catch (err: any) {
      console.error("Alerts load error:", err);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "alerts") {
      loadAlerts();
    }
  }, [activeTab]);

  // 5. Fetch Settings & Subscriptions
  const loadSettings = async () => {
    try {
      const [plansRes, usageRes, teamRes, histRes] = await Promise.all([
        apiFetch("/api/subscription/plans"),
        apiFetch("/api/subscription/usage"),
        apiFetch("/api/org/users").catch(() => []),
        apiFetch("/api/import/history").catch(() => []),
      ]);
      setPlans(plansRes);
      setUsage(usageRes);
      setTeamMembers(teamRes);
      setImportHistory(histRes);
    } catch (err: any) {
      console.error("Settings load error:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "settings" || activeTab === "import") {
      loadSettings();
    }
  }, [activeTab]);

  // AI Chat Handler
  const handleSendChat = async (overridePrompt?: string) => {
    const question = (overridePrompt || chatInput).trim();
    if (!question || chatLoading) return;

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await apiFetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          dataset_id: datasetsInfo?.active_dataset_id,
        }),
      });

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: res.summary_text,
        chart: res.chart_config,
        comparison: res.comparison,
        language: res.language,
        data: res.data,
        api: {
          method: "POST",
          endpoint: "/api/ai/query",
          request: { question },
          semanticQuery: res.semantic_query,
        },
        sql: `SELECT ${res.semantic_query?.dimensions?.join(", ") || ""}, ${res.semantic_query?.measures?.join(", ") || ""}
FROM public.sales_summary
${res.semantic_query?.time_range ? `WHERE order_date ${res.semantic_query.time_range}` : ""}
LIMIT ${res.semantic_query?.limit || 50};`,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `Apologies, I could not complete this inquiry: ${err.message}. Please refine your query or ensure parameters are supported.`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // File Upload Preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    try {
      const previewRes = await fetch(`${API_BASE_URL}/api/import/preview`, {
        method: "POST",
        body: formData,
      });
      if (!previewRes.ok) {
        const errJson = await previewRes.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to preview file");
      }
      const data = await previewRes.json();
      setFilePreview(data);

      // Auto-assign suggested mappings
      const initialMap: Record<string, string> = {};
      data.columns.forEach((c: any) => {
        if (c.suggested_field) {
          initialMap[c.suggested_field] = c.source_column;
        }
      });
      setColumnMappings(initialMap);
      showToast("info", `File '${file.name}' preview loaded with ${data.total_rows} rows.`);
    } catch (err: any) {
      showToast("error", `File preview error: ${err.message}`);
      setSelectedFile(null);
    } finally {
      setImporting(false);
    }
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!filePreview || !filePreview.file_id || !selectedFile) return;

    setImporting(true);
    try {
      const mappingsList = Object.entries(columnMappings).map(([target, src]) => ({
        target_field: target,
        source_column: src,
      }));

      const formData = new FormData();
      formData.append("file_id", filePreview.file_id);
      formData.append("filename", selectedFile.name);
      formData.append("column_mappings_json", JSON.stringify(mappingsList));

      const res = await fetch(`${API_BASE_URL}/api/import/confirm`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Import confirmation failed");
      }

      const result = await res.json();
      setImportStatus(result);
      showToast("success", result.message);
      setSelectedFile(null);
      setFilePreview(null);
      await loadDatasets();
      await loadDashboardData(result.dataset_id);
      loadSettings();
    } catch (err: any) {
      showToast("error", `Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Download Reports
  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    try {
      const dsParam = datasetsInfo?.active_dataset_id ? `&dataset_id=${datasetsInfo.active_dataset_id}` : "";
      const response = await fetch(`${API_BASE_URL}/api/reports/export/excel?period_type=${reportPeriod}${dsParam}`);
      if (!response.ok) throw new Error("Excel export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MetricMind_Report_${reportPeriod}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("success", "Excel report downloaded successfully.");
    } catch (err: any) {
      showToast("error", `Export failed: ${err.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const dsParam = datasetsInfo?.active_dataset_id ? `&dataset_id=${datasetsInfo.active_dataset_id}` : "";
      const response = await fetch(`${API_BASE_URL}/api/reports/export/pdf?period_type=${reportPeriod}${dsParam}`);
      if (!response.ok) throw new Error("PDF export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MetricMind_Report_${reportPeriod}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("success", "PDF report downloaded successfully.");
    } catch (err: any) {
      showToast("error", `PDF export failed: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Scan Alerts
  const handleScanAlerts = async () => {
    setScanningAlerts(true);
    try {
      const res = await apiFetch("/api/alerts/scan", { method: "POST" });
      showToast(
        "info",
        `Scan complete: ${res.total_anomalies_detected} statistical anomalies and ${res.total_rule_breaches} rule triggers identified.`
      );
      loadAlerts();
    } catch (err: any) {
      showToast("error", `Scan error: ${err.message}`);
    } finally {
      setScanningAlerts(false);
    }
  };

  // Create Alert Rule
  const handleCreateRule = async () => {
    if (!newRuleName.trim()) return;
    try {
      await apiFetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRuleName,
          metric: newRuleMetric,
          condition: "less_than",
          threshold: parseFloat(newRuleThreshold) || 20,
        }),
      });
      showToast("success", "Custom alert rule created.");
      setShowNewRuleModal(false);
      setNewRuleName("");
      loadAlerts();
    } catch (err: any) {
      showToast("error", `Failed to create rule: ${err.message}`);
    }
  };

  const navItems = [
    { key: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    { key: "assistant", label: "AI Business Assistant", icon: Sparkles },
    { key: "import", label: "Data Import (CSV / Excel)", icon: UploadCloud },
    { key: "reports", label: "Automated Reports", icon: FileText },
    { key: "forecasting", label: "Sales Forecasting", icon: TrendingUp },
    { key: "alerts", label: "Smart Alerts & Anomaly", icon: AlertTriangle },
    { key: "settings", label: "Workspace & Subscriptions", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#1E293B]">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg transition animate-in fade-in slide-in-from-top-2 ${
            notification.type === "success"
              ? "bg-emerald-600 text-white"
              : notification.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-[#192A56] text-white"
          }`}
        >
          {notification.type === "success" && <CheckCircle2 size={16} />}
          {notification.type === "error" && <AlertCircle size={16} />}
          {notification.type === "info" && <Zap size={16} className="text-[#F7D794]" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =========================================================
          SIDEBAR
      ========================================================= */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col bg-[#192A56] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F7D794] to-[#ecc062] shadow-sm">
              <BarChart3 size={22} className="text-[#192A56]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">MetricMind AI</h1>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] font-medium text-white/60">Semantic BI SaaS</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tenant Organization Pill */}
        <div className="px-5 pt-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">
                Active Organization
              </span>
              <span className="rounded-md bg-[#F7D794]/20 px-2 py-0.5 text-[10px] font-bold text-[#F7D794]">
                PRO TIER
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">MetricMind Demo Corp</p>
            <p className="text-[11px] text-white/60">Tenant ID: org_metricmind_demo</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key as TabKey);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#F7D794] text-[#192A56] shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#192A56]" : "text-white/70"} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* =========================================================
          MAIN APPLICATION AREA
      ========================================================= */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Global Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-[#192A56]">
                {navItems.find((n) => n.key === activeTab)?.label}
              </h2>
              <p className="text-[11px] text-slate-500">
                MetricMind SaaS Platform · Enterprise Analytics Workspace
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            {activeTab === "dashboard" && (
              <div className="hidden items-center gap-2 sm:flex">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="all">All Years</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>

                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="all">All Quarters</option>
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>

                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="all">All Regions</option>
                  <option value="North America">North America</option>
                  <option value="Europe">Europe</option>
                  <option value="Asia Pacific">Asia Pacific</option>
                  <option value="Latin America">Latin America</option>
                </select>
              </div>
            )}

            <button
              onClick={() => {
                if (activeTab === "dashboard") loadDashboardData();
                else if (activeTab === "reports") loadReports();
                else if (activeTab === "forecasting") loadForecast();
                else if (activeTab === "alerts") loadAlerts();
                showToast("info", "Data reloaded from semantic layer.");
              }}
              title="Refresh Analytics"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={loadingDashboard ? "animate-spin" : ""} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Governed
            </div>
          </div>
        </header>

        {/* Tab Content Renderer */}
        <div className="p-6">
          {/* =========================================================
              TAB 1: EXECUTIVE DASHBOARD
          ========================================================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Active Dataset Selection & Governance Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#192A56] text-[#F7D794] shadow-sm">
                    <Database size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Active Analyzed Dataset
                      </span>
                      {datasetsInfo?.active_dataset_id === "ds_demo_corporate" ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Demo Baseline
                        </span>
                      ) : datasetsInfo?.active_dataset_id === "all" ? (
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                          Combined Datasets
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Uploaded Dataset
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[#192A56] flex items-center gap-2">
                      <span>{kpis?.active_dataset?.filename || datasetsInfo?.active_dataset_name || "MetricMind Corporate Sales"}</span>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {(kpis?.active_dataset?.row_count ?? datasetsInfo?.active_dataset_row_count ?? 0).toLocaleString()} verified records
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Dataset Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="active-dataset-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Switch Dataset:
                  </label>
                  <select
                    id="active-dataset-select"
                    value={datasetsInfo?.active_dataset_id || "ds_demo_corporate"}
                    onChange={(e) => handleSwitchDataset(e.target.value)}
                    disabled={switchingDataset}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#192A56] shadow-2xs outline-none focus:border-[#192A56] disabled:opacity-50"
                  >
                    {datasetsInfo?.datasets?.map((ds: any) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.filename} ({ds.row_count.toLocaleString()} rows)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 7 KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Total Revenue */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Total Revenue
                    </p>
                    <span className="flex items-center text-xs font-bold text-emerald-600">
                      <ArrowUpRight size={14} /> +{kpis?.revenue_growth_percent ?? 12.4}%
                    </span>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#192A56]">
                    ${kpis ? Number(kpis.total_revenue).toLocaleString() : "..."}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">Total verified gross billings</p>
                </div>

                {/* 2. Total Profit */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Total Net Profit
                    </p>
                    <span className="flex items-center text-xs font-bold text-emerald-600">
                      <ArrowUpRight size={14} /> +{kpis?.profit_growth_percent ?? 9.8}%
                    </span>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                    ${kpis ? Number(kpis.total_profit).toLocaleString() : "..."}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">Revenue minus total operational costs</p>
                </div>

                {/* 3. Total Costs */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Total Costs
                    </p>
                    <span className="text-[11px] font-semibold text-slate-400">Materials & Ops</span>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-700">
                    ${kpis ? Number(kpis.total_costs).toLocaleString() : "..."}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">Shipping, Labor, Material & Marketing</p>
                </div>

                {/* 4. Profit Margin % */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Profit Margin %
                    </p>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Healthy Standard
                    </span>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#192A56]">
                    {kpis ? `${kpis.profit_margin_percent}%` : "..."}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">Governed weighted net margin</p>
                </div>
              </div>

              {/* Remaining 3 Secondary KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* 5. Total Orders */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500">Total Orders</p>
                  <p className="mt-1 text-xl font-bold text-[#192A56]">
                    {kpis ? Number(kpis.total_orders).toLocaleString() : "..."}
                  </p>
                  <p className="text-[11px] text-slate-400">Processed transaction records</p>
                </div>

                {/* 6. Units Sold */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500">Total Units Sold</p>
                  <p className="mt-1 text-xl font-bold text-[#192A56]">
                    {kpis ? Number(kpis.units_sold).toLocaleString() : "..."}
                  </p>
                  <p className="text-[11px] text-slate-400">Physical & digital product units</p>
                </div>

                {/* 7. Average Order Value (AOV) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500">Average Order Value (AOV)</p>
                  <p className="mt-1 text-xl font-bold text-[#192A56]">
                    ${kpis ? Number(kpis.average_order_value).toLocaleString() : "..."}
                  </p>
                  <p className="text-[11px] text-slate-400">Average basket value per order</p>
                </div>
              </div>

              {/* Chart Row 1: Monthly Trends & Revenue vs Cost */}
              <div className="grid gap-6 lg:grid-cols-2">
                <DynamicChart
                  type="line"
                  title="Revenue & Profit Trends"
                  subtitle="Monthly trend across current historical timeline"
                  data={{
                    labels: trends?.monthly_trend?.map((m: any) => m.label) || [],
                    series: [
                      {
                        name: "Revenue ($)",
                        data: trends?.monthly_trend?.map((m: any) => m.revenue) || [],
                        color: "#192A56",
                      },
                      {
                        name: "Profit ($)",
                        data: trends?.monthly_trend?.map((m: any) => m.profit) || [],
                        color: "#10B981",
                      },
                    ],
                  }}
                  formatAsCurrency={true}
                  height={300}
                />

                <DynamicChart
                  type="bar"
                  title="Revenue vs Operational Costs"
                  subtitle="Comparison of revenue intake against total operational expenditure"
                  data={{
                    labels: trends?.revenue_vs_costs?.map((m: any) => m.period) || [],
                    series: [
                      {
                        name: "Revenue",
                        data: trends?.revenue_vs_costs?.map((m: any) => m.revenue) || [],
                        color: "#192A56",
                      },
                      {
                        name: "Costs",
                        data: trends?.revenue_vs_costs?.map((m: any) => m.total_cost) || [],
                        color: "#EF4444",
                      },
                    ],
                  }}
                  formatAsCurrency={true}
                  height={300}
                />
              </div>

              {/* Chart Row 2: Top Products & Regional Performance */}
              <div className="grid gap-6 lg:grid-cols-2">
                <DynamicChart
                  type="bar"
                  title="Top 5 Products by Revenue"
                  subtitle="Highest revenue generating commercial offerings"
                  data={{
                    labels: breakdown?.top_products?.map((p: any) => p.product) || [],
                    values: breakdown?.top_products?.map((p: any) => p.revenue) || [],
                  }}
                  formatAsCurrency={true}
                  height={280}
                />

                <DynamicChart
                  type="bar"
                  title="Regional Sales Distribution"
                  subtitle="Gross revenue performance broken down by geographic market"
                  data={{
                    labels: breakdown?.regional_performance?.map((r: any) => r.region) || [],
                    values: breakdown?.regional_performance?.map((r: any) => r.revenue) || [],
                  }}
                  formatAsCurrency={true}
                  height={280}
                />
              </div>

              {/* Chart Row 3: Sales by Channel & Low Margin Watch */}
              <div className="grid gap-6 lg:grid-cols-2">
                <DynamicChart
                  type="pie"
                  title="Sales by Channel"
                  subtitle="Revenue distribution across Enterprise, Online, Retail, and Direct"
                  data={{
                    labels: breakdown?.sales_by_channel?.map((c: any) => c.channel) || [],
                    values: breakdown?.sales_by_channel?.map((c: any) => c.revenue) || [],
                  }}
                  height={280}
                />

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#192A56]">
                        Underperforming Margin Alert
                      </h3>
                      <p className="text-xs text-slate-500">
                        Products with lowest relative profit margins
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Needs Attention
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="pb-2 font-semibold">Product</th>
                          <th className="pb-2 text-right font-semibold">Revenue</th>
                          <th className="pb-2 text-right font-semibold">Profit</th>
                          <th className="pb-2 text-right font-semibold">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {breakdown?.underperforming_products?.map((p: any) => (
                          <tr key={p.product} className="hover:bg-slate-50">
                            <td className="py-2.5 font-medium text-slate-800">{p.product}</td>
                            <td className="py-2.5 text-right text-slate-600">
                              ${Number(p.revenue).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right text-slate-600">
                              ${Number(p.profit).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right font-bold text-amber-600">
                              {p.margin_percent}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: AI BUSINESS ASSISTANT (CONVERSATIONAL ANALYTICS)
          ========================================================= */}
          {activeTab === "assistant" && (
            <div className="flex h-[calc(100vh-140px)] flex-col rounded-2xl border border-slate-200 bg-white shadow-xs">
              {/* Chat Subheader with Active Dataset Info */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 bg-slate-50/70 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Database size={14} className="text-[#192A56]" />
                  <span className="font-semibold">Context Dataset:</span>
                  <span className="font-bold text-[#192A56]">{datasetsInfo?.active_dataset_name || "MetricMind Corporate Sales"}</span>
                  <span className="text-[11px] text-slate-400">({datasetsInfo?.active_dataset_row_count?.toLocaleString()} records)</span>
                </div>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className="text-[11px] font-semibold text-[#192A56] hover:underline"
                >
                  Change Dataset
                </button>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="mx-auto max-w-2xl text-center py-12">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#192A56] text-[#F7D794] shadow-sm">
                      <Sparkles size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-[#192A56]">
                      Ask Your Data in English or Hindi
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      MetricMind converts natural business questions into governed semantic queries
                      validated against Cube.js and PostgreSQL.
                    </p>

                    {/* Suggested Question Pills */}
                    <div className="mt-6 grid gap-2.5 sm:grid-cols-2 text-left">
                      {[
                        "Which product generated the highest profit this month?",
                        "What were my top five products by revenue?",
                        "Why did revenue decrease compared with the previous month?",
                        "Kaun se region mein profit margin sabse kam hai?",
                        "Is mahine sabse zyada profit kis product se hua?",
                        "How did revenue and profit change this quarter?",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSendChat(prompt)}
                          className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 transition hover:border-[#192A56]/30 hover:bg-white hover:shadow-xs"
                        >
                          <span className="truncate pr-2">{prompt}</span>
                          <ChevronRight size={14} className="shrink-0 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3.5 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192A56] text-[#F7D794]">
                          <Bot size={18} />
                        </div>
                      )}

                      <div
                        className={`min-w-0 max-w-[85%] ${
                          msg.role === "user" ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`mb-1 text-[11px] font-semibold text-slate-400 ${
                            msg.role === "user" ? "text-right" : "text-left"
                          }`}
                        >
                          {msg.role === "user" ? "You" : "MetricMind AI"}
                          {msg.language === "hi" && " · Hindi Response"}
                        </div>

                        <div
                          className={`rounded-2xl px-5 py-3.5 text-xs leading-relaxed ${
                            msg.role === "user"
                              ? "rounded-br-none bg-[#192A56] text-white"
                              : "rounded-bl-none border border-slate-200 bg-white text-slate-800 shadow-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          {/* Render Dynamic Chart if returned */}
                          {msg.chart && (
                            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-2xs">
                              <DynamicChart
                                type={msg.chart.type}
                                title={msg.chart.title}
                                subtitle={msg.chart.subtitle}
                                data={msg.chart.data}
                                height={260}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {msg.role === "user" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F7D794] text-[#192A56] font-bold text-xs">
                          U
                        </div>
                      )}
                    </div>
                  ))
                )}

                {chatLoading && (
                  <div className="flex gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192A56] text-[#F7D794]">
                      <Bot size={18} />
                    </div>
                    <div className="rounded-2xl rounded-bl-none border border-slate-200 bg-white px-5 py-3.5 text-xs text-slate-600 shadow-xs flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-[#192A56]" />
                      <span>Parsing semantic intent and retrieving verified metrics...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="border-t border-slate-200 p-4">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    placeholder="Ask about revenue, profits, regions, top products (English or Hindi)..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-3 pl-4 pr-12 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#192A56] focus:bg-white focus:outline-none"
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={!chatInput.trim() || chatLoading}
                    className="absolute right-2 rounded-lg bg-[#192A56] p-2 text-white hover:bg-[#23386e] disabled:opacity-40"
                  >
                    <Send size={15} />
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Enforces strict data governance · Prevents arbitrary SQL execution
                </p>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 3: DATA IMPORT (CSV & EXCEL)
          ========================================================= */}
          {activeTab === "import" && (
            <div className="space-y-6">
              {/* File Upload Box */}
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-[#192A56]/50">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#192A56]/5 text-[#192A56]">
                  <UploadCloud size={28} />
                </div>
                <h3 className="mt-3 text-base font-bold text-[#192A56]">
                  Upload Corporate Dataset
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Supports CSV, XLSX, and XLS formats up to 50MB. Auto-detects columns and types.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="flex items-center gap-2 rounded-xl bg-[#192A56] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#22366d] disabled:opacity-50 transition shadow-xs"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Select Dataset File</span>
                  </button>
                  <a
                    href="/MetricMind_Corporate_Sales_Dataset.csv"
                    download="MetricMind_Corporate_Sales_Dataset.csv"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Download size={15} />
                    <span>Download Full Dataset CSV</span>
                  </a>
                  <a
                    href="/sample_50_orders.csv"
                    download="sample_50_orders.csv"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Download size={15} />
                    <span>Download Sample (50 Orders)</span>
                  </a>
                </div>
              </div>

              {/* File Preview & Column Mapping Interface */}
              {filePreview && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#192A56]">Dataset Structure Preview</h4>
                      <p className="text-xs text-slate-500">
                        {filePreview.filename} · {filePreview.total_rows} records detected ·{" "}
                        {filePreview.total_columns} columns
                      </p>
                    </div>
                    {filePreview.duplicate_id_count > 0 && (
                      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        ⚠️ {filePreview.duplicate_id_count} duplicate Order IDs detected
                      </span>
                    )}
                  </div>

                  {/* Mapping Table */}
                  <div>
                    <h5 className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Match Source Columns to MetricMind Standard Fields
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400">
                            <th className="pb-2">MetricMind Business Field</th>
                            <th className="pb-2">Required?</th>
                            <th className="pb-2">Source Dataset Column</th>
                            <th className="pb-2">Inferred Type</th>
                            <th className="pb-2">Sample Preview</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filePreview.supported_fields.map((f: any) => {
                            const matchedCol = filePreview.columns.find(
                              (c: any) => c.source_column === columnMappings[f.field]
                            );
                            return (
                              <tr key={f.field}>
                                <td className="py-2.5 font-semibold text-slate-800">{f.label}</td>
                                <td className="py-2.5">
                                  {f.required ? (
                                    <span className="text-[10px] font-bold text-rose-600">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Optional</span>
                                  )}
                                </td>
                                <td className="py-2.5">
                                  <select
                                    value={columnMappings[f.field] || ""}
                                    onChange={(e) =>
                                      setColumnMappings({
                                        ...columnMappings,
                                        [f.field]: e.target.value,
                                      })
                                    }
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                                  >
                                    <option value="">-- Ignore / Not Present --</option>
                                    {filePreview.columns.map((c: any) => (
                                      <option key={c.source_column} value={c.source_column}>
                                        {c.source_column} ({c.inferred_type})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2.5 text-slate-500">
                                  {matchedCol?.inferred_type || "-"}
                                </td>
                                <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                                  {matchedCol?.sample_values?.slice(0, 2).join(", ") || "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importing}
                      className="flex items-center gap-2 rounded-xl bg-[#192A56] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#23376e] disabled:opacity-50"
                    >
                      <Database size={15} />
                      <span>{importing ? "Ingesting Data..." : "Confirm & Ingest Data"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Import History Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h4 className="mb-4 text-sm font-bold text-[#192A56]">Dataset Ingestion History</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="pb-2">Filename</th>
                        <th className="pb-2">Ingested Rows</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            Preloaded demo enterprise dataset (5,000 corporate records) active.
                          </td>
                        </tr>
                      ) : (
                        importHistory.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2.5 font-medium text-slate-800">{item.filename}</td>
                            <td className="py-2.5 text-slate-600 font-mono">
                              {Number(item.row_count).toLocaleString()}
                            </td>
                            <td className="py-2.5">
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                {item.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-400">{item.created_at || "Recent"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: AUTOMATED REPORTS & EXPORTS
          ========================================================= */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              {/* Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#192A56]">
                    Automated Executive Reports
                  </h3>
                  <p className="text-xs text-slate-500">
                    Generate point-in-time executive summaries with verified timestamps and export.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="weekly">Weekly Summary</option>
                    <option value="monthly">Monthly Report</option>
                    <option value="quarterly">Quarterly Review</option>
                    <option value="annual">Annual Fiscal Report</option>
                  </select>

                  <button
                    onClick={handleDownloadExcel}
                    disabled={exportingExcel}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={15} />
                    <span>{exportingExcel ? "Generating..." : "Export Excel (.xlsx)"}</span>
                  </button>

                  <button
                    onClick={handleDownloadPdf}
                    disabled={exportingPdf}
                    className="flex items-center gap-1.5 rounded-xl bg-[#192A56] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#22366d] disabled:opacity-50"
                  >
                    <Download size={15} />
                    <span>{exportingPdf ? "Generating..." : "Export PDF"}</span>
                  </button>
                </div>
              </div>

              {/* Report Preview Document Card */}
              {reportData && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="rounded-md bg-[#192A56] px-2.5 py-1 text-[10px] font-bold text-[#F7D794]">
                      OFFICIAL BI REPORT
                    </span>
                    <h2 className="mt-2 text-xl font-bold text-[#192A56]">{reportData.title}</h2>
                    <p className="text-xs text-slate-400">
                      Generated: {reportData.generated_at} · Verified by MetricMind Engine
                    </p>
                  </div>

                  {/* Findings */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Strategic Findings & Performance Insights
                    </h4>
                    <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                      {reportData.findings.map((finding: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-600 mt-0.5" />
                          <span>{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KPI Summary Grid */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Executive Metrics Summary
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[11px] text-slate-400">Total Revenue</p>
                        <p className="text-base font-bold text-[#192A56]">
                          ${Number(reportData.kpis.total_revenue).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[11px] text-slate-400">Net Profit</p>
                        <p className="text-base font-bold text-emerald-600">
                          ${Number(reportData.kpis.total_profit).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[11px] text-slate-400">Margin %</p>
                        <p className="text-base font-bold text-[#192A56]">
                          {reportData.kpis.profit_margin_percent}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[11px] text-slate-400">Total Transactions</p>
                        <p className="text-base font-bold text-slate-700">
                          {Number(reportData.kpis.total_orders).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Top Products Table */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Top Products in Reporting Window
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400">
                            <th className="pb-2">Product Name</th>
                            <th className="pb-2 text-right">Revenue</th>
                            <th className="pb-2 text-right">Profit</th>
                            <th className="pb-2 text-right">Units</th>
                            <th className="pb-2 text-right">Margin %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportData.top_products.map((p: any) => (
                            <tr key={p.product}>
                              <td className="py-2.5 font-semibold text-slate-800">{p.product}</td>
                              <td className="py-2.5 text-right font-medium text-slate-600">
                                ${Number(p.revenue).toLocaleString()}
                              </td>
                              <td className="py-2.5 text-right font-medium text-emerald-600">
                                ${Number(p.profit).toLocaleString()}
                              </td>
                              <td className="py-2.5 text-right text-slate-500">
                                {Number(p.units_sold).toLocaleString()}
                              </td>
                              <td className="py-2.5 text-right font-bold text-[#192A56]">
                                {p.margin_percent}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 5: SALES FORECASTING
          ========================================================= */}
          {activeTab === "forecasting" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#192A56]">
                    Statistical Sales Forecasting
                  </h3>
                  <p className="text-xs text-slate-500">
                    Holt-Winters double exponential smoothing with trend and 95% confidence intervals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Horizon:</span>
                  {[3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setForecastHorizon(m)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        forecastHorizon === m
                          ? "bg-[#192A56] text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {m} Months
                    </button>
                  ))}
                </div>
              </div>

              {/* Insufficient Observations Notice if Selected Dataset is Short */}
              {!forecastLoading && !forecastData && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800 mb-3">
                    <AlertTriangle size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Insufficient Multi-Month Observations in Selected Dataset
                  </h4>
                  <p className="mt-2 text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
                    The currently selected dataset (<strong>{datasetsInfo?.active_dataset_name || "Uploaded Dataset"}</strong>) contains short-interval records. 
                    Holt-Winters statistical forecasting requires at least 4 monthly periods to compute trend, level, and 95% confidence intervals without fabricating points.
                  </p>
                  <button
                    onClick={() => handleSwitchDataset("ds_demo_corporate")}
                    className="mt-4 rounded-xl bg-[#192A56] px-4 py-2 text-xs font-semibold text-white hover:bg-[#23386e] transition shadow-xs"
                  >
                    Switch to Demo Dataset (Multi-Year Time Series)
                  </button>
                </div>
              )}

              {/* Accuracy & Quality Metrics Cards */}
              {forecastData?.evaluation && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold text-slate-400">Forecast Model</p>
                    <p className="text-xs font-bold text-[#192A56]">
                      {forecastData.evaluation.model}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold text-slate-400">Confidence Interval</p>
                    <p className="text-xs font-bold text-emerald-600">
                      {forecastData.evaluation.confidence_level}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold text-slate-400">Mean Abs Error (MAE)</p>
                    <p className="text-xs font-bold text-slate-700">
                      ${Number(forecastData.evaluation.mae).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold text-slate-400">MAPE Accuracy</p>
                    <p className="text-xs font-bold text-slate-700">
                      {forecastData.evaluation.mape_percent}% error
                    </p>
                  </div>
                </div>
              )}

              {/* Forecast Chart */}
              {forecastData && (
                <DynamicChart
                  type="line"
                  title={`Projected ${forecastHorizon}-Month Revenue Trajectory`}
                  subtitle="Actual historical baseline vs projected upper/lower 95% boundaries"
                  data={{
                    labels: [
                      ...forecastData.historical.map((h: any) => h.period),
                      ...forecastData.forecast.map((f: any) => f.period),
                    ],
                    series: [
                      {
                        name: "Actual Revenue",
                        data: [
                          ...forecastData.historical.map((h: any) => h.actual),
                          ...forecastData.forecast.map(() => null),
                        ],
                        color: "#192A56",
                      },
                      {
                        name: "Projected Forecast",
                        data: [
                          ...forecastData.historical.map(() => null),
                          ...forecastData.forecast.map((f: any) => f.forecast),
                        ],
                        color: "#6366F1",
                      },
                      {
                        name: "Upper Bound (95%)",
                        data: [
                          ...forecastData.historical.map(() => null),
                          ...forecastData.forecast.map((f: any) => f.upper_bound),
                        ],
                        color: "#94A3B8",
                      },
                      {
                        name: "Lower Bound (95%)",
                        data: [
                          ...forecastData.historical.map(() => null),
                          ...forecastData.forecast.map((f: any) => f.lower_bound),
                        ],
                        color: "#CBD5E1",
                      },
                    ],
                  }}
                  formatAsCurrency={true}
                  height={320}
                />
              )}

              {/* Legal Disclaimer Box */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Notice & Transparency:</span>{" "}
                {forecastData?.disclaimer ||
                  "Forecasts are statistical projections based on historical patterns and do not represent financial guarantees."}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 6: SMART ALERTS & ANOMALY DETECTION
          ========================================================= */}
          {activeTab === "alerts" && (
            <div className="space-y-6">
              {/* Header & Scan Button */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#192A56]">
                    Smart Alerts & Anomaly Center
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time transaction anomaly scanning (Z-score 3σ) and custom threshold rule enforcement.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowNewRuleModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={15} />
                    <span>Add Alert Rule</span>
                  </button>

                  <button
                    onClick={handleScanAlerts}
                    disabled={scanningAlerts}
                    className="flex items-center gap-1.5 rounded-xl bg-[#192A56] px-4 py-2 text-xs font-semibold text-white hover:bg-[#23386e] disabled:opacity-50"
                  >
                    <Zap size={15} className="text-[#F7D794]" />
                    <span>{scanningAlerts ? "Scanning Engine..." : "Run Anomaly Scan"}</span>
                  </button>
                </div>
              </div>

              {/* Active Configured Rules */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h4 className="mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Configured Threshold Rules
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {alertsList.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-800">{rule.name}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Active
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Trigger when <span className="font-mono text-slate-700">{rule.metric}</span>{" "}
                        {rule.condition === "less_than" ? "<" : ">"} {rule.threshold}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alert History Feed */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h4 className="mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Triggered Alert & Anomaly History
                </h4>
                <div className="space-y-3">
                  {alertsHistory.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No alert violations or anomalies detected.
                    </p>
                  ) : (
                    alertsHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-50"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 rounded-lg p-2 ${
                              item.severity === "critical"
                                ? "bg-rose-100 text-rose-700"
                                : item.severity === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            <AlertTriangle size={16} />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-800">{item.title}</h5>
                            <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                              {item.message}
                            </p>
                            <span className="mt-1.5 inline-block text-[10px] text-slate-400">
                              {item.created_at || "Just now"}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            item.severity === "critical"
                              ? "bg-rose-50 text-rose-700"
                              : item.severity === "warning"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Modal for New Alert Rule */}
              {showNewRuleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-[#192A56]">Create Alert Rule</h3>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Rule Name</label>
                      <input
                        type="text"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="e.g. Critical Margin Warning"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Metric Condition</label>
                      <select
                        value={newRuleMetric}
                        onChange={(e) => setNewRuleMetric(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      >
                        <option value="margin_floor">Profit Margin falls below floor %</option>
                        <option value="revenue_decline">Revenue decline &gt; threshold %</option>
                        <option value="cost_increase">Cost increase &gt; threshold %</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Threshold Value (%)</label>
                      <input
                        type="number"
                        value={newRuleThreshold}
                        onChange={(e) => setNewRuleThreshold(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowNewRuleModal(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateRule}
                        className="rounded-xl bg-[#192A56] px-5 py-2 text-xs font-semibold text-white"
                      >
                        Save Rule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 7: WORKSPACE & SUBSCRIPTIONS
          ========================================================= */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Organization Profile */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#192A56]">Organization Profile</h3>
                    <p className="text-xs text-slate-500">
                      Manage enterprise workspace settings and access control.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Pro Plan Active
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] text-slate-400">Organization Name</p>
                    <p className="text-sm font-semibold text-slate-800">MetricMind Demo Corp</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] text-slate-400">Tenant Slug</p>
                    <p className="text-sm font-mono text-slate-800">demo-corp</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] text-slate-400">Database Data Isolation</p>
                    <p className="text-sm font-semibold text-emerald-600">Strict Tenant Scoped</p>
                  </div>
                </div>
              </div>

              {/* Usage Tracking vs Plan Quotas */}
              {usage && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                  <h4 className="mb-4 text-sm font-bold text-[#192A56]">
                    Monthly Usage Quotas ({usage.month_year})
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600">AI Assistant Inquiries</span>
                        <span className="text-[#192A56]">
                          {usage.usage.ai_queries.used} / {usage.usage.ai_queries.limit}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#192A56] rounded-full"
                          style={{
                            width: `${Math.min(
                              (usage.usage.ai_queries.used / usage.usage.ai_queries.limit) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {usage.usage.ai_queries.remaining} queries remaining this billing cycle
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600">Dataset File Imports</span>
                        <span className="text-[#192A56]">
                          {usage.usage.imports.used} / {usage.usage.imports.limit}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              (usage.usage.imports.used / usage.usage.imports.limit) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {usage.usage.imports.remaining} uploads remaining
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600">Report PDF/Excel Exports</span>
                        <span className="text-[#192A56]">
                          {usage.usage.reports.used} / {usage.usage.reports.limit}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              (usage.usage.reports.used / usage.usage.reports.limit) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {usage.usage.reports.remaining} exports remaining
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Configurable SaaS Plans Comparison */}
              {plans && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                  <h4 className="mb-4 text-sm font-bold text-[#192A56]">
                    Configurable Subscription Tiers
                  </h4>
                  <div className="grid gap-6 sm:grid-cols-3">
                    {Object.values(plans).map((plan: any) => {
                      const isCurrent = plan.id === "pro";
                      return (
                        <div
                          key={plan.id}
                          className={`rounded-2xl p-6 border transition ${
                            isCurrent
                              ? "border-[#192A56] ring-2 ring-[#192A56]/10 bg-slate-50/50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          {isCurrent && (
                            <span className="rounded-md bg-[#192A56] px-2 py-0.5 text-[10px] font-bold text-[#F7D794]">
                              ACTIVE WORKSPACE PLAN
                            </span>
                          )}
                          <h5 className="mt-2 text-base font-bold text-[#192A56]">{plan.name}</h5>
                          <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                          <div className="mt-4 flex items-baseline">
                            <span className="text-2xl font-bold text-slate-900">
                              ${plan.price_monthly_usd}
                            </span>
                            <span className="text-xs text-slate-500">/month</span>
                          </div>

                          <ul className="mt-4 space-y-2 text-xs text-slate-600">
                            <li>• Up to {plan.max_imports_per_month} imports/mo</li>
                            <li>• Up to {plan.max_ai_queries_per_month} AI questions/mo</li>
                            <li>• Up to {plan.max_reports_per_month} exports/mo</li>
                            {plan.features?.forecasting && <li>• Predictive Forecasting Engine</li>}
                            {plan.features?.custom_alerts && <li>• Anomaly Detection & Alerts</li>}
                            {plan.features?.multi_user && <li>• Multi-user team collaboration</li>}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
