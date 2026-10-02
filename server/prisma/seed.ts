import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seed } from '../src/dev/seed';

const prisma = new PrismaClient();

seed(prisma)
  .then(() => console.log('Seed complete.'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
