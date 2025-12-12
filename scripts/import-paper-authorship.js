const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function importPaperAuthorship() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('=== 1. 创建论文作者关联表 ===');
    await client.query(`
      CREATE TABLE IF NOT EXISTS paper_authorship (
        id SERIAL PRIMARY KEY,
        submission_number INTEGER NOT NULL,
        author_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES people(person_id) ON DELETE CASCADE
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_paper_authorship_submission ON paper_authorship(submission_number);
      CREATE INDEX IF NOT EXISTS idx_paper_authorship_author ON paper_authorship(author_id);
    `);
    
    console.log('=== 2. 加载people.json数据 ===');
    const peopleData = JSON.parse(fs.readFileSync('./review-data/people.json', 'utf8'));
    
    console.log('=== 3. 清理旧数据并插入新数据 ===');
    await client.query('DELETE FROM paper_authorship');
    
    let insertCount = 0;
    const batchSize = 1000;
    const insertBatch = [];
    
    for (const [personId, personData] of Object.entries(peopleData.people)) {
      // 插入authored_papers
      if (personData.authored_papers && personData.authored_papers.length > 0) {
        for (const submissionNumber of personData.authored_papers) {
          insertBatch.push([submissionNumber, personId]);
          
          if (insertBatch.length >= batchSize) {
            await insertBatchData(client, insertBatch);
            insertCount += insertBatch.length;
            insertBatch.length = 0;
            console.log(`已插入 ${insertCount} 条作者关联记录...`);
          }
        }
      }
    }
    
    // 插入剩余数据
    if (insertBatch.length > 0) {
      await insertBatchData(client, insertBatch);
      insertCount += insertBatch.length;
    }
    
    console.log('=== 4. 检查结果 ===');
    const totalCount = await client.query('SELECT COUNT(*) FROM paper_authorship');
    console.log(`总共插入了 ${totalCount.rows[0].count} 条作者关联记录`);
    
    // 检查Artur Jesslen的数据
    const arturData = await client.query(`
      SELECT pa.submission_number, pa.author_id 
      FROM paper_authorship pa 
      WHERE pa.author_id = '~Artur_Jesslen1'
    `);
    console.log('Artur Jesslen的authored papers:');
    console.table(arturData.rows);
    
    // 检查他authored papers的reviewers
    if (arturData.rows.length > 0) {
      const submissionNumber = arturData.rows[0].submission_number;
      console.log(`\\n=== 检查submission ${submissionNumber}的reviewers ===`);
      const reviewers = await client.query(`
        SELECT sr.reviewer_id, p.name, p.nationality, p.gender, p.institution
        FROM submission_reviews sr
        LEFT JOIN people p ON sr.reviewer_id = p.person_id
        WHERE sr.submission_number = $1
      `, [submissionNumber]);
      console.log(`Submission ${submissionNumber}的reviewers:`);
      console.table(reviewers.rows);
    }
    
    // 检查他reviewed papers的authors  
    const reviewedSubmissions = [6233, 7407]; // Artur reviewed papers
    for (const submissionNumber of reviewedSubmissions) {
      console.log(`\\n=== 检查submission ${submissionNumber}的authors ===`);
      const authors = await client.query(`
        SELECT pa.author_id, p.name, p.nationality, p.gender, p.institution
        FROM paper_authorship pa
        LEFT JOIN people p ON pa.author_id = p.person_id
        WHERE pa.submission_number = $1
      `, [submissionNumber]);
      console.log(`Submission ${submissionNumber}的authors:`);
      console.table(authors.rows);
    }
    
    console.log('=== 导入完成! ===');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) client.release();
    pool.end();
  }
}

async function insertBatchData(client, batch) {
  const query = `
    INSERT INTO paper_authorship (submission_number, author_id)
    VALUES ${batch.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}
    ON CONFLICT DO NOTHING
  `;
  
  const values = batch.flat();
  await client.query(query, values);
}

importPaperAuthorship().catch(console.error);