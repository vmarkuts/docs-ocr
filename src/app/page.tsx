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

export default function Home() {
  const [data, setData] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    setTimeline([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
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
                  setTimeout(() => setLoading(false), 500); // little delay to see success
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
            <Uploader onUpload={handleUpload} loading={loading} timeline={timeline} />
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
