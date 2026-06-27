import { prisma } from "../src/lib/prisma";
import { ensureWorkspace } from "../src/lib/workspace";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@razby.local" },
    update: {},
    create: {
      email: "demo@razby.local",
      name: "Razby Demo",
    },
  });

  const workspace = await ensureWorkspace(user.id);
  console.log(`Seeded ${workspace.name} for ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
