import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'change-me-dashboard-password';
  const name = process.env.ADMIN_NAME || 'Admin';

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (!existing) {
    await prisma.appUser.create({
      data: {
        email,
        passwordHash: hashSync(password, 10),
        name,
      },
    });
  }

  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'wa-rag-bot';
  await prisma.waInstance.upsert({
    where: { instanceName },
    update: {},
    create: {
      instanceName,
      status: 'not_created',
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
