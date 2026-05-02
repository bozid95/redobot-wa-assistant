import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

function slugifyTenantName(name: string) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tenant';
}

function getDefaultTenantName() {
  return String(process.env.DEFAULT_TENANT_NAME || 'Default Workspace').trim();
}

function getDefaultTenantSlug() {
  return slugifyTenantName(process.env.DEFAULT_TENANT_SLUG || getDefaultTenantName() || 'default');
}

function buildTenantInstanceName(slug: string) {
  const normalized = slugifyTenantName(slug);
  return String(process.env.EVOLUTION_INSTANCE_PREFIX || `wa-${normalized}`).slice(0, 50);
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'change-me-dashboard-password';
  const name = process.env.ADMIN_NAME || 'Admin';
  const dummyUserEmail = process.env.DUMMY_USER_EMAIL || 'user@redobot.app';
  const dummyUserPassword = process.env.DUMMY_USER_PASSWORD || 'User12345!';
  const dummyUserName = process.env.DUMMY_USER_NAME || 'redobot User';
  const tenantSlug = getDefaultTenantSlug();
  const tenantName = getDefaultTenantName();
  const instanceName = String(
    process.env.EVOLUTION_INSTANCE_NAME || buildTenantInstanceName(tenantSlug),
  ).trim();

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: {
      slug: tenantSlug,
      name: tenantName,
    },
  });

  await prisma.appUser.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  await prisma.conversation.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  await prisma.conversationMessage.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  await prisma.knowledgeSource.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  await prisma.unansweredLead.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  await prisma.processedMessage.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (!existing) {
    await prisma.appUser.create({
      data: {
        email,
        passwordHash: hashSync(password, 10),
        name,
        role: 'platform_admin',
        tenantId: tenant.id,
        isActive: true,
      },
    });
  } else {
    await prisma.appUser.update({
      where: { id: existing.id },
      data: {
        name,
        role: 'platform_admin',
        tenantId: existing.tenantId ?? tenant.id,
        isActive: true,
      },
    });
  }

  const existingDummyUser = await prisma.appUser.findUnique({
    where: { email: dummyUserEmail },
  });

  if (!existingDummyUser) {
    await prisma.appUser.create({
      data: {
        email: dummyUserEmail,
        passwordHash: hashSync(dummyUserPassword, 10),
        name: dummyUserName,
        role: 'tenant_admin',
        tenantId: tenant.id,
        isActive: true,
      },
    });
  } else {
    await prisma.appUser.update({
      where: { id: existingDummyUser.id },
      data: {
        name: dummyUserName,
        role: 'tenant_admin',
        tenantId: existingDummyUser.tenantId ?? tenant.id,
        isActive: true,
      },
    });
  }

  const tenantInstance = await prisma.waInstance.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!tenantInstance) {
    await prisma.waInstance.upsert({
      where: { instanceName },
      update: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        instanceName,
        status: 'not_created',
      },
    });
  } else if (tenantInstance.instanceName !== instanceName) {
    await prisma.waInstance.update({
      where: { id: tenantInstance.id },
      data: { instanceName },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
