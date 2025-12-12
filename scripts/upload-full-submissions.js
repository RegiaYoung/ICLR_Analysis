const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  max: 5,
});

async function uploadFullSubmissions() {
  console.log('🚀 上传完整的submission_statistics数据...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接成功\n');
    
    // Load full submission data
    const submissionStatsPath = path.join(process.cwd(), 'calculated-stats', 'submission_stats.json');
    const submissionData = JSON.parse(fs.readFileSync(submissionStatsPath, 'utf8'));
    
    console.log(`📊 发现 ${submissionData.submissions.length} 条submission记录`);
    
    // Clear existing data
    console.log('🗑️  清空现有submission_statistics数据...');
    await client.query('DELETE FROM submission_statistics');
    
    // Upload in batches
    const batchSize = 500;
    let uploaded = 0;
    
    for (let i = 0; i < submissionData.submissions.length; i += batchSize) {
      const batch = submissionData.submissions.slice(i, i + batchSize);
      
      console.log(`📤 上传批次 ${Math.floor(i/batchSize) + 1}: ${i + 1}-${Math.min(i + batchSize, submissionData.submissions.length)}`);
      
      await client.query('BEGIN');
      
      try {
        for (const submission of batch) {
          await client.query(`
            INSERT INTO submission_statistics 
            (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            submission.submission_id,
            submission.submission_number,
            submission.review_count,
            submission.avg_rating,
            submission.rating_std,
            submission.avg_confidence,
            submission.ethics_flag
          ]);
          uploaded++;
        }
        
        await client.query('COMMIT');
        console.log(`  ✅ 批次完成，已上传 ${uploaded}/${submissionData.submissions.length} 条记录`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ❌ 批次失败: ${error.message}`);
        
        // Try individual inserts for failed batch
        for (const submission of batch) {
          try {
            await client.query(`
              INSERT INTO submission_statistics 
              (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              submission.submission_id,
              submission.submission_number,
              submission.review_count,
              submission.avg_rating,
              submission.rating_std,
              submission.avg_confidence,
              submission.ethics_flag
            ]);
            uploaded++;
          } catch (e) {
            console.warn(`    跳过submission ${submission.submission_number}: ${e.message}`);
          }
        }
      }
      
      // Progress update
      const progress = ((uploaded / submissionData.submissions.length) * 100).toFixed(1);
      console.log(`  📈 进度: ${progress}%\n`);
    }
    
    // Verify upload
    console.log('🔍 验证上传结果...');
    const finalCount = await client.query('SELECT COUNT(*) FROM submission_statistics');
    const minMax = await client.query(`
      SELECT 
        MIN(submission_number::int) as min_num, 
        MAX(submission_number::int) as max_num,
        AVG(review_count) as avg_reviews
      FROM submission_statistics
    `);
    
    console.log(`📊 上传完成统计:`);
    console.log(`  - 总记录数: ${finalCount.rows[0].count}`);
    console.log(`  - 论文编号范围: ${minMax.rows[0].min_num} - ${minMax.rows[0].max_num}`);
    console.log(`  - 平均评审数: ${parseFloat(minMax.rows[0].avg_reviews).toFixed(2)}`);
    
    console.log('\n🎉 submission_statistics数据上传完成！');
    console.log('现在搜索功能应该可以找到更多论文了。');
    
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    console.log('\n💡 请检查：');
    console.log('1. 数据库连接是否正常');
    console.log('2. submission_statistics表是否存在');
    console.log('3. calculated-stats/submission_stats.json文件是否存在');
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  uploadFullSubmissions().catch(console.error);
}