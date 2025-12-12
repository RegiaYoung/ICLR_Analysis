const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * 优化Neon数据库结构并导入计算好的统计数据
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 5,
});

function readJsonFile(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error.message);
    return null;
  }
}

async function getCurrentTables(client) {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  return result.rows.map(row => row.table_name);
}

async function dropUnnecessaryTables(client) {
  console.log('🧹 清理不必要的表...');
  
  const tablesToDrop = [
    'verification',
    'reviews_summary', 
    'submission_reviews',
    'conflicts',
    'paper_authorship'
  ];
  
  for (const table of tablesToDrop) {
    try {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`  ✓ 删除表: ${table}`);
    } catch (error) {
      console.log(`  ⚠ 删除表失败 ${table}:`, error.message);
    }
  }
}

async function createOptimizedSchema(client) {
  console.log('🏗️ 创建优化的数据库表结构...');
  
  // 1. 确保基础表存在
  await client.query(`
    CREATE TABLE IF NOT EXISTS people (
      person_id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      role TEXT,
      gender TEXT,
      country TEXT,
      institutions JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_people_role ON people(role);
    CREATE INDEX IF NOT EXISTS idx_people_country ON people(country);
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS institutions (
      institution_name TEXT PRIMARY KEY,
      country TEXT,
      institution_type TEXT,
      total_members INTEGER DEFAULT 0,
      author_count INTEGER DEFAULT 0,
      reviewer_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(country);
    CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(institution_type);
  `);
  
  // 2. 创建统计表
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
    
    CREATE INDEX IF NOT EXISTS idx_reviewer_stats_count ON reviewer_statistics(review_count);
    CREATE INDEX IF NOT EXISTS idx_reviewer_stats_rating ON reviewer_statistics(avg_rating);
    CREATE INDEX IF NOT EXISTS idx_reviewer_stats_std ON reviewer_statistics(rating_std);
  `);
  
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
    
    CREATE INDEX IF NOT EXISTS idx_submission_stats_std ON submission_statistics(rating_std);
    CREATE INDEX IF NOT EXISTS idx_submission_ethics ON submission_statistics(ethics_flag);
  `);
  
  // 3. 创建排行榜表
  await client.query(`
    CREATE TABLE IF NOT EXISTS top_lists (
      list_type TEXT,
      rank INTEGER,
      item_id TEXT,
      item_data JSONB,
      PRIMARY KEY (list_type, rank)
    );
    
    CREATE INDEX IF NOT EXISTS idx_top_lists_type ON top_lists(list_type);
  `);
  
  console.log('✓ 数据库表结构创建完成');
}

