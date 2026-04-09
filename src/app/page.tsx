"use client";

import { useState } from "react";
import Uploader from "@/components/Uploader";
import Dashboard from "@/components/Dashboard";

export type ParsedItem = {
  item: string;
  qty: number;
  unit_price: number;
  vendor: string;
};

export default function Home() {
  const [data, setData] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      setData((prev) => [...prev, ...result]);
    } catch (err: any) {
      setError(err.message || "Something went wrong parsing the file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-2 border-b border-border pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Smart Vendor Hub
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-driven Procurement MVP. Drop your supplier quotes (PDF, JPG, CSV) below.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <Uploader onUpload={handleUpload} loading={loading} />
            {error && (
              <div className="p-4 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm">
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
