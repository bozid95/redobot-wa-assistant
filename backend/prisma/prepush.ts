import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    DROP CONSTRAINT IF EXISTS conversations_phone_key;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS knowledge_sources
    DROP CONSTRAINT IF EXISTS knowledge_sources_source_path_key;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS processed_messages
    DROP CONSTRAINT IF EXISTS processed_messages_pkey;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS processed_messages
    ADD COLUMN IF NOT EXISTS id SERIAL;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS app_users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS app_users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS app_users
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS app_users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    ADD COLUMN IF NOT EXISTS lead_stage TEXT NOT NULL DEFAULT 'new';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    ADD COLUMN IF NOT EXISTS handoff_suggested BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    ADD COLUMN IF NOT EXISTS payment_requested BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversations
    ADD COLUMN IF NOT EXISTS payment_proof_received BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS conversation_messages
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS knowledge_sources
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS knowledge_sources
    ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS unanswered_leads
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS processed_messages
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS wa_instances
    ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
  `);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
