import prisma from "@/lib/db";
import PolicyUploadClient from "./PolicyUploadClient";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const docs = await prisma.policyDocument.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      uploadedBy: true,
      uploadedAt: true,
      indexedAt: true,
      _count: { select: { chunks: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });

  const serialised = docs.map((d) => ({
    ...d,
    uploadedAt: d.uploadedAt.toISOString(),
    indexedAt: d.indexedAt?.toISOString() ?? null,
  }));

  return <PolicyUploadClient documents={serialised} />;
}