async function importCalculatedStats(client) {
  console.log('📊 导入计算好的统计数据...');
  
  const statsDir = path.join(process.cwd(), 'calculated-stats');
  
  // 1. 导入审稿人统计
  console.log('  导入审稿人统计...');
  const reviewerStats = readJsonFile(path.join(statsDir, 'reviewer_stats.json'));
  if (reviewerStats && reviewerStats.reviewers) {
    await client.query('DELETE FROM reviewer_statistics');
    
    const reviewerValues = reviewerStats.reviewers.map(r => [
      r.reviewer_id,
      r.review_count,
      r.avg_rating,
      r.avg_confidence,
      r.avg_text_length,
      r.rating_std,
      r.question_ratio,
      r.institution
    ]);
    
    for (const values of reviewerValues) {
      await client.query(`
        INSERT INTO reviewer_statistics 
        (reviewer_id, review_count, avg_rating, avg_confidence, avg_text_length, rating_std, question_ratio, institution)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, values);
    }
    
    console.log(`    ✓ 导入 ${reviewerValues.length} 个审稿人统计`);
  }
  
  // 2. 导入论文统计
  console.log('  导入论文统计...');
  const submissionStats = readJsonFile(path.join(statsDir, 'submission_stats.json'));
  if (submissionStats && submissionStats.submissions) {
    await client.query('DELETE FROM submission_statistics');
    
    const submissionValues = submissionStats.submissions.map(s => [
      s.submission_id,
      s.submission_number,
      s.review_count,
      s.avg_rating,
      s.rating_std,
      s.avg_confidence,
      s.ethics_flag
    ]);
    
    for (const values of submissionValues) {
      await client.query(`
        INSERT INTO submission_statistics 
        (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, values);
    }
    
    console.log(`    ✓ 导入 ${submissionValues.length} 个论文统计`);
  }
  
  // 3. 导入机构统计  
  console.log('  更新机构统计...');
  const institutionStats = readJsonFile(path.join(statsDir, 'institution_stats.json'));
  if (institutionStats && institutionStats.institutions) {
    for (const inst of institutionStats.institutions) {
      await client.query(`
        INSERT INTO institutions 
        (institution_name, country, institution_type, total_members, author_count, reviewer_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (institution_name) 
        DO UPDATE SET 
          country = EXCLUDED.country,
          institution_type = EXCLUDED.institution_type,
          total_members = EXCLUDED.total_members,
          author_count = EXCLUDED.author_count,
          reviewer_count = EXCLUDED.reviewer_count
      `, [
        inst.institution_name,
        inst.country,
        inst.institution_type,
        inst.total_members,
        inst.author_count,
        inst.reviewer_count
      ]);
    }
    
    console.log(`    ✓ 更新 ${institutionStats.institutions.length} 个机构统计`);
  }
  
  // 4. 导入排行榜数据
  console.log('  导入排行榜数据...');
  const topLists = readJsonFile(path.join(statsDir, 'top_lists.json'));
  if (topLists) {
    await client.query('DELETE FROM top_lists');
    
    const listTypes = [
      'most_lenient', 'most_strict', 'most_volatile', 'most_stable',
      'longest_texts', 'most_questions', 'most_disputed_papers',
      'most_consistent_papers', 'ethics_flagged_submissions', 'repeat_authors'
    ];
    
    for (const listType of listTypes) {
      if (topLists[listType] && Array.isArray(topLists[listType])) {
        for (let i = 0; i < topLists[listType].length; i++) {
          const item = topLists[listType][i];
          await client.query(`
            INSERT INTO top_lists (list_type, rank, item_id, item_data)
            VALUES ($1, $2, $3, $4)
          `, [
            listType,
            i + 1,
            item.reviewer_id || item.submission_id || item.author_id || `item_${i}`,
            JSON.stringify(item)
          ]);
        }
        console.log(`    ✓ ${listType}: ${topLists[listType].length} 项`);
      }
    }
  }
  
  console.log('✓ 统计数据导入完成');
}

async function generateDatabaseReport(client) {
  console.log('📋 生成数据库状态报告...');
  
  const tables = await getCurrentTables(client);
  console.log(`\n当前数据库表 (${tables.length}):`);
  tables.forEach(table => console.log(`  - ${table}`));
  
  console.log('\n数据统计:');
  
  const dataCounts = {
    people: await client.query('SELECT COUNT(*) FROM people'),
    institutions: await client.query('SELECT COUNT(*) FROM institutions'),  
    reviewer_statistics: await client.query('SELECT COUNT(*) FROM reviewer_statistics'),
    submission_statistics: await client.query('SELECT COUNT(*) FROM submission_statistics'),
    top_lists: await client.query('SELECT list_type, COUNT(*) as count FROM top_lists GROUP BY list_type')
  };
  
  console.log(`  - 人员数据: ${dataCounts.people.rows[0].count}`);
  console.log(`  - 机构数据: ${dataCounts.institutions.rows[0].count}`);
  console.log(`  - 审稿人统计: ${dataCounts.reviewer_statistics.rows[0].count}`);
  console.log(`  - 论文统计: ${dataCounts.submission_statistics.rows[0].count}`);
  
  console.log('\n排行榜数据:');
  dataCounts.top_lists.rows.forEach(row => {
    console.log(`  - ${row.list_type}: ${row.count} 项`);
  });
}

async function main() {
  console.log('开始优化Neon数据库...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✓ 数据库连接成功\n');
    
    // 1. 查看当前表结构
    const currentTables = await getCurrentTables(client);
    console.log(`当前数据库有 ${currentTables.length} 个表:`, currentTables.join(', '));
    
    // 2. 删除不需要的表
    await dropUnnecessaryTables(client);
    
    // 3. 创建优化的表结构
    await createOptimizedSchema(client);
    
    // 4. 导入计算好的统计数据
    await importCalculatedStats(client);
    
    // 5. 生成报告
    await generateDatabaseReport(client);
    
    console.log('\n🎉 数据库优化完成!');
    console.log('\n接下来需要:');
    console.log('1. 更新API路由以使用新的表结构');
    console.log('2. 测试前端界面数据显示');
    console.log('3. 确认所有排行榜数据正常显示');
    
  } catch (error) {
    console.error('数据库优化失败:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}