const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function reimportPeopleData() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('=== 1. Dropping and recreating people table ===');
    await client.query('DROP TABLE IF EXISTS people CASCADE');
    
    // Create new people table with all necessary fields
    await client.query(`
      CREATE TABLE people (
        id SERIAL PRIMARY KEY,
        person_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(500),
        nationality VARCHAR(255),
        gender VARCHAR(100),
        role VARCHAR(255),
        institution VARCHAR(500),
        institution_type VARCHAR(255),
        institution_country VARCHAR(255),
        reviewer_stats JSONB,
        total_papers INTEGER DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX idx_people_person_id ON people (person_id);
      CREATE INDEX idx_people_name ON people (name);
      CREATE INDEX idx_people_nationality ON people (nationality);
      CREATE INDEX idx_people_gender ON people (gender);
      CREATE INDEX idx_people_institution ON people (institution);
    `);

    console.log('=== 2. Loading people.json ===');
    const peopleData = JSON.parse(fs.readFileSync('./review-data/people.json', 'utf8'));
    console.log(`Total people in JSON: ${peopleData.metadata.total_people}`);

    console.log('=== 3. Processing and inserting people data ===');
    const peopleToInsert = [];
    
    // Process people data
    for (const [personId, personData] of Object.entries(peopleData.people)) {
      peopleToInsert.push({
        person_id: personId,
        name: personData.name || null,
        nationality: personData.nationality || null,
        gender: personData.gender || null,
        role: personData.role || null,
        institution: personData.institution || null,
        institution_type: personData.institution_type || null,
        institution_country: personData.institution_country || null,
        reviewer_stats: personData.reviewer_stats ? JSON.stringify(personData.reviewer_stats) : null,
        total_papers: personData.total_papers || 0,
        total_reviews: personData.total_reviews || 0
      });
    }

    console.log(`Processing ${peopleToInsert.length} people...`);

    // Batch insert
    const batchSize = 1000;
    for (let i = 0; i < peopleToInsert.length; i += batchSize) {
      const batch = peopleToInsert.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(peopleToInsert.length / batchSize)}`);
      
      const query = `
        INSERT INTO people (
          person_id, name, nationality, gender, role, institution, 
          institution_type, institution_country, reviewer_stats, 
          total_papers, total_reviews
        ) VALUES ${batch.map((_, index) => 
          `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, 
           $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, 
           $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`
        ).join(', ')}
        ON CONFLICT (person_id) DO UPDATE SET
          name = EXCLUDED.name,
          nationality = EXCLUDED.nationality,
          gender = EXCLUDED.gender,
          role = EXCLUDED.role,
          institution = EXCLUDED.institution,
          institution_type = EXCLUDED.institution_type,
          institution_country = EXCLUDED.institution_country,
          reviewer_stats = EXCLUDED.reviewer_stats,
          total_papers = EXCLUDED.total_papers,
          total_reviews = EXCLUDED.total_reviews
      `;

      const values = batch.flatMap(person => [
        person.person_id, person.name, person.nationality, person.gender,
        person.role, person.institution, person.institution_type, 
        person.institution_country, person.reviewer_stats,
        person.total_papers, person.total_reviews
      ]);

      await client.query(query, values);
    }

    console.log('=== 4. Checking results ===');
    const finalCount = await client.query('SELECT COUNT(*) FROM people');
    console.log(`Total people inserted: ${finalCount.rows[0].count}`);
    
    const samplePeople = await client.query(`
      SELECT person_id, name, nationality, gender, institution, institution_type 
      FROM people 
      WHERE gender IS NOT NULL 
      LIMIT 5
    `);
    console.log('Sample people with complete data:');
    console.log(samplePeople.rows);

    console.log('=== People data import completed successfully! ===');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) client.release();
    pool.end();
  }
}

reimportPeopleData().catch(console.error);