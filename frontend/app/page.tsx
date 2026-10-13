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
} from "lucide-react";

import DynamicChart from "./components/charts/DynamicChart";

/* =========================================================
   TYPES
========================================================= */

type ChartData = {
  labels: string[];
  values: number[];
};

type ChartInfo = {
  type: "bar" | "line";
  title: string;
  subtitle?: string;
  data: ChartData;
};

type ApiInfo = {
  method: string;
  endpoint: string;
  request: Record<string, string>;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  chart?: ChartInfo;
  api?: ApiInfo;
  sql?: string;
};

class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}


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
    title: "Q3 Revenue",
    description: "How did Q3 revenue perform?",
    icon: Database,
  },
  {
    title: "Cost & Profit",
    description: "Show me cost and profit summary",
    icon: MessageSquare,
  },
];

/* =========================================================
   HELPER
========================================================= */

const formatCurrency = (value: number) => {
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showApiCall, setShowApiCall] = useState<number | null>(
    null
  );

  const [showSql, setShowSql] = useState<number | null>(null);

  /* =========================================================
     SEND MESSAGE
  ======================================================= */

  const handleSend = (suggestedQuestion?: string) => {
    const question = (suggestedQuestion ?? input).trim();

    if (!question || isLoading) {
      return;
    }

    /* USER MESSAGE */

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsLoading(true);

    /* TEMPORARY DEMO RESPONSE */

    setTimeout(() => {
      const assistantMessage: Message = {
        id: Date.now() + 1,

        role: "assistant",

        content:
          "European sales increased during Q3 compared to Q2. Germany contributed the highest share, followed by France and Spain.",

        /* DYNAMIC CHART INFORMATION */

        chart: {
          type: "bar",

          title: "European Sales",

          subtitle: "Sales by region · Q3",

          data: {
            labels: [
              "Germany",
              "France",
              "Spain",
              "Italy",
            ],

            values: [
              520,
              410,
              280,
              180,
            ],
          },
        },

        /* API INFORMATION */

        api: {
          method: "POST",

          endpoint: "/api/chat",

          request: {
            question: question,
            session_id: "demo-session",
          },
        },

        /* SQL INFORMATION */

        sql: `SELECT
    region,
    SUM(sales) AS total_sales
FROM sales
WHERE region IN (
    'Germany',
    'France',
    'Spain',
    'Italy'
)
GROUP BY region
ORDER BY total_sales DESC;`,
      };

      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);

      setIsLoading(false);
    }, 1000);
  };

  /* =========================================================
     SUGGESTION
  ========================================================= */

  const handleSuggestionClick = (
    text: string
  ) => {
    handleSend(text);
  };

  /* =======================================================
     NEW CHAT
  ======================================================= */

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setShowApiCall(null);
    setShowSql(null);
    setSidebarOpen(false);
  };

  /* =======================================================
     KEYBOARD
  ======================================================= */

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSend();
    }
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-[#FCFBFB] text-[#192A56]">
      <div className="flex min-h-screen">

        {/* =================================================
            MOBILE OVERLAY
        ================================================= */}

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() =>
              setSidebarOpen(false)
            }
          />
        )}

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside
          className={`
            fixed left-0 top-0 z-50
            flex h-screen w-[270px]
            flex-col
            bg-[#192A56]
            text-white
            transition-transform duration-300
            lg:static lg:translate-x-0
            ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full"
            }
          `}
        >

          {/* Logo */}

          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7D794]">
                <BarChart3
                  size={21}
                  className="text-[#192A56]"
                />
              </div>

              <div>

                <h1 className="text-lg font-bold tracking-tight">
                  MetricMind
                </h1>

                <p className="text-[10px] text-white/50">
                  Semantic BI Engine
                </p>
              </div>

            </div>

            <button
              onClick={() =>
                setSidebarOpen(false)
              }
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* New Chat */}

          <div className="px-4 pt-5">

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

              <Plus size={18} />

              New Chat

            </button>
          </div>

          {/* Recent Conversations */}

          <div className="px-4">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Recent Conversations
            </p>

            <div className="space-y-1">

              <button
                onClick={() =>
                  handleSuggestionClick(
                    "Show me European sales"
                  )
                }
                className="
                  flex w-full items-center
                  gap-3 rounded-xl
                  px-3 py-3
                  text-left
                  text-sm text-white/75
                  transition
                  hover:bg-white/10
                "
              >

                <MessageSquare size={16} />

                <span className="truncate">
                  European Sales Analysis
                </span>
              </button>

              <button
                onClick={() =>
                  handleSuggestionClick(
                    "How did Q3 revenue perform?"
                  )
                }
                className="
                  flex w-full items-center
                  gap-3 rounded-xl
                  px-3 py-3
                  text-left
                  text-sm text-white/75
                  transition
                  hover:bg-white/10
                "
              >

                <MessageSquare size={16} />

                <span className="truncate">
                  Q3 Revenue Performance
                </span>
              </button>

              <button
                onClick={() =>
                  handleSuggestionClick(
                    "Show me regional performance"
                  )
                }
                className="
                  flex w-full items-center
                  gap-3 rounded-xl
                  px-3 py-3
                  text-left
                  text-sm text-white/75
                  transition
                  hover:bg-white/10
                "
              >

                <MessageSquare size={16} />

                <span className="truncate">
                  Regional Comparison
                </span>
              </button>

            </div>
          </div>

          {/* Sidebar Bottom */}

          <div className="border-t border-white/10 p-4">

            <div className="rounded-xl bg-white/5 p-4">

              <div className="flex items-center gap-2">

                <span className="h-2 w-2 rounded-full bg-green-400" />

                <span className="text-xs text-white/70">
                  System Online
                </span>

              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                Connected to MetricMind analytics engine
              </p>

            </div>

          </div>

        </aside>

        {/* =================================================
            MAIN
        ================================================= */}

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* ===================================================
              HEADER
          =================================================== */}

          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#192A56]/10 bg-[#FCFBFB]/95 px-4 backdrop-blur sm:px-6 lg:px-8">

            <div className="flex items-center gap-3">

              <button
                onClick={() =>
                  setSidebarOpen(true)
                }
                className="rounded-xl p-2 hover:bg-[#192A56]/5 lg:hidden"
              >

                <Menu size={22} />

              </button>

              <div>

                <p className="text-xs text-gray-500">
                  Analytics Workspace
                </p>

                <h2 className="text-sm font-semibold text-[#192A56]">
                  Good evening
                </h2>
              </div>

            </div>

            <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />

              <span className="text-[10px] font-medium text-green-700 sm:text-xs">
                Connected
              </span>
            </div>

          </header>

          {/* ===================================================
              CONTENT
          =================================================== */}

          <div className="flex flex-1 flex-col">

            {messages.length === 0 ? (

              /* =================================================
                 WELCOME
              ================================================= */

              <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
                <div className="w-full max-w-3xl text-center">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#192A56]">
                    <Sparkles size={28} className="text-[#F7D794]" />
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight text-[#192A56] sm:text-4xl">
                    Ask your data anything.
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
                    Ask questions about sales, revenue, profit, regions, products, and business
                    performance using natural language.
                  </p>

                  {/* Suggestions */}
                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {suggestions.map((suggestion) => {
                      const Icon = suggestion.icon;

                      return (
                        <button
                          key={suggestion.title}
                          onClick={() => handleSuggestionClick(suggestion.description)}
                          className="group rounded-2xl border border-[#192A56]/10 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#192A56]/20 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7D794]/40">
                              <Icon size={19} className="text-[#192A56]" />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <h3 className="text-sm font-semibold text-[#192A56]">{suggestion.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-gray-500">{suggestion.description}</p>
                              </div>
                              <ChevronRight size={16} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#192A56]" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-8 text-center text-[10px] text-gray-400 sm:text-xs">
                    Powered by MetricMind Semantic BI Engine
                  </p>
                </div>
              </div>

            ) : (

              /* =================================================
                 CHAT
              ================================================= */

              <div className="flex flex-1 flex-col">

                <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 lg:px-8">

                  <div className="space-y-6">

                    {messages.map((message) => (
                      <div key={message.id} className={`flex gap-3 sm:gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192A56]">
                            <Bot size={18} className="text-[#F7D794]" />
                          </div>
                        )}

                        <div className={`min-w-0 ${message.role === "user" ? "max-w-[85%] sm:max-w-[75%]" : "w-full max-w-[90%] sm:max-w-[85%]"}`}>
                          <div className={`mb-1 text-xs font-semibold opacity-60 ${message.role === "user" ? "text-right" : "text-left"}`}>
                            {message.role === "user" ? "You" : "MetricMind"}
                          </div>
                          <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#192A56] text-white" : "rounded-bl-md border border-[#192A56]/10 bg-white text-gray-700 shadow-sm"}`}>
                            <p>{message.content}</p>
                          </div>

                          {message.role === "assistant" && message.chart && (
                            <div className="mt-5">
                              <DynamicChart type={message.chart.type} title={message.chart.title} subtitle={message.chart.subtitle} data={message.chart.data} />
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button onClick={() => setShowApiCall(showApiCall === message.id ? null : message.id)} className="rounded-lg border border-[#192A56]/15 bg-white px-3 py-2 text-xs font-medium text-[#192A56] transition hover:border-[#192A56]/30 hover:bg-[#192A56]/5">
                                  {showApiCall === message.id ? "Hide API Call" : "View API Call"}
                                </button>
                                <button onClick={() => setShowSql(showSql === message.id ? null : message.id)} className="rounded-lg border border-[#192A56]/15 bg-white px-3 py-2 text-xs font-medium text-[#192A56] transition hover:border-[#192A56]/30 hover:bg-[#192A56]/5">
                                  {showSql === message.id ? "Hide SQL" : "View SQL"}
                                </button>
                              </div>

                              {showApiCall === message.id && message.api && (
                                <div className="mt-3 rounded-xl border border-[#192A56]/10 bg-[#192A56] p-4">
                                  <div className="mb-3 flex items-center justify-between">
                                    <h4 className="text-xs font-semibold text-[#F7D794]">API CALL</h4>
                                    <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/60">{message.api.method}</span>
                                  </div>
                                  <p className="mb-3 text-xs text-white/60">{message.api.endpoint}</p>
                                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-white/80">{JSON.stringify(message.api.request, null, 2)}</pre>
                                </div>
                              )}

                              {showSql === message.id && message.sql && (
                                <div className="mt-3 rounded-xl border border-[#192A56]/10 bg-[#192A56] p-4">
                                  <h4 className="mb-3 text-xs font-semibold text-[#F7D794]">SQL QUERY</h4>
                                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-white/80">{message.sql}</pre>
                                </div>
                              )}
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

                  {/* =================================================
                      LOADING
                  ================================================= */}

                    {isLoading && (
                      <div className="flex gap-3 sm:gap-4">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#192A56]">

                        <Bot
                          size={18}
                          className="text-[#F7D794]"
                        />

                      </div>

                        <div>

                          <div className="mb-1 text-xs font-semibold opacity-60">
                            MetricMind
                          </div>

                          <div className="rounded-2xl rounded-bl-md border border-[#192A56]/10 bg-white px-5 py-4 shadow-sm">

                            <div className="flex gap-1">

                              <span className="h-2 w-2 animate-bounce rounded-full bg-[#192A56]" />

                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-[#192A56]"
                              style={{
                                animationDelay:
                                  "150ms",
                              }}
                            />

                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-[#192A56]"
                              style={{
                                animationDelay:
                                  "300ms",
                              }}
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

            {/* =================================================
                INPUT
            ================================================= */}

            <div className="sticky bottom-0 border-t border-[#192A56]/10 bg-[#FCFBFB]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">

              <div className="mx-auto w-full max-w-4xl">

                <div className="relative rounded-2xl border border-[#192A56]/15 bg-white shadow-sm transition focus-within:border-[#192A56]/30 focus-within:shadow-md">

                  <textarea
                    value={input}
                    onChange={(event) =>
                      setInput(event.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about your business data..."
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
                    onClick={() =>
                      handleSend()
                    }
                    disabled={
                      !input.trim() || isLoading
                    }
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
