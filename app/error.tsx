"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
      <div className="max-w-md w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
        <p className="text-lg font-medium text-[var(--text)] mb-1">
          出了点问题
        </p>
        <p className="text-sm text-[var(--text-muted)] mb-4 break-words">
          {error.message || "未知错误"}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition"
        >
          重试
        </button>
      </div>
    </div>
  );
}
