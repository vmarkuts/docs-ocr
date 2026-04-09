"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileType, Loader2 } from "lucide-react";

interface UploaderProps {
  onUpload: (file: File) => void;
  loading: boolean;
}

export default function Uploader({ onUpload, loading }: UploaderProps) {
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
    <div
      {...getRootProps()}
      className={`
        relative overflow-hidden group p-8 rounded-xl border-2 border-dashed 
        flex flex-col items-center justify-center gap-4 text-center cursor-pointer
        transition-all duration-300 ease-in-out min-h-[300px]
        ${isDragActive ? "border-blue-500 bg-blue-500/5" : "border-border bg-card hover:border-gray-500 hover:bg-muted/50"}
        ${loading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}
      `}
    >
      <input {...getInputProps()} />
      
      {loading ? (
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      ) : (
        <UploadCloud 
          className={`w-12 h-12 transition-colors duration-300 ${isDragActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-300"}`} 
        />
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {isDragActive ? "Drop the quote here" : "Drag & drop a quote, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground">
          Supports PDF, JPG, CSV (up to 10MB)
        </p>
      </div>

      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}
