#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

// Initialize auth database tables for Better Auth
const { ensureAuthTables, ensureCommunityTables, ensureUserBehaviorTable, cleanupOldTables } = require('../lib/db.js');

//import { ensureAuthTables, ensureCommunityTables, ensureUserBehaviorTable, cleanupOldTables } from '../lib/db.js';

async function initializeDatabase() {
  try {
    console.log('🔧 Initializing authentication database...');
    
    // Clean up old unused tables first
    await cleanupOldTables();
    
    // Create Better Auth tables
    console.log('📝 Creating Better Auth tables...');
    await ensureAuthTables();
    
    // Ensure community tables are up to date
    console.log('💬 Ensuring community tables...');
    await ensureCommunityTables();
    
    // Ensure user behavior tracking table
    console.log('📊 Ensuring user behavior tracking table...');
    await ensureUserBehaviorTable();
    
    console.log('✅ Database initialization complete!');
    console.log('');
    console.log('Created tables:');
    console.log('  - user (Better Auth users)');
    console.log('  - session (Better Auth sessions)');
    console.log('  - account (OAuth provider accounts)');
    console.log('  - verification (Email verification tokens)');
    console.log('  - posts (Community posts)');
    console.log('  - comments (Community comments)');
    console.log('  - likes (Community likes)');
    console.log('  - user_behaviors (User behavior tracking)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();