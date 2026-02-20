import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateAccountId(index: number): string {
  return `CH${String(index).padStart(3, "0")}`;
}

export function calculatePercentage(value: number, total: number): string {
  if (total === 0) return "0.0";
  return ((value / total) * 100).toFixed(1);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a duration stored in seconds to a human-readable string.
 * - < 60s  → "42s"
 * - >= 60s → "3.2 min"
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

/**
 * Export an array of objects as a CSV file download.
 */
export function exportToCsv(filename: string, rows: Record<string, any>[], columns?: { key: string; header: string }[]) {
  if (rows.length === 0) return;
  const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, header: k }));
  const header = cols.map((c) => `"${c.header}"`).join(",");
  const body = rows
    .map((row) =>
      cols
        .map((c) => {
          const val = row[c.key];
          if (val == null) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
