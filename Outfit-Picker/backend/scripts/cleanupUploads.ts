import { cleanupUnusedImages } from '../src/services/imageStorage';
import { prisma } from '../src/lib/prisma';

cleanupUnusedImages()
  .then((count) => console.log(`Cleaned up ${count} unused photos.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
