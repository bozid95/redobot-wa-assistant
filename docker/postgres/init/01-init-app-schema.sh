#!/bin/bash
set -euo pipefail

if [[ -z "${APP_DB_NAME:-}" ]]; then
  echo "APP_DB_NAME is not set, skipping app schema init"
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB_NAME" <<'SQL'
DO $$ BEGIN
  CREATE TYPE "ConversationStatus" AS ENUM ('open', 'takeover', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'admin', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageSource" AS ENUM (
    'evolution',
    'rag',
    'fallback',
    'manual_reply',
    'router_greeting',
    'router_clarify',
    'router_thanks',
    'takeover'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadReason" AS ENUM ('no_match', 'low_confidence', 'llm_error', 'system_error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('open', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KnowledgeStatus" AS ENUM ('pending', 'indexed', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WaInstanceStatus" AS ENUM ('not_created', 'connecting', 'connected', 'disconnected', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_instances (
  id SERIAL PRIMARY KEY,
  instance_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  status "WaInstanceStatus" NOT NULL DEFAULT 'not_created',
  qr_code_base64 TEXT,
  last_error TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  status "ConversationStatus" NOT NULL DEFAULT 'open',
  takeover_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  role "MessageRole" NOT NULL,
  source "MessageSource" NOT NULL DEFAULT 'evolution',
  message TEXT NOT NULL,
  message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'file',
  source_path TEXT NOT NULL UNIQUE,
  status "KnowledgeStatus" NOT NULL DEFAULT 'pending',
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unanswered_leads (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  question TEXT NOT NULL,
  reason "LeadReason" NOT NULL,
  status "LeadStatus" NOT NULL DEFAULT 'open',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_messages (
  message_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL
