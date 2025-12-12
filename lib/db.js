const { Pool } = require("pg");

let pool;

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

async function ensureCommunityTables() {
  const client = await getPool().connect();
  try {
    // Posts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author_id VARCHAR(255),
        author_name VARCHAR(255),
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author_id VARCHAR(255),
        author_name VARCHAR(255),
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Likes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('post', 'comment')),
        target_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, target_type, target_id)
      )
    `);

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);
    `);

  } finally {
    client.release();
  }
}

async function ensureAuthTables() {
  const client = await getPool().connect();
  try {
    // User table - core Better Auth table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        "emailVerified" BOOLEAN DEFAULT FALSE,
        name VARCHAR(255),
        image TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Session table - manages user sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        id VARCHAR(255) PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        "ipAddress" INET,
        "userAgent" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Account table - handles OAuth provider accounts
    await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        id VARCHAR(255) PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "providerId" VARCHAR(255) NOT NULL,
        "accountId" VARCHAR(255) NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMPTZ,
        "refreshTokenExpiresAt" TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE("providerId", "accountId")
      )
    `);

    // Verification table - handles email verification tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification (
        id VARCHAR(255) PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_user_id ON session("userId");
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_account_user_id ON account("userId");
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
    `);

  } finally {
    client.release();
  }
}

async function ensureUserBehaviorTable() {
  const client = await getPool().connect();
  try {
    // User behavior tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_behaviors (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        session_id VARCHAR(255),
        action_type VARCHAR(50) NOT NULL,
        action_target VARCHAR(100),
        action_value TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        user_agent TEXT,
        ip_address INET
      )
    `);

    // Indexes for performance and analytics
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_id ON user_behaviors(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_behaviors_session_id ON user_behaviors(session_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_behaviors_action_type ON user_behaviors(action_type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_behaviors_created_at ON user_behaviors(created_at DESC);
    `);

  } finally {
    client.release();
  }
}

// Drop old unused tables if they exist
async function cleanupOldTables() {
  const client = await getPool().connect();
  try {
    // Check if old users table exists and drop it
    await client.query(`
      DROP TABLE IF EXISTS users CASCADE;
    `);
    
    console.log('Cleaned up old unused tables');
  } catch (error) {
    console.warn('Error cleaning up old tables (this is usually fine):', error.message);
  } finally {
    client.release();
  }
}

// 导出模块
module.exports = {
  getPool,
  ensureCommunityTables,
  ensureAuthTables,
  ensureUserBehaviorTable,
  cleanupOldTables
};