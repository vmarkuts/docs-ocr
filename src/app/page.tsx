"use client";

import { useState, useRef } from "react";
import Uploader from "@/components/Uploader";
import Dashboard from "@/components/Dashboard";

export type ParsedItem = {
  item: string;
  qty: number;
  unit_price: number;
  vendor: string;
};

export type TimelineEvent = {
  type: "log" | "status" | "error" | "result";
  model?: string;
  status?: "trying" | "failed" | "success";
  reason?: string;
  message?: string;
};

export type ProviderConfig = {
  provider: "builtin" | "openrouter" | "openai" | "anthropic";
  apiKey: string;
  model: string;
};

const DEFAULT_MODELS: Record<ProviderConfig["provider"], string> = {
  builtin: "",
  openrouter: "openrouter/auto",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5"
};

export default function Home() {
  const [data, setData] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "builtin",
    apiKey: "",
    model: ""
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setTimeline(prev => [...prev, { type: "log", message: "❌ Request aborted by user." }]);
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    setTimeline([]);

    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("providerConfig", JSON.stringify(providerConfig));

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          let parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          
          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const dataStr = part.substring(6);
              try {
                const event = JSON.parse(dataStr);
                if (event.type === "error") {
                  throw new Error(event.message);
                } else if (event.type === "result") {
                  setData((prev) => [...prev, ...event.payload]);
                  setTimeout(() => setLoading(false), 500);
                  return;
                } else {
                  setTimeline((prev) => {
                     if (event.type === "status") {
                       const existingIdx = prev.findIndex(e => e.model === event.model && e.type === "status");
                       if (existingIdx !== -1) {
                         const next = [...prev];
                         next[existingIdx] = event;
                         return next;
                       }
                     }
                     return [...prev, event];
                  });
                }
              } catch (parseError) {
                // Ignore parse errors from chunk anomalies
              }
            }
          }
        }
      }
      setLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Upload aborted");
        return; 
      }
      setError(err.message || "Something went wrong reading server stream.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-8 font-sans transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-2 border-b border-border pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Smart Vendor Hub
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-driven Procurement MVP. Drop your supplier quotes (PDF, JPG, CSV) below.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">AI Provider</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={providerConfig.provider}
                  onChange={(e) => {
                    const p = e.target.value as ProviderConfig["provider"];
                    setProviderConfig(prev => ({ ...prev, provider: p, model: DEFAULT_MODELS[p] }));
                  }}
                  disabled={loading}
                >
                  <option value="builtin">Built-in (Free OpenRouter Models)</option>
                  <option value="openrouter">Custom OpenRouter Key</option>
                  <option value="openai">Custom OpenAI Key</option>
                  <option value="anthropic">Custom Anthropic Key</option>
                </select>
              </div>
              
              {providerConfig.provider !== "builtin" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">API Key</label>
                    <input
                      type="password"
                      disabled={loading}
                      placeholder="sk-..."
                      value={providerConfig.apiKey}
                      onChange={(e) => setProviderConfig(p => ({ ...p, apiKey: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Model</label>
                    <input
                      type="text"
                      disabled={loading}
                      placeholder={DEFAULT_MODELS[providerConfig.provider]}
                      value={providerConfig.model}
                      onChange={(e) => setProviderConfig(p => ({ ...p, model: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <Uploader onUpload={handleUpload} loading={loading} timeline={timeline} onAbort={handleAbort} />
            {error && (
              <div className="p-4 rounded-lg bg-red-100 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>
          
          <div className="lg:col-span-2">
            <Dashboard data={data} />
          </div>
        </div>
      </div>
    </main>
  );
}
