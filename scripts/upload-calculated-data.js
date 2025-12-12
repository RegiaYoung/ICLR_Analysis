const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
/**
 * 简化版本：只上传计算好的统计数据到Neon数据库
 * 专门处理calculated-stats文件夹中的数据
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

async function uploadCalculatedStats(client) {
  console.log('📊 上传计算好的统计数据...');
  
  const statsDir = path.join(process.cwd(), 'calculated-stats');
  
  // 1. 上传审稿人统计
  console.log('  上传审稿人统计...');
  const reviewerStats = readJsonFile(path.join(statsDir, 'reviewer_stats.json'));
  if (reviewerStats && reviewerStats.reviewers) {
    // 清空现有数据
    await client.query('DELETE FROM reviewer_statistics');
    
    let uploadedCount = 0;
    for (const r of reviewerStats.reviewers) {
      try {
        await client.query(`
          INSERT INTO reviewer_statistics 
          (reviewer_id, review_count, avg_rating, avg_confidence, avg_text_length, rating_std, question_ratio, institution)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          r.reviewer_id,
          r.review_count,
          r.avg_rating,
          r.avg_confidence,
          r.avg_text_length,
          r.rating_std,
          r.question_ratio,
          typeof r.institution === 'object' ? JSON.stringify(r.institution) : r.institution
        ]);
        uploadedCount++;
        
        if (uploadedCount % 1000 === 0) {
          console.log(`    已上传 ${uploadedCount}/${reviewerStats.reviewers.length} 审稿人统计`);
        }
      } catch (error) {
        console.warn(`    跳过审稿人 ${r.reviewer_id}: ${error.message}`);
      }
    }
    
    console.log(`    ✓ 成功上传 ${uploadedCount} 个审稿人统计`);
  }
  
  // 2. 上传论文统计
  console.log('  上传论文统计...');
  const submissionStats = readJsonFile(path.join(statsDir, 'submission_stats.json'));
  if (submissionStats && submissionStats.submissions) {
    await client.query('DELETE FROM submission_statistics');
    
    let uploadedCount = 0;
    for (const s of submissionStats.submissions) {
      try {
        await client.query(`
          INSERT INTO submission_statistics 
          (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          s.submission_id,
          s.submission_number,
          s.review_count,
          s.avg_rating,
          s.rating_std,
          s.avg_confidence,
          s.ethics_flag
        ]);
        uploadedCount++;
        
        if (uploadedCount % 1000 === 0) {
          console.log(`    已上传 ${uploadedCount}/${submissionStats.submissions.length} 论文统计`);
        }
      } catch (error) {
        console.warn(`    跳过论文 ${s.submission_id}: ${error.message}`);
      }
    }
    
    console.log(`    ✓ 成功上传 ${uploadedCount} 个论文统计`);
  }
  
  // 3. 上传排行榜数据
  console.log('  上传排行榜数据...');
  const topLists = readJsonFile(path.join(statsDir, 'top_lists.json'));
  if (topLists) {
    await client.query('DELETE FROM top_lists');
    
    const listTypes = [
      'most_lenient', 'most_strict', 'most_volatile', 'most_stable',
      'longest_texts', 'most_questions', 'most_disputed_papers',
      'most_consistent_papers', 'ethics_flagged_submissions', 'repeat_authors'
    ];
    
    let totalUploaded = 0;
    for (const listType of listTypes) {
      if (topLists[listType] && Array.isArray(topLists[listType])) {
        for (let i = 0; i < topLists[listType].length; i++) {
          const item = topLists[listType][i];
          try {
            await client.query(`
              INSERT INTO top_lists (list_type, rank, item_id, item_data)
              VALUES ($1, $2, $3, $4)
            `, [
              listType,
              i + 1,
              item.reviewer_id || item.submission_id || item.author_id || `item_${i}`,
              JSON.stringify(item)
            ]);
            totalUploaded++;
          } catch (error) {
            console.warn(`    跳过 ${listType} 第 ${i + 1} 项: ${error.message}`);
          }
        }
        console.log(`    ✓ ${listType}: ${topLists[listType].length} 项`);
      }
    }
    
    console.log(`    ✓ 总共上传 ${totalUploaded} 个排行榜项`);
  }
  
  // 4. 更新机构统计（如果需要）
  console.log('  检查机构统计...');
  const institutionStats = readJsonFile(path.join(statsDir, 'institution_stats.json'));
  if (institutionStats && institutionStats.institutions && institutionStats.institutions.length > 1) {
    let updatedCount = 0;
    for (const inst of institutionStats.institutions) {
      try {
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
        updatedCount++;
      } catch (error) {
        console.warn(`    跳过机构 ${inst.institution_name}: ${error.message}`);
      }
    }
    
    console.log(`    ✓ 更新 ${updatedCount} 个机构统计`);
  } else {
    console.log(`    ⚠ 机构数据不足，跳过机构统计更新`);
  }
  
  console.log('✅ 统计数据上传完成');
}

async function verifyUpload(client) {
  console.log('🔍 验证上传结果...');
  
  const checks = [
    ['reviewer_statistics', 'SELECT COUNT(*) FROM reviewer_statistics'],
    ['submission_statistics', 'SELECT COUNT(*) FROM submission_statistics'],
    ['top_lists总数', 'SELECT COUNT(*) FROM top_lists'],
    ['top_lists分类', 'SELECT list_type, COUNT(*) FROM top_lists GROUP BY list_type ORDER BY list_type']
  ];
  
  for (const [name, query] of checks) {
    try {
      const result = await client.query(query);
      if (name === 'top_lists分类') {
        console.log(`  ${name}:`);
        result.rows.forEach(row => {
          console.log(`    - ${row.list_type}: ${row.count} 项`);
        });
      } else {
        console.log(`  ${name}: ${result.rows[0].count} 条记录`);
      }
    } catch (error) {
      console.log(`  ${name}: 检查失败 - ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 开始上传计算好的统计数据到Neon数据库...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接成功\n');
    
    // 上传数据
    await uploadCalculatedStats(client);
    
    // 验证上传
    await verifyUpload(client);
    
    console.log('\n🎉 数据上传完成！');
    console.log('\n现在可以：');
    console.log('1. 测试 /api/top-lists - 应该返回 data_source: "top_lists_table"');
    console.log('2. 测试 /api/db-stats - 应该返回 data_source: "optimized_database"');
    console.log('3. 检查前端页面的排行榜是否正常显示');
    
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    console.log('\n💡 故障排除：');
    console.log('1. 检查数据库连接串是否正确');
    console.log('2. 确认数据库中已创建必要的表');
    console.log('3. 运行 scripts/upload-to-neon.sql 创建表结构');
    console.log('4. 检查calculated-stats/文件夹中的数据文件');
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}