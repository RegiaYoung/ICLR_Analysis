const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  max: 10,
});

async function fastUploadSubmissions() {
  console.log('🚀 快速上传submission_statistics数据...\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接成功\n');
    
    // Load submission data
    const submissionStatsPath = path.join(process.cwd(), 'calculated-stats', 'submission_stats.json');
    const submissionData = JSON.parse(fs.readFileSync(submissionStatsPath, 'utf8'));
    
    console.log(`📊 发现 ${submissionData.submissions.length} 条submission记录`);
    
    // Clear existing data
    console.log('🗑️  清空现有submission_statistics数据...');
    await client.query('DELETE FROM submission_statistics');
    
    // Create CSV data for COPY command
    console.log('📝 准备CSV数据...');
    const csvHeader = 'submission_id,submission_number,review_count,avg_rating,rating_std,avg_confidence,ethics_flag\n';
    const csvData = submissionData.submissions.map(submission => {
      return [
        submission.submission_id || '',
        submission.submission_number || 0,
        submission.review_count || 0,
        submission.avg_rating || 0,
        submission.rating_std || 0,
        submission.avg_confidence || 0,
        submission.ethics_flag || 0
      ].join(',');
    }).join('\n');
    
    const fullCsv = csvHeader + csvData;
    
    // Write to temporary file
    const tempCsvPath = '/tmp/submissions_upload.csv';
    fs.writeFileSync(tempCsvPath, fullCsv);
    console.log(`📄 CSV文件已写入: ${tempCsvPath}`);
    
    // Use COPY command for bulk insert
    console.log('⚡ 开始批量导入...');
    const copyQuery = `
      COPY submission_statistics (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
      FROM STDIN WITH CSV HEADER
    `;
    
    const stream = client.query(require('pg-copy-streams').from(copyQuery));
    const fileStream = fs.createReadStream(tempCsvPath);
    
    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      fileStream.pipe(stream);
    });
    
    // Clean up temp file
    fs.unlinkSync(tempCsvPath);
    
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
    
    console.log('\n🎉 submission_statistics数据快速上传完成！');
    console.log('现在搜索功能应该可以找到包括7404在内的所有论文了。');
    
  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    
    // Fallback to batch insert if COPY fails
    if (error.message.includes('COPY') || error.message.includes('pg-copy-streams')) {
      console.log('\n🔄 COPY命令失败，回退到批量插入模式...');
      await fallbackBatchInsert(client);
    } else {
      console.log('\n💡 请检查：');
      console.log('1. 数据库连接是否正常');
      console.log('2. submission_statistics表是否存在');
      console.log('3. calculated-stats/submission_stats.json文件是否存在');
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

async function fallbackBatchInsert(client) {
  const submissionStatsPath = path.join(process.cwd(), 'calculated-stats', 'submission_stats.json');
  const submissionData = JSON.parse(fs.readFileSync(submissionStatsPath, 'utf8'));
  
  console.log('📦 使用大批次插入模式...');
  
  const batchSize = 2000; // 增大批次
  let uploaded = 0;
  
  for (let i = 0; i < submissionData.submissions.length; i += batchSize) {
    const batch = submissionData.submissions.slice(i, i + batchSize);
    
    console.log(`📤 上传批次 ${Math.floor(i/batchSize) + 1}: ${i + 1}-${Math.min(i + batchSize, submissionData.submissions.length)}`);
    
    // Build values array for multi-row insert
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    
    for (const submission of batch) {
      placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6})`);
      values.push(
        submission.submission_id,
        submission.submission_number,
        submission.review_count,
        submission.avg_rating,
        submission.rating_std,
        submission.avg_confidence,
        submission.ethics_flag
      );
      paramIndex += 7;
    }
    
    const insertQuery = `
      INSERT INTO submission_statistics 
      (submission_id, submission_number, review_count, avg_rating, rating_std, avg_confidence, ethics_flag)
      VALUES ${placeholders.join(', ')}
    `;
    
    await client.query(insertQuery, values);
    uploaded += batch.length;
    
    const progress = ((uploaded / submissionData.submissions.length) * 100).toFixed(1);
    console.log(`  ✅ 批次完成，已上传 ${uploaded}/${submissionData.submissions.length} 条记录 (${progress}%)`);
  }
}

if (require.main === module) {
  fastUploadSubmissions().catch(console.error);
}