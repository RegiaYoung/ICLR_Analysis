const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 5, // Limit concurrent connections
});

// Batch insert helper
async function batchInsert(client, query, data, batchSize = 1000) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const values = [];
    const placeholders = [];
    
    batch.forEach((row, index) => {
      const startIndex = index * row.length;
      const rowPlaceholders = row.map((_, colIndex) => `$${startIndex + colIndex + 1}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      values.push(...row);
    });
    
    const finalQuery = query + placeholders.join(', ');
    await client.query(finalQuery, values);
    
    console.log(`  Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} (${i + batch.length}/${data.length} records)`);
  }
}

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Creating database tables...');

    // Drop existing tables to start fresh
    await client.query('DROP TABLE IF EXISTS conflict_analysis, top_lists, institution_rankings, institutions, people, reviews_summary, review_statistics CASCADE;');

    // 1. Reviews table - stores review summary data
    await client.query(`
      CREATE TABLE reviews_summary (
        id SERIAL PRIMARY KEY,
        total_submissions INTEGER NOT NULL,
        total_reviews INTEGER NOT NULL,
        reviews_per_submission JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. People table - stores reviewer and author information
    await client.query(`
      CREATE TABLE people (
        id SERIAL PRIMARY KEY,
        person_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        nationality VARCHAR(100),
        role VARCHAR(50),
        institution VARCHAR(500),
        institution_type VARCHAR(100),
        country VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Institutions table - stores institution information  
    await client.query(`
      CREATE TABLE institutions (
        id SERIAL PRIMARY KEY,
        institution_name VARCHAR(500) UNIQUE NOT NULL,
        type VARCHAR(50),
        total_members INTEGER DEFAULT 0,
        author_count INTEGER DEFAULT 0,
        reviewer_count INTEGER DEFAULT 0,
        country VARCHAR(100),
        institution_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Institution Rankings table
    await client.query(`
      CREATE TABLE institution_rankings (
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

    // 5. Top Lists table
    await client.query(`
      CREATE TABLE top_lists (
        id SERIAL PRIMARY KEY,
        list_type VARCHAR(100) NOT NULL,
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
        profile_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Conflict Analysis table
    await client.query(`
      CREATE TABLE conflict_analysis (
        id SERIAL PRIMARY KEY,
        submission_id VARCHAR(255) NOT NULL,
        submission_number INTEGER NOT NULL,
        institution_name VARCHAR(500) NOT NULL,
        author_ids TEXT[],
        reviewer_ids TEXT[],
        reviewer_ratings INTEGER[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Review Statistics table
    await client.query(`
      CREATE TABLE review_statistics (
        id SERIAL PRIMARY KEY,
        stat_type VARCHAR(100) NOT NULL,
        stat_key VARCHAR(255),
        stat_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_people_person_id ON people(person_id);',
      'CREATE INDEX IF NOT EXISTS idx_people_nationality ON people(nationality);',
      'CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(institution_name);',
      'CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(country);',
      'CREATE INDEX IF NOT EXISTS idx_top_lists_type ON top_lists(list_type);',
      'CREATE INDEX IF NOT EXISTS idx_top_lists_reviewer ON top_lists(reviewer_id);',
      'CREATE INDEX IF NOT EXISTS idx_conflict_submission ON conflict_analysis(submission_number);',
      'CREATE INDEX IF NOT EXISTS idx_review_stats_type ON review_statistics(stat_type);'
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }

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
    `, [
      reviewsData.summary.total_submissions,
      reviewsData.summary.total_reviews,
      JSON.stringify(reviewsData.summary.reviews_per_submission)
    ]);

    // 2. Import people data (optimized with batch insert)
    console.log('👥 Importing people data...');
    const peopleData = JSON.parse(fs.readFileSync(peoplePath, 'utf8'));
    const peopleRows = [];
    
    for (const [personId, personInfo] of Object.entries(peopleData.people)) {
      peopleRows.push([
        personId,
        personInfo.name || null,
        personInfo.nationality || null,
        personInfo.role || null,
        personInfo.institution || null,
        personInfo.institution_type || null,
        personInfo.nationality || null
      ]);
    }

    await batchInsert(
      client,
      `INSERT INTO people (person_id, name, nationality, role, institution, institution_type, country) VALUES `,
      peopleRows,
      5000
    );
    console.log(`✅ Imported ${peopleRows.length} people records`);

    // 3. Import institutions data
    console.log('🏛️ Importing institutions data...');
    const institutionsData = JSON.parse(fs.readFileSync(institutionsPath, 'utf8'));
    const institutionRows = [];

    for (const institution of institutionsData.institutions) {
      institutionRows.push([
        institution.institution_name,
        institution.type || null,
        institution.total_members || 0,
        institution.author_count || 0,
        institution.reviewer_count || 0,
        institution.country || null,
        institution.institution_type || null
      ]);
    }

    await batchInsert(
      client,
      `INSERT INTO institutions (institution_name, type, total_members, author_count, reviewer_count, country, institution_type) VALUES `,
      institutionRows,
      1000
    );
    console.log(`✅ Imported ${institutionRows.length} institution records`);

    // 4. Import top lists (reviewers data)
    console.log('🔝 Importing top lists...');
    if (fs.existsSync(topListsPath)) {
      const topListsData = JSON.parse(fs.readFileSync(topListsPath, 'utf8'));
      const topListRows = [];
      
      for (const [listType, reviewers] of Object.entries(topListsData)) {
        if (Array.isArray(reviewers)) {
          console.log(`  Processing ${listType} (${reviewers.length} records)...`);
          for (const reviewer of reviewers) {
            topListRows.push([
              listType,
              reviewer.reviewer_id,
              Math.floor(reviewer.reviews || 0), // Convert to integer
              reviewer.avg_rating || null,
              reviewer.median_rating || null,
              Math.floor(reviewer.min_rating || 0), // Convert to integer
              Math.floor(reviewer.max_rating || 0), // Convert to integer
              reviewer.rating_std || null,
              reviewer.avg_confidence || null,
              Math.floor(reviewer.avg_text_words || 0), // Convert to integer
              Math.floor(reviewer.avg_questions_words || 0), // Convert to integer
              Math.floor(reviewer.ethics_flags || 0), // Convert to integer
              reviewer.avg_sub_scores?.soundness || null,
              reviewer.avg_sub_scores?.presentation || null,
              reviewer.avg_sub_scores?.contribution || null,
              reviewer.profile_url || null
            ]);
          }
        }
      }

      if (topListRows.length > 0) {
        await batchInsert(
          client,
          `INSERT INTO top_lists (
            list_type, reviewer_id, reviews, avg_rating, median_rating,
            min_rating, max_rating, rating_std, avg_confidence,
            avg_text_words, avg_questions_words, ethics_flags,
            soundness_score, presentation_score, contribution_score, profile_url
          ) VALUES `,
          topListRows,
          2000
        );
      }
      console.log(`✅ Imported ${topListRows.length} top list records`);
    }

    // 5. Import institution rankings
    console.log('📈 Importing institution rankings...');
    if (fs.existsSync(institutionRankingsPath)) {
      const rankingsData = JSON.parse(fs.readFileSync(institutionRankingsPath, 'utf8'));
      const rankingRows = [];

      for (const institution of rankingsData.most_active_institutions || []) {
        rankingRows.push([
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

      if (rankingRows.length > 0) {
        await batchInsert(
          client,
          `INSERT INTO institution_rankings (
            institution_name, unique_submissions_involved, submissions_as_author_count,
            submissions_as_reviewer_count, avg_rating_given, min_rating_given,
            max_rating_given, avg_confidence, country, institution_type
          ) VALUES `,
          rankingRows,
          1000
        );
      }
      console.log(`✅ Imported ${rankingRows.length} institution ranking records`);
    }

    // 6. Import conflict analysis
    console.log('⚠️ Importing conflict analysis...');
    if (fs.existsSync(conflictsPath)) {
      const conflictsData = JSON.parse(fs.readFileSync(conflictsPath, 'utf8'));
      const conflictRows = [];
      
      for (const conflict of conflictsData.conflict_details || []) {
        for (const institutionConflict of conflict.conflicts) {
          const authorIds = institutionConflict.authors.map(a => a.id);
          const reviewerIds = institutionConflict.reviewers.map(r => r.id);
          const reviewerRatings = institutionConflict.reviewers.map(r => r.rating).filter(r => r !== null);

          conflictRows.push([
            conflict.submission_id,
            conflict.submission_number,
            institutionConflict.institution,
            authorIds,
            reviewerIds,
            reviewerRatings
          ]);
        }
      }

      if (conflictRows.length > 0) {
        await batchInsert(
          client,
          `INSERT INTO conflict_analysis (
            submission_id, submission_number, institution_name,
            author_ids, reviewer_ids, reviewer_ratings
          ) VALUES `,
          conflictRows,
          1000
        );
      }
      console.log(`✅ Imported ${conflictRows.length} conflict analysis records`);
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
    console.log('🚀 Starting optimized JSON to Database migration...\n');
    
    await createTables();
    console.log('');
    await importJSONData();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Database Summary:');
    
    const client = await pool.connect();
    try {
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables t
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      for (const table of tables.rows) {
        const count = await client.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`  📋 ${table.table_name}: ${count.rows[0].count} records`);
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