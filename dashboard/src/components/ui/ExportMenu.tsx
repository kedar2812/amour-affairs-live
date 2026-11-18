"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadExcel, downloadPDF, DatasetSheet } from "@/lib/exportUtils";

interface ExportMenuProps {
  /** The datasets to export. Each becomes a sheet/section. */
  datasets: DatasetSheet[];
  /** Filename without extension */
  filename?: string;
  /** Title shown on the PDF header */
  pdfTitle?: string;
  /** Button variant — "header" for the global bar, "inline" for page-level */
  variant?: "header" | "inline";
}

export function ExportMenu({
  datasets,
  filename = "amour-affairs-export",
  pdfTitle = "Dashboard Export",
  variant = "inline",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<"excel" | "pdf" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleExcel = async () => {
    setDownloading("excel");
    // Small delay for UX feedback
    await new Promise((r) => setTimeout(r, 300));
    downloadExcel(datasets, filename);
    setDownloading(null);
    setOpen(false);
  };

  const handlePDF = async () => {
    setDownloading("pdf");
    await new Promise((r) => setTimeout(r, 300));
    downloadPDF(datasets, filename, pdfTitle);
    setDownloading(null);
    setOpen(false);
  };

  const totalRecords = datasets.reduce((sum, ds) => sum + ds.rows.length, 0);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setOpen((prev) => !prev)}
        className={
          variant === "header"
            ? "h-10 px-4 flex items-center gap-2 rounded-xl text-[14px] font-medium border-border/50 bg-card/10 text-foreground hover:bg-card/20 backdrop-blur-md transition-colors"
            : "h-10 px-4 rounded-xl border-border/50 bg-card/10 backdrop-blur-md"
        }
      >
        <Download className="h-4 w-4 mr-1" />
        Export
      </Button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 z-50 w-[280px] rounded-xl border border-border bg-card/95 dark:bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Export Data</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {datasets.length} {datasets.length === 1 ? "section" : "sections"} · {totalRecords} records
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-2">
              {/* Excel Option */}
              <button
                onClick={handleExcel}
                disabled={downloading !== null}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group text-left disabled:opacity-60"
              >
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  {downloading === "excel" ? (
                    <div className="h-4 w-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Excel Spreadsheet</p>
                  <p className="text-[11px] text-muted-foreground">.xlsx — Multi-tab workbook</p>
                </div>
              </button>

              {/* PDF Option */}
              <button
                onClick={handlePDF}
                disabled={downloading !== null}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group text-left disabled:opacity-60"
              >
                <div className="h-10 w-10 rounded-lg bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                  {downloading === "pdf" ? (
                    <div className="h-4 w-4 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">PDF Report</p>
                  <p className="text-[11px] text-muted-foreground">.pdf — Branded, print-ready</p>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground text-center">
                {datasets.map((d) => d.sheetName).join(" · ")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
