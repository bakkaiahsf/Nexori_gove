"use client";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-xl">
      <div className="border border-critical p-xl max-w-lg w-full">
        <p className="text-critical font-mono-technical text-[10px] tracking-widest mb-md">
          RUNTIME_FAULT
        </p>
        <p className="font-body-bold text-body-bold text-on-surface mb-sm">
          {error.message || "A server-side error occurred."}
        </p>
        {error.digest && (
          <p className="font-mono-technical text-[10px] text-on-surface-variant mb-md">
            DIGEST: {error.digest}
          </p>
        )}
        <div className="font-mono-technical text-[10px] text-on-surface-variant border border-border-muted p-md mb-lg space-y-xs">
          <p>DIAGNOSTIC: Open /api/health to check DB connectivity</p>
          <p>VERIFY: DATABASE_URL and DIRECT_URL set in Vercel env vars</p>
        </div>
        <button
          onClick={reset}
          className="border border-primary text-primary font-label-caps text-label-caps px-4 py-xs hover:bg-primary/10 transition-colors"
        >
          RETRY
        </button>
      </div>
    </div>
  );
}
