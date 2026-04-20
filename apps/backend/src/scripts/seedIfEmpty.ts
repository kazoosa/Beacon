import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * On boot, ensure the demo developer + seeded mock portfolio exists.
 *
 * The seed script (src/prisma/seed.ts) is idempotent:
 *   - Institutions & securities are upserted (safe to re-run)
 *   - Demo developer is only created if demo@finlink.dev doesn't exist
 *   - Demo items are only created if the demo app has zero items
 *
 * So running it every boot leaves real user accounts untouched while
 * guaranteeing the demo account always has data to showcase.
 */
async function main() {
  const demoEmail = "demo@finlink.dev";
  const demo = await prisma.developer.findUnique({ where: { email: demoEmail } });

  if (!demo) {
    console.log("[seedIfEmpty] demo account missing — running seed");
  } else {
    // Count demo items; if zero, re-run so the demo has its portfolio back
    const apps = await prisma.application.findMany({
      where: { developerId: demo.id },
      select: { id: true },
    });
    const itemCount = apps.length
      ? await prisma.item.count({ where: { applicationId: { in: apps.map((a) => a.id) } } })
      : 0;
    if (itemCount > 0) {
      console.log(`[seedIfEmpty] demo account has ${itemCount} items — skipping seed`);
      await prisma.$disconnect();
      return;
    }
    console.log("[seedIfEmpty] demo account exists but has no items — re-seeding");
  }

  await prisma.$disconnect();
  await import("../prisma/seed.js");
}

main().catch((e) => {
  console.error("[seedIfEmpty] failed:", e);
  process.exit(0); // don't block server startup — app still boots, just without demo
});
