const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Creating database tables...');

    // 1. Reviews table - stores review summary data
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews_summary (
        id SERIAL PRIMARY KEY,
        total_submissions INTEGER NOT NULL,
        total_reviews INTEGER NOT NULL,
        reviews_per_submission JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. People table - stores reviewer and author information
    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        person_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        nationality VARCHAR(100),
        role VARCHAR(50), -- 'author', 'reviewer', 'both'
        institution VARCHAR(500),
        institution_type VARCHAR(100),
        country VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Institutions table - stores institution information  
    await client.query(`
      CREATE TABLE IF NOT EXISTS institutions (
        id SERIAL PRIMARY KEY,
        institution_name VARCHAR(500) UNIQUE NOT NULL,
        type VARCHAR(50), -- 'author_only', 'reviewer_only', 'both'
        total_members INTEGER DEFAULT 0,
        author_count INTEGER DEFAULT 0,
        reviewer_count INTEGER DEFAULT 0,
        country VARCHAR(100),
        institution_type VARCHAR(100), -- 'University', 'Company', etc.
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Institution Rankings table - for detailed institution metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS institution_rankings (
        id SERIAL PRIMARY KEY,
        institution_name VARCHAR(500) NOT NULL,
        unique_submissions_involved INTEGER DEFAULT 0,
        submissions_as_author_count INTEGER DEFAULT 0,
        submissions_as_reviewer_count INTEGER DEFAULT 0,
        avg_rating_given DECIMAL(4,2),
        min_rating_given INTEGER,
        max_rating_given INTEGER,
        avg_confidence DECIMAL(4,2),
        country VARCHAR(100),
        institution_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Conflict Analysis table - stores conflict information
    await client.query(`
      CREATE TABLE IF NOT EXISTS conflict_analysis (
        id SERIAL PRIMARY KEY,
        submission_id VARCHAR(255) NOT NULL,
        submission_number INTEGER NOT NULL,
        institution_name VARCHAR(500) NOT NULL,
        author_ids TEXT[], -- Array of author IDs
        reviewer_ids TEXT[], -- Array of reviewer IDs
        reviewer_ratings INTEGER[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Top Lists table - stores various ranking lists
    await client.query(`
      CREATE TABLE IF NOT EXISTS top_lists (
        id SERIAL PRIMARY KEY,
        list_type VARCHAR(100) NOT NULL, -- 'strict_reviewers', 'lenient_reviewers', etc.
        reviewer_id VARCHAR(255) NOT NULL,
        reviews INTEGER DEFAULT 0,
        avg_rating DECIMAL(4,2),
        median_rating DECIMAL(4,2),
        min_rating INTEGER,
        max_rating INTEGER,
        rating_std DECIMAL(4,2),
        avg_confidence DECIMAL(4,2),
        avg_text_words INTEGER DEFAULT 0,
        avg_questions_words INTEGER DEFAULT 0,
        ethics_flags INTEGER DEFAULT 0,
        soundness_score DECIMAL(3,1),
        presentation_score DECIMAL(3,1),
        contribution_score DECIMAL(3,1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Review Statistics table - for quick access to aggregated data
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_statistics (
        id SERIAL PRIMARY KEY,
        stat_type VARCHAR(100) NOT NULL, -- 'overall', 'by_country', 'by_institution'
        stat_key VARCHAR(255), -- country name, institution name, etc.
        stat_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better query performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_people_person_id ON people(person_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_people_nationality ON people(nationality);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(institution_name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(country);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_top_lists_type ON top_lists(list_type);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_top_lists_reviewer ON top_lists(reviewer_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conflict_submission ON conflict_analysis(submission_number);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_review_stats_type ON review_statistics(stat_type);');

    console.log('✅ Database tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function importJSONData() {
  const client = await pool.connect();
  try {
    console.log('📥 Importing JSON data...');

    // Read JSON files
    const reviewsPath = path.join(process.cwd(), 'review-data', 'reviews.json');
    const peoplePath = path.join(process.cwd(), 'review-data', 'people.json');
    const institutionsPath = path.join(process.cwd(), 'review-data', 'institutions.json');
    const topListsPath = path.join(process.cwd(), 'review-data', 'top_lists.json');
    const institutionRankingsPath = path.join(process.cwd(), 'review-data', 'institution_rankings.json');
    const conflictsPath = path.join(process.cwd(), 'review-data', 'same_institution_conflicts.json');

    // 1. Import reviews summary
    console.log('📊 Importing reviews summary...');
    const reviewsData = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
    await client.query(`
      INSERT INTO reviews_summary (total_submissions, total_reviews, reviews_per_submission)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [
      reviewsData.summary.total_submissions,
      reviewsData.summary.total_reviews,
      JSON.stringify(reviewsData.summary.reviews_per_submission)
    ]);

    // 2. Import people data
    console.log('👥 Importing people data...');
    const peopleData = JSON.parse(fs.readFileSync(peoplePath, 'utf8'));
    let peopleCount = 0;
    for (const [personId, personInfo] of Object.entries(peopleData.people)) {
      if (peopleCount % 1000 === 0) {
        console.log(`  Processed ${peopleCount} people...`);
      }
      
      await client.query(`
        INSERT INTO people (person_id, name, nationality, role, institution, institution_type, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (person_id) DO UPDATE SET
          name = EXCLUDED.name,
          nationality = EXCLUDED.nationality,
          role = EXCLUDED.role,
          institution = EXCLUDED.institution,
          institution_type = EXCLUDED.institution_type,
          country = EXCLUDED.country
      `, [
        personId,
        personInfo.name || null,
        personInfo.nationality || null,
        personInfo.role || null,
        personInfo.institution || null,
        personInfo.institution_type || null,
        personInfo.nationality || null // Use nationality as country for now
      ]);
      peopleCount++;
    }
    console.log(`✅ Imported ${peopleCount} people records`);

    // 3. Import institutions data
    console.log('🏛️ Importing institutions data...');
    const institutionsData = JSON.parse(fs.readFileSync(institutionsPath, 'utf8'));
    for (const institution of institutionsData.institutions) {
      await client.query(`
        INSERT INTO institutions (institution_name, type, total_members, author_count, reviewer_count, country, institution_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (institution_name) DO UPDATE SET
          type = EXCLUDED.type,
          total_members = EXCLUDED.total_members,
          author_count = EXCLUDED.author_count,
          reviewer_count = EXCLUDED.reviewer_count,
          country = EXCLUDED.country,
          institution_type = EXCLUDED.institution_type
      `, [
        institution.institution_name,
        institution.type || null,
        institution.total_members || 0,
        institution.author_count || 0,
        institution.reviewer_count || 0,
        institution.country || null,
        institution.institution_type || null
      ]);
    }
    console.log(`✅ Imported ${institutionsData.institutions.length} institution records`);

    // 4. Import institution rankings
    console.log('📈 Importing institution rankings...');
    if (fs.existsSync(institutionRankingsPath)) {
      const rankingsData = JSON.parse(fs.readFileSync(institutionRankingsPath, 'utf8'));
      for (const institution of rankingsData.most_active_institutions || []) {
        await client.query(`
          INSERT INTO institution_rankings (
            institution_name, unique_submissions_involved, submissions_as_author_count,
            submissions_as_reviewer_count, avg_rating_given, min_rating_given,
            max_rating_given, avg_confidence, country, institution_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
        `, [
          institution.institution_name,
          institution.stats?.unique_submissions_involved || 0,
          institution.stats?.submissions_as_author_count || 0,
          institution.stats?.submissions_as_reviewer_count || 0,
          institution.stats?.avg_rating_given || null,
          institution.stats?.min_rating_given || null,
          institution.stats?.max_rating_given || null,
          institution.stats?.avg_confidence || null,
          institution.country || null,
          institution.institution_type || null
        ]);
      }
      console.log(`✅ Imported institution rankings`);
    }

    // 5. Import top lists (reviewers data)
    console.log('🔝 Importing top lists...');
    if (fs.existsSync(topListsPath)) {
      const topListsData = JSON.parse(fs.readFileSync(topListsPath, 'utf8'));
      
      for (const [listType, reviewers] of Object.entries(topListsData)) {
        if (Array.isArray(reviewers)) {
          console.log(`  Importing ${listType} (${reviewers.length} records)...`);
          for (const reviewer of reviewers) {
            await client.query(`
              INSERT INTO top_lists (
                list_type, reviewer_id, reviews, avg_rating, median_rating,
                min_rating, max_rating, rating_std, avg_confidence,
                avg_text_words, avg_questions_words, ethics_flags,
                soundness_score, presentation_score, contribution_score
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT DO NOTHING
            `, [
              listType,
              reviewer.reviewer_id,
              reviewer.reviews || 0,
              reviewer.avg_rating || null,
              reviewer.median_rating || null,
              reviewer.min_rating || null,
              reviewer.max_rating || null,
              reviewer.rating_std || null,
              reviewer.avg_confidence || null,
              reviewer.avg_text_words || 0,
              reviewer.avg_questions_words || 0,
              reviewer.ethics_flags || 0,
              reviewer.avg_sub_scores?.soundness || null,
              reviewer.avg_sub_scores?.presentation || null,
              reviewer.avg_sub_scores?.contribution || null
            ]);
          }
        }
      }
      console.log(`✅ Imported top lists data`);
    }

    // 6. Import conflict analysis
    console.log('⚠️ Importing conflict analysis...');
    if (fs.existsSync(conflictsPath)) {
      const conflictsData = JSON.parse(fs.readFileSync(conflictsPath, 'utf8'));
      
      for (const conflict of conflictsData.conflict_details || []) {
        for (const institutionConflict of conflict.conflicts) {
          const authorIds = institutionConflict.authors.map(a => a.id);
          const reviewerIds = institutionConflict.reviewers.map(r => r.id);
          const reviewerRatings = institutionConflict.reviewers.map(r => r.rating).filter(r => r !== null);

          await client.query(`
            INSERT INTO conflict_analysis (
              submission_id, submission_number, institution_name,
              author_ids, reviewer_ids, reviewer_ratings
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING
          `, [
            conflict.submission_id,
            conflict.submission_number,
            institutionConflict.institution,
            authorIds,
            reviewerIds,
            reviewerRatings
          ]);
        }
      }
      console.log(`✅ Imported conflict analysis data`);
    }

    // 7. Create summary statistics
    console.log('📊 Creating summary statistics...');
    
    // Country statistics
    const countryStats = await client.query(`
      SELECT nationality as country, COUNT(*) as count
      FROM people 
      WHERE nationality IS NOT NULL 
      GROUP BY nationality 
      ORDER BY count DESC
    `);
    
    await client.query(`
      INSERT INTO review_statistics (stat_type, stat_key, stat_data)
      VALUES ('country_distribution', 'all', $1)
      ON CONFLICT DO NOTHING
    `, [JSON.stringify(countryStats.rows)]);

    // Institution statistics
    const institutionStats = await client.query(`
      SELECT country, COUNT(*) as institution_count, SUM(total_members) as total_members
      FROM institutions 
      WHERE country IS NOT NULL 
      GROUP BY country 
      ORDER BY total_members DESC
    `);
    
    await client.query(`
      INSERT INTO review_statistics (stat_type, stat_key, stat_data)
      VALUES ('institution_by_country', 'all', $1)
      ON CONFLICT DO NOTHING
    `, [JSON.stringify(institutionStats.rows)]);

    console.log('✅ JSON data imported successfully!');

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Starting JSON to Database migration...\n');
    
    await createTables();
    console.log('');
    await importJSONData();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Database Summary:');
    
    const client = await pool.connect();
    try {
      const tables = await client.query(`
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      for (const table of tables.rows) {
        const count = await client.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`  📋 ${table.table_name}: ${count.rows[0].count} records (${table.column_count} columns)`);
      }
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { createTables, importJSONData };