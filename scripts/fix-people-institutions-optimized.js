const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function fixPeopleInstitutionsOptimized() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('=== 1. 加载people.json数据 ===');
    const peopleData = JSON.parse(fs.readFileSync('./review-data/people.json', 'utf8'));
    
    console.log('=== 2. 添加institutions列到people表 ===');
    await client.query(`
      ALTER TABLE people 
      ADD COLUMN IF NOT EXISTS institutions TEXT[]
    `);
    
    console.log('=== 3. 批量更新机构信息 ===');
    const peopleEntries = Object.entries(peopleData.people);
    const batchSize = 1000;
    let updateCount = 0;
    
    for (let i = 0; i < peopleEntries.length; i += batchSize) {
      const batch = peopleEntries.slice(i, i + batchSize);
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(peopleEntries.length / batchSize)}`);
      
      // 构建批量更新查询
      const updateValues = [];
      const queryParts = [];
      
      batch.forEach(([personId, personData], idx) => {
        const offset = idx * 3;
        const primaryInstitution = personData.institutions && personData.institutions.length > 0 
          ? personData.institutions[0] 
          : null;
        
        queryParts.push(`($${offset + 1}, $${offset + 2}::text[], $${offset + 3})`);
        updateValues.push(
          personId,
          personData.institutions || [],
          primaryInstitution
        );
      });
      
      if (queryParts.length > 0) {
        const updateQuery = `
          UPDATE people 
          SET 
            institutions = data.institutions,
            institution = data.institution
          FROM (VALUES ${queryParts.join(', ')}) AS data(person_id, institutions, institution)
          WHERE people.person_id = data.person_id
        `;
        
        await client.query(updateQuery, updateValues);
        updateCount += batch.length;
      }
    }
    
    console.log('=== 4. 检查更新结果 ===');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(institution) as with_institution,
        COUNT(institutions) as with_institutions_array,
        COUNT(CASE WHEN array_length(institutions, 1) > 1 THEN 1 END) as multi_institutions
      FROM people
    `);
    console.log('更新统计:', stats.rows[0]);
    
    const samples = await client.query(`
      SELECT person_id, name, institution, institutions, nationality, gender 
      FROM people 
      WHERE institution IS NOT NULL 
      LIMIT 5
    `);
    console.log('机构信息样例:');
    console.table(samples.rows);
    
    console.log(`=== 完成！共更新 ${updateCount} 条记录 ===`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) client.release();
    pool.end();
  }
}

fixPeopleInstitutionsOptimized().catch(console.error);