const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function fixPeopleInstitutions() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('=== 1. 检查当前people表结构和数据 ===');
    const currentSample = await client.query(`
      SELECT person_id, name, institution, nationality, gender 
      FROM people 
      WHERE person_id LIKE '~%' 
      LIMIT 5
    `);
    console.log('当前people表样例:', currentSample.rows);
    
    console.log('=== 2. 加载和分析people.json数据 ===');
    const peopleData = JSON.parse(fs.readFileSync('./review-data/people.json', 'utf8'));
    
    // 分析第一个人的数据结构
    const firstPersonId = Object.keys(peopleData.people)[0];
    const firstPersonData = peopleData.people[firstPersonId];
    console.log('原始数据结构样例:', JSON.stringify(firstPersonData, null, 2));
    
    console.log('=== 3. 更新people表结构 ===');
    // 添加新列来存储机构数组
    await client.query(`
      ALTER TABLE people 
      ADD COLUMN IF NOT EXISTS institutions TEXT[];
    `);
    
    // 创建人员-机构关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS person_institutions (
        id SERIAL PRIMARY KEY,
        person_id VARCHAR(255) NOT NULL,
        institution_name VARCHAR(500) NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES people(person_id) ON DELETE CASCADE
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_person_institutions_person_id ON person_institutions(person_id);
      CREATE INDEX IF NOT EXISTS idx_person_institutions_institution ON person_institutions(institution_name);
    `);
    
    console.log('=== 4. 批量更新people表的机构信息 ===');
    let updateCount = 0;
    const batchSize = 500;
    const peopleEntries = Object.entries(peopleData.people);
    
    for (let i = 0; i < peopleEntries.length; i += batchSize) {
      const batch = peopleEntries.slice(i, i + batchSize);
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(peopleEntries.length / batchSize)}`);
      
      for (const [personId, personData] of batch) {
        try {
          // 更新people表的主机构信息（第一个机构作为主机构）
          const primaryInstitution = personData.institutions && personData.institutions.length > 0 
            ? personData.institutions[0] 
            : null;
          
          await client.query(`
            UPDATE people 
            SET 
              institution = $1,
              institutions = $2
            WHERE person_id = $3
          `, [
            primaryInstitution,
            personData.institutions || [],
            personId
          ]);
          
          // 删除旧的关联记录
          await client.query(`
            DELETE FROM person_institutions WHERE person_id = $1
          `, [personId]);
          
          // 插入新的机构关联
          if (personData.institutions && personData.institutions.length > 0) {
            for (let idx = 0; idx < personData.institutions.length; idx++) {
              const institution = personData.institutions[idx];
              await client.query(`
                INSERT INTO person_institutions (person_id, institution_name, is_primary)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
              `, [personId, institution, idx === 0]);
            }
          }
          
          updateCount++;
        } catch (error) {
          console.error(`更新 ${personId} 时出错:`, error.message);
        }
      }
    }
    
    console.log('=== 5. 检查更新结果 ===');
    const updatedStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(institution) as with_institution,
        COUNT(gender) as with_gender,
        COUNT(institutions) as with_institutions_array
      FROM people
    `);
    console.log('更新后统计:', updatedStats.rows[0]);
    
    const institutionSample = await client.query(`
      SELECT person_id, name, institution, institutions, nationality, gender 
      FROM people 
      WHERE institution IS NOT NULL 
      LIMIT 5
    `);
    console.log('更新后的机构信息样例:');
    console.table(institutionSample.rows);
    
    const multiInstitutionCount = await client.query(`
      SELECT COUNT(*) as count
      FROM people 
      WHERE array_length(institutions, 1) > 1
    `);
    console.log('有多个机构的人员数量:', multiInstitutionCount.rows[0].count);
    
    const personInstCount = await client.query(`
      SELECT COUNT(*) as total_relations
      FROM person_institutions
    `);
    console.log('person_institutions关联总数:', personInstCount.rows[0].total_relations);
    
    console.log(`=== 机构信息修复完成！共更新 ${updateCount} 个人员记录 ===`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) client.release();
    pool.end();
  }
}

fixPeopleInstitutions().catch(console.error);