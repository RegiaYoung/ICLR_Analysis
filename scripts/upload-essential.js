const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  max: 3,
});

async function uploadEssentialData() {
  console.log('🚀 上传必要数据使前端正常工作...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接成功\n');
    
    // 1. 上传top_lists数据（前端Overview页面必需）
    console.log('1. 上传排行榜数据...');
    const topListsPath = path.join(process.cwd(), 'calculated-stats', 'top_lists.json');
    const topListsData = JSON.parse(fs.readFileSync(topListsPath, 'utf8'));
    
    // 清空现有数据
    await client.query('DELETE FROM top_lists');
    
    const listTypes = [
      'most_lenient', 'most_strict', 'most_volatile', 'most_stable',
      'longest_texts', 'most_questions', 'most_disputed_papers',
      'most_consistent_papers', 'ethics_flagged_submissions', 'repeat_authors'
    ];
    
    let totalInserted = 0;
    for (const listType of listTypes) {
      if (topListsData[listType] && Array.isArray(topListsData[listType])) {
        console.log(`  上传 ${listType}...`);
        
        for (let i = 0; i < topListsData[listType].length; i++) {
          const item = topListsData[listType][i];
          try {
            await client.query(
              'INSERT INTO top_lists (list_type, rank, item_id, item_data) VALUES ($1, $2, $3, $4)',
              [
                listType,
                i + 1,
                item.reviewer_id || item.submission_id || item.author_id || `item_${i}`,
                JSON.stringify(item)
              ]
            );
            totalInserted++;
          } catch (error) {
            console.warn(`    跳过 ${listType} 第 ${i + 1} 项: ${error.message}`);
          }
        }
        
        console.log(`    ✓ ${listType}: ${topListsData[listType].length} 项`);
      }
    }
    
    console.log(`  ✓ 总共插入 ${totalInserted} 个排行榜项`);
    
    // 2. 上传一些submission_statistics确保数据展示正常
    console.log('\n2. 上传论文统计样本...');
    const submissionStatsPath = path.join(process.cwd(), 'calculated-stats', 'submission_stats.json');
    const submissionData = JSON.parse(fs.readFileSync(submissionStatsPath, 'utf8'));
    
    if (submissionData.submissions && submissionData.submissions.length > 0) {
      // 取前100个作为样本
      const sampleSubmissions = submissionData.submissions.slice(0, 100);
      
      for (const s of sampleSubmissions) {
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
        } catch (error) {
          console.warn(`    跳过论文 ${s.submission_id}: ${error.message}`);
        }
      }
      
      console.log(`  ✓ 插入 ${sampleSubmissions.length} 个论文统计样本`);
    }
    
    // 验证结果
    console.log('\n3. 验证数据...');
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
    
    console.log('\n🎉 必要数据上传完成！前端Overview页面应该可以正常显示了。');
    console.log('\n💡 可以继续在后台上传剩余的reviewer_statistics数据。');
    
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  uploadEssentialData().catch(console.error);
}