import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Remove duplicate BANK POLICY connector (covered by the real Salesforce AI Jira connector)
  const r = await db.sourceConnector.deleteMany({ where: { name: "BANK POLICY" } });
  console.log(`Deleted ${r.count} BANK POLICY connector(s)`);

  // Show final state
  const all = await db.sourceConnector.findMany({
    select: { id: true, type: true, name: true, baseUrl: true, enabled: true },
  });
  console.log("\nFinal connectors:");
  for (const c of all) {
    console.log(`  [${c.type.toUpperCase()}] ${c.name} — ${c.baseUrl} (enabled: ${c.enabled})`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
