import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// A new closet starts empty. Setup should never erase clothes that are already saved.
prisma.clothingItem
  .count()
  .then((count) => console.log(`Closet ready. ${count} saved pieces kept.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
