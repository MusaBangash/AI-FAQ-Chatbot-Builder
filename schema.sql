-- schema.sql
-- Run this once to set up your Postgres + pgvector database

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Chatbots table
CREATE TABLE IF NOT EXISTS chatbots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  website_url VARCHAR NOT NULL,
  system_prompt TEXT DEFAULT 'You are a helpful assistant. Answer questions based only on the provided context.',
  color VARCHAR DEFAULT '#6EE7B7',
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'training', 'active', 'failed')),
  training_progress INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge chunks with vector embeddings
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),        -- OpenAI text-embedding-3-small = 1536 dims
  source_url VARCHAR,
  source_title VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  visitor_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE,
  plan VARCHAR DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'pro')),
  stripe_subscription_id VARCHAR,
  chatbot_limit INT DEFAULT 1,
  message_limit INT DEFAULT 500,
  messages_used INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES for fast vector search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS knowledge_chunks_chatbot_id_idx
  ON knowledge_chunks (chatbot_id);

CREATE INDEX IF NOT EXISTS chatbots_user_id_idx
  ON chatbots (user_id);
