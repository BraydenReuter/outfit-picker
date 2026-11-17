import { prisma } from '../src/lib/prisma';
import { resetDemoWardrobe } from '../src/services/demo';

// Replaces everything in the configured database with the sample wardrobe.
resetDemoWardrobe()
  .then(() => console.log('Sample wardrobe loaded.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
