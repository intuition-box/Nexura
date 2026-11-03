"use client";

/**
 * Centered loading state for Studio pages: a spinning purple ring with a message under it.
 * `compact` fits inside a card or table; the default fills the page area.
 */
export default function StudioLoader({ message, error, compact = false }: { message: string; error?: string; compact?: boolean }) {
  return (
    <div className={`flex w-full flex-col items-center justify-center gap-4 px-4 text-center ${compact ? "py-10" : "flex-1 min-h-[60vh]"}`} role="status" aria-live="polite">
      {error ? (
        <p className="text-sm font-medium text-[#e4545b]">{error}</p>
      ) : (
        <>
          <div className="h-12 w-12 rounded-full border-4 border-[rgba(138,63,252,0.15)] border-t-[#8B3EFE] animate-spin" />
          <p className="text-sm font-medium text-[#69728a]">{message}</p>
        </>
      )}
    </div>
  );
}
