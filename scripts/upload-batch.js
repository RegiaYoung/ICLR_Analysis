const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  max: 3,
});

function readJsonFile(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error.message);
    return null;
  }
}

async function uploadInBatches(client, data, tableName, insertQuery, batchSize = 500) {
  let uploaded = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      await client.query('BEGIN');
      
      for (const item of batch) {
        await client.query(insertQuery, item);
        uploaded++;
      }
      
      await client.query('COMMIT');
      console.log(`  ✓ ${tableName}: ${uploaded}/${data.length} uploaded`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.warn(`  ⚠ Batch failed for ${tableName}: ${error.message}`);
      
      // Try individual inserts for failed batch
      for (const item of batch) {
        try {
          await client.query(insertQuery, item);
          uploaded++;
        } catch (e) {
          console.warn(`    Skip item: ${e.message}`);
        }
      }
    }
  }
  
  return uploaded;
}

async function main() {
  console.log('🚀 快速上传统计数据...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接成功\n');
    
    const statsDir = path.join(process.cwd(), 'calculated-stats');
    
    // 1. 完成审稿人统计上传
    console.log('1. 继续上传审稿人统计...');
    const reviewerStats = readJsonFile(path.join(statsDir, 'reviewer_stats.json'));
    if (reviewerStats?.reviewers) {
      const currentCount = await client.query('SELECT COUNT(*) FROM reviewer_statistics');
      const remaining = reviewerStats.reviewers.slice(parseInt(currentCount.rows[0].count));
      
      if (remaining.length > 0) {
        console.log(`  需要上传 ${remaining.length} 个剩余审稿人`);
        
        const insertQuery = `
          INSERT INTO reviewer_statistics 
          (reviewer_id, review_count, avg_rating, avg_confidence, avg_text_length, rating_std, question_ratio, institution)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        
        const formattedData = remaining.map(r => [
          r.reviewer_id,
          r.review_count,
          r.avg_rating,
          r.avg_confidence,
          r.avg_text_length,
          r.rating_std,
          r.question_ratio,
          typeof r.institution === 'object' ? JSON.stringify(r.institution) : r.institution
        ]);
        
        await uploadInBatches(client, formattedData, 'reviewer_statistics', insertQuery, 200);
      } else {
        console.log('  ✓ 审稿人统计已完成');
      }
    }
    
    // 2. 上传论文统计
    console.log('\n2. 上传论文统计...');
    const submissionStats = readJsonFile(path.join(statsDir, 'submission_stats.json'));
    if (submissionStats?.submissions) {
      await client.query('DELETE FROM submission_statistics');
      
      const insertQuery = `
        INSERT INTO submission_statistics 
        (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      const formattedData = submissionStats.submissions.map(s => [
        s.submission_id,
        s.submission_number,
        s.review_count,
        s.avg_rating,
        s.rating_std,
        s.avg_confidence,
        s.ethics_flag
      ]);
      
      await uploadInBatches(client, formattedData, 'submission_statistics', insertQuery, 300);
    }
    
    // 3. 上传排行榜数据
    console.log('\n3. 上传排行榜数据...');
    const topLists = readJsonFile(path.join(statsDir, 'top_lists.json'));
    if (topLists) {
      await client.query('DELETE FROM top_lists');
      
      const insertQuery = `
        INSERT INTO top_lists (list_type, rank, item_id, item_data)
        VALUES ($1, $2, $3, $4)
      `;
      
      const listTypes = [
        'most_lenient', 'most_strict', 'most_volatile', 'most_stable',
        'longest_texts', 'most_questions', 'most_disputed_papers',
        'most_consistent_papers', 'ethics_flagged_submissions', 'repeat_authors'
      ];
      
      let allItems = [];
      for (const listType of listTypes) {
        if (topLists[listType] && Array.isArray(topLists[listType])) {
          topLists[listType].forEach((item, i) => {
            allItems.push([
              listType,
              i + 1,
              item.reviewer_id || item.submission_id || item.author_id || `item_${i}`,
              JSON.stringify(item)
            ]);
          });
        }
      }
      
      await uploadInBatches(client, allItems, 'top_lists', insertQuery, 100);
    }
    
    // 验证结果
    console.log('\n4. 验证上传结果...');
    const checks = [
      ['reviewer_statistics', 'SELECT COUNT(*) FROM reviewer_statistics'],
      ['submission_statistics', 'SELECT COUNT(*) FROM submission_statistics'], 
      ['top_lists', 'SELECT COUNT(*) FROM top_lists']
    ];
    
    for (const [name, query] of checks) {
      const result = await client.query(query);
      console.log(`  ✓ ${name}: ${result.rows[0].count} 条记录`);
    }
    
    console.log('\n🎉 数据上传完成！');
    
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}