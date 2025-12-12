const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function createStatsTables(client) {
  console.log('🏗️ 创建统计表...');
  
  // 1. 创建审稿人统计表
  await client.query(`
    CREATE TABLE IF NOT EXISTS reviewer_statistics (
      reviewer_id TEXT PRIMARY KEY,
      review_count INTEGER,
      avg_rating DECIMAL(4,2),
      avg_confidence DECIMAL(4,2),
      avg_text_length INTEGER,
      rating_std DECIMAL(5,3),
      question_ratio DECIMAL(4,3),
      institution TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✓ reviewer_statistics表创建成功');
  
  // 2. 创建论文统计表
  await client.query(`
    CREATE TABLE IF NOT EXISTS submission_statistics (
      submission_id TEXT PRIMARY KEY,
      submission_number TEXT,
      review_count INTEGER,
      avg_rating DECIMAL(4,2),
      rating_std DECIMAL(5,3),
      avg_confidence DECIMAL(4,2),
      ethics_flag INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✓ submission_statistics表创建成功');
  
  // 3. 确保top_lists表存在且结构正确
  await client.query(`
    DROP TABLE IF EXISTS top_lists;
    CREATE TABLE top_lists (
      list_type TEXT,
      rank INTEGER,
      item_id TEXT,
      item_data JSONB,
      PRIMARY KEY (list_type, rank)
    );
  `);
  console.log('  ✓ top_lists表重新创建成功');
  
  // 4. 创建索引
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_reviewer_stats_count ON reviewer_statistics(review_count);
    CREATE INDEX IF NOT EXISTS idx_reviewer_stats_rating ON reviewer_statistics(avg_rating);
    CREATE INDEX IF NOT EXISTS idx_reviewer_stats_std ON reviewer_statistics(rating_std);
    CREATE INDEX IF NOT EXISTS idx_submission_stats_std ON submission_statistics(rating_std);
    CREATE INDEX IF NOT EXISTS idx_submission_ethics ON submission_statistics(ethics_flag);
    CREATE INDEX IF NOT EXISTS idx_top_lists_type ON top_lists(list_type);
  `);
  console.log('  ✓ 索引创建成功');
  
  console.log('✅ 所有统计表创建完成');
}

async function main() {
  console.log('🚀 开始创建统计表...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接成功\n');
    
    await createStatsTables(client);
    
    console.log('\n🎉 统计表创建完成！');
    console.log('现在可以运行: node scripts/upload-calculated-data.js');
    
  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}