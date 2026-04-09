"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, CheckCircle2, XCircle, Bot, X } from "lucide-react";
import { TimelineEvent } from "@/app/page";

interface UploaderProps {
  onUpload: (file: File) => void;
  loading: boolean;
  timeline: TimelineEvent[];
  onAbort?: () => void;
}

export default function Uploader({ onUpload, loading, timeline, onAbort }: UploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "text/csv": [".csv"],
    },
    disabled: loading,
    multiple: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden group p-8 rounded-xl border-2 border-dashed 
          flex flex-col items-center justify-center gap-4 text-center cursor-pointer
          transition-all duration-300 ease-in-out bg-card
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-border hover:border-gray-400 hover:bg-slate-50"}
          ${loading ? "cursor-not-allowed opacity-70" : ""}
          ${timeline.length === 0 ? "min-h-[300px]" : "min-h-[160px] pb-6"}
        `}
      >
        <input {...getInputProps()} />
        
        {loading ? (
          <div className="flex flex-col items-center gap-3 z-10 w-full">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-blue-600">Processing file...</p>
            {onAbort && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAbort(); }}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-md text-xs font-semibold transition-colors shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
                Abort Request
              </button>
            )}
          </div>
        ) : (
          <>
            <UploadCloud 
              className={`w-12 h-12 transition-colors duration-300 z-10 ${isDragActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"}`} 
            />
            <div className="space-y-1 z-10">
              <p className="text-sm font-medium text-foreground">
                {isDragActive ? "Drop the quote here" : "Drag & drop a quote, or click to select"}
              </p>
              <p className="text-xs text-muted-foreground">
                Supports PDF, JPG, CSV (up to 10MB)
              </p>
            </div>
          </>
        )}

        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {timeline.length > 0 && (
        <div className="flex flex-col w-full text-left bg-white rounded-xl p-5 shadow-sm border border-slate-200 text-xs font-mono">
          <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 flex items-center gap-2 pb-3 mb-3">
            <Bot className="w-4 h-4 text-indigo-500" />
            AI Processing Log
          </h3>
          <div className="flex flex-col space-y-2.5 max-h-64 overflow-y-auto pr-2">
            {timeline.map((evt, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {evt.type === "log" && <span className="text-slate-400 shrink-0 mt-0.5">ℹ️</span>}
                {evt.type === "status" && evt.status === "trying" && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0 mt-0.5" />}
                {evt.type === "status" && evt.status === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                {evt.type === "status" && evt.status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />}
                
                <span className={`flex-1 ${evt.status === "failed" ? "text-red-500 opacity-80" : evt.status === "success" ? "text-green-600 font-semibold" : "text-slate-600"}`}>
                  {evt.type === "log" ? evt.message : `${evt.model?.split("/")[1] || evt.model}${evt.reason ? ` ➔ ${evt.reason}` : ""}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
