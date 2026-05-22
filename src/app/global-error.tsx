"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html className="dark">
      <body className="bg-[#0c141d] text-[#c9d1dc] min-h-screen flex items-center justify-center font-mono p-8">
        <div className="border border-[#D64545] p-8 max-w-lg w-full">
          <p className="text-[#D64545] text-[10px] tracking-widest mb-4">SYSTEM_FAULT · NEXORI_OS</p>
          <h1 className="text-[#c9d1dc] text-lg font-bold mb-2">Server Exception</h1>
          <p className="text-[#6b7b8d] text-sm mb-6">
            {error.message || "An unexpected error occurred. Check Vercel function logs for details."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-[#6b7b8d] mb-4">DIGEST: {error.digest}</p>
          )}
          <div className="text-[10px] text-[#6b7b8d] space-y-1 mb-6 border border-[#2B3648] p-4">
            <p>LIKELY CAUSES:</p>
            <p>· DATABASE_URL not set in Vercel environment variables</p>
            <p>· DIRECT_URL not set in Vercel environment variables</p>
            <p>· Database unreachable from Vercel region (lhr1)</p>
            <p className="mt-2">CHECK: /api/health for DB connection status</p>
          </div>
          <button
            onClick={reset}
            className="border border-[#50dbcb] text-[#50dbcb] px-4 py-2 text-[11px] hover:bg-[#50dbcb]/10 transition-colors"
          >
            RETRY
          </button>
        </div>
      </body>
    </html>
  );
}
