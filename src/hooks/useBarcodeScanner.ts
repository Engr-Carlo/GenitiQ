"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * USB Barcode Scanner Hook
 * Detects rapid keyboard input typical of USB barcode scanners.
 * Scanners emulate keyboard and type ~50+ chars/sec followed by Enter.
 */

interface UseBarcodeScannerOptions {
  /** Minimum characters for a valid scan (default: 3) */
  minLength?: number;
  /** Max milliseconds between keystrokes to count as scanner (default: 50) */
  maxKeystrokeDelay?: number;
  /** Callback when a barcode is scanned */
  onScan?: (barcode: string) => void;
  /** Whether scanning is enabled (default: true) */
  enabled?: boolean;
}

interface UseBarcodeScanner {
  /** The last scanned barcode */
  scannedCode: string | null;
  /** Whether a scan is in progress */
  isScanning: boolean;
  /** Reset the scanner state */
  reset: () => void;
  /** Manually set a barcode (for testing or manual entry) */
  manualEntry: (code: string) => void;
}

export function useBarcodeScanner({
  minLength = 3,
  maxKeystrokeDelay = 50,
  onScan,
  enabled = true,
}: UseBarcodeScannerOptions = {}): UseBarcodeScanner {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const bufferRef = useRef<string>("");
  const lastKeystrokeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    setScannedCode(null);
    setIsScanning(false);
    bufferRef.current = "";
    lastKeystrokeRef.current = 0;
  }, []);

  const manualEntry = useCallback(
    (code: string) => {
      setScannedCode(code);
      onScan?.(code);
    },
    [onScan]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is on an input/textarea (except our scanner input)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        (target.tagName === "INPUT" &&
          !target.classList.contains("barcode-scanner-input"))
      ) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeystrokeRef.current;

      // Enter key = end of scan
      if (e.key === "Enter") {
        e.preventDefault();
        if (bufferRef.current.length >= minLength) {
          const code = bufferRef.current.trim();
          setScannedCode(code);
          setIsScanning(false);
          onScan?.(code);
        }
        bufferRef.current = "";
        lastKeystrokeRef.current = 0;
        return;
      }

      // Only accept printable characters
      if (e.key.length !== 1) return;

      // If too much time passed, start new buffer
      if (timeSinceLastKey > maxKeystrokeDelay && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      bufferRef.current += e.key;
      lastKeystrokeRef.current = now;

      if (bufferRef.current.length >= 2) {
        setIsScanning(true);
      }

      // Auto-clear buffer after inactivity
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          const code = bufferRef.current.trim();
          setScannedCode(code);
          setIsScanning(false);
          onScan?.(code);
        }
        bufferRef.current = "";
        setIsScanning(false);
      }, 200);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, minLength, maxKeystrokeDelay, onScan]);

  return { scannedCode, isScanning, reset, manualEntry };
}
