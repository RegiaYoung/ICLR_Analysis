const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 3,
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

    // Drop existing tables
    await client.query('DROP TABLE IF EXISTS submissions, conflict_analysis, reviewers, institutions, people, reviews_summary, review_statistics CASCADE;');

    // 1. Reviews summary
    await client.query(`
      CREATE TABLE reviews_summary (
        id SERIAL PRIMARY KEY,
        total_submissions INTEGER NOT NULL,
        total_reviews INTEGER NOT NULL,
        reviews_per_submission JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. People table
    await client.query(`
      CREATE TABLE people (
        id SERIAL PRIMARY KEY,
        person_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        nationality VARCHAR(100),
        role VARCHAR(50),
        institution VARCHAR(500),
        institution_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Institutions table
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
        submissions_involved INTEGER DEFAULT 0,
        submissions_as_author INTEGER DEFAULT 0,
        submissions_as_reviewer INTEGER DEFAULT 0,
        avg_rating_given DECIMAL(4,2),
        avg_confidence DECIMAL(4,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Reviewers table (from top_lists data)
    await client.query(`
      CREATE TABLE reviewers (
        id SERIAL PRIMARY KEY,
        reviewer_id VARCHAR(255) NOT NULL,
        list_type VARCHAR(100) NOT NULL,
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
        profile_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Submissions table (for disputed/consensus submissions)
    await client.query(`
      CREATE TABLE submissions (
        id SERIAL PRIMARY KEY,
        submission_id VARCHAR(255),
        submission_number INTEGER,
        submission_type VARCHAR(100), -- 'disputed', 'consensus', 'ethics_flagged'
        review_count INTEGER DEFAULT 0,
        avg_rating DECIMAL(4,2),
        rating_std DECIMAL(4,2),
        rating_range DECIMAL(4,2),
        avg_confidence DECIMAL(4,2),
        ethics_flags INTEGER DEFAULT 0,
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
        author_count INTEGER DEFAULT 0,
        reviewer_count INTEGER DEFAULT 0,
        avg_rating DECIMAL(4,2),
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_people_person_id ON people(person_id);',
      'CREATE INDEX IF NOT EXISTS idx_people_nationality ON people(nationality);',
      'CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(institution_name);',
      'CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(country);',
      'CREATE INDEX IF NOT EXISTS idx_reviewers_id ON reviewers(reviewer_id);',
      'CREATE INDEX IF NOT EXISTS idx_reviewers_type ON reviewers(list_type);',
      'CREATE INDEX IF NOT EXISTS idx_submissions_number ON submissions(submission_number);',
      'CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);',
      'CREATE INDEX IF NOT EXISTS idx_conflict_submission ON conflict_analysis(submission_number);'
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

async function importData() {
  const client = await pool.connect();
  try {
    console.log('📥 Importing JSON data...');

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

    // 2. Import people data
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
        personInfo.institution_type || null
      ]);
    }

    await batchInsert(
      client,
      `INSERT INTO people (person_id, name, nationality, role, institution, institution_type) VALUES `,
      peopleRows,
      5000
    );
    console.log(`✅ Imported ${peopleRows.length} people records`);

    // 3. Import institutions data
    console.log('🏛️ Importing institutions data...');
    const institutionsData = JSON.parse(fs.readFileSync(institutionsPath, 'utf8'));
    
    // Create a map to merge with rankings data
    const institutionMap = {};
    for (const institution of institutionsData.institutions) {
      institutionMap[institution.institution_name] = {
        ...institution
      };
    }

    // Merge with rankings data if available
    if (fs.existsSync(institutionRankingsPath)) {
      const rankingsData = JSON.parse(fs.readFileSync(institutionRankingsPath, 'utf8'));
      for (const ranking of rankingsData.most_active_institutions || []) {
        if (institutionMap[ranking.institution_name]) {
          institutionMap[ranking.institution_name] = {
            ...institutionMap[ranking.institution_name],
            submissions_involved: ranking.stats?.unique_submissions_involved || 0,
            submissions_as_author: ranking.stats?.submissions_as_author_count || 0,
            submissions_as_reviewer: ranking.stats?.submissions_as_reviewer_count || 0,
            avg_rating_given: ranking.stats?.avg_rating_given || null,
            avg_confidence: ranking.stats?.avg_confidence || null
          };
        }
      }
    }

    const institutionRows = [];
    for (const [name, institution] of Object.entries(institutionMap)) {
      institutionRows.push([
        institution.institution_name,
        institution.type || null,
        institution.total_members || 0,
        institution.author_count || 0,
        institution.reviewer_count || 0,
        institution.country || null,
        institution.institution_type || null,
        institution.submissions_involved || 0,
        institution.submissions_as_author || 0,
        institution.submissions_as_reviewer || 0,
        institution.avg_rating_given || null,
        institution.avg_confidence || null
      ]);
    }

    await batchInsert(
      client,
      `INSERT INTO institutions (
        institution_name, type, total_members, author_count, reviewer_count,
        country, institution_type, submissions_involved, submissions_as_author,
        submissions_as_reviewer, avg_rating_given, avg_confidence
      ) VALUES `,
      institutionRows,
      1000
    );
    console.log(`✅ Imported ${institutionRows.length} institution records`);

    // 4. Import reviewers and submissions from top_lists
    console.log('🔝 Importing top lists...');
    if (fs.existsSync(topListsPath)) {
      const topListsData = JSON.parse(fs.readFileSync(topListsPath, 'utf8'));
      const reviewerRows = [];
      const submissionRows = [];
      
      for (const [listType, items] of Object.entries(topListsData)) {
        if (Array.isArray(items) && items.length > 0) {
          console.log(`  Processing ${listType} (${items.length} records)...`);
          
          if (items[0].reviewer_id) {
            // This is reviewer data
            for (const reviewer of items) {
              reviewerRows.push([
                reviewer.reviewer_id,
                listType,
                Math.floor(reviewer.reviews || 0),
                reviewer.avg_rating || null,
                reviewer.median_rating || null,
                Math.floor(reviewer.min_rating || 0),
                Math.floor(reviewer.max_rating || 0),
                reviewer.rating_std || null,
                reviewer.avg_confidence || null,
                Math.floor(reviewer.avg_text_words || 0),
                Math.floor(reviewer.avg_questions_words || 0),
                Math.floor(reviewer.ethics_flags || 0),
                reviewer.profile_url || null
              ]);
            }
          } else if (items[0].submission_id || items[0].submission_number) {
            // This is submission data
            for (const submission of items) {
              submissionRows.push([
                submission.submission_id || null,
                submission.submission_number || null,
                listType,
                Math.floor(submission.review_count || 0),
                submission.avg_rating || null,
                submission.rating_std || null,
                submission.rating_range || null,
                submission.avg_confidence || null,
                Math.floor(submission.ethics_flags || 0)
              ]);
            }
          } else if (items[0].author_id) {
            // This is author data - we'll store in review_statistics as JSON
            await client.query(`
              INSERT INTO review_statistics (stat_type, stat_key, stat_data)
              VALUES ($1, $2, $3)
            `, [listType, 'all', JSON.stringify(items)]);
          }
        }
      }

      // Insert reviewers
      if (reviewerRows.length > 0) {
        await batchInsert(
          client,
          `INSERT INTO reviewers (
            reviewer_id, list_type, reviews, avg_rating, median_rating,
            min_rating, max_rating, rating_std, avg_confidence,
            avg_text_words, avg_questions_words, ethics_flags, profile_url
          ) VALUES `,
          reviewerRows,
          2000
        );
        console.log(`✅ Imported ${reviewerRows.length} reviewer records`);
      }

      // Insert submissions
      if (submissionRows.length > 0) {
        await batchInsert(
          client,
          `INSERT INTO submissions (
            submission_id, submission_number, submission_type, review_count,
            avg_rating, rating_std, rating_range, avg_confidence, ethics_flags
          ) VALUES `,
          submissionRows,
          1000
        );
        console.log(`✅ Imported ${submissionRows.length} submission records`);
      }
    }

    // 5. Import conflict analysis
    console.log('⚠️ Importing conflict analysis...');
    if (fs.existsSync(conflictsPath)) {
      const conflictsData = JSON.parse(fs.readFileSync(conflictsPath, 'utf8'));
      const conflictRows = [];
      
      for (const conflict of conflictsData.conflict_details || []) {
        for (const institutionConflict of conflict.conflicts) {
          const avgRating = institutionConflict.reviewers?.length > 0 ?
            institutionConflict.reviewers.reduce((sum, r) => sum + (r.rating || 0), 0) / institutionConflict.reviewers.length : null;

          conflictRows.push([
            conflict.submission_id,
            conflict.submission_number,
            institutionConflict.institution,
            institutionConflict.authors?.length || 0,
            institutionConflict.reviewers?.length || 0,
            avgRating
          ]);
        }
      }

      if (conflictRows.length > 0) {
        await batchInsert(
          client,
          `INSERT INTO conflict_analysis (
            submission_id, submission_number, institution_name,
            author_count, reviewer_count, avg_rating
          ) VALUES `,
          conflictRows,
          1000
        );
        console.log(`✅ Imported ${conflictRows.length} conflict records`);
      }
    }

    // 6. Create summary statistics
    console.log('📊 Creating summary statistics...');
    
    // Country statistics
    const countryStats = await client.query(`
      SELECT nationality, COUNT(*) as people_count
      FROM people 
      WHERE nationality IS NOT NULL 
      GROUP BY nationality 
      ORDER BY people_count DESC
    `);
    
    await client.query(`
      INSERT INTO review_statistics (stat_type, stat_key, stat_data)
      VALUES ($1, $2, $3)
    `, ['country_distribution', 'people', JSON.stringify(countryStats.rows)]);

    // Institution statistics by country
    const institutionStats = await client.query(`
      SELECT country, COUNT(*) as institution_count, SUM(total_members) as total_members,
             AVG(avg_rating_given) as avg_rating, SUM(submissions_as_reviewer) as total_reviews
      FROM institutions 
      WHERE country IS NOT NULL 
      GROUP BY country 
      ORDER BY total_members DESC NULLS LAST
    `);
    
    await client.query(`
      INSERT INTO review_statistics (stat_type, stat_key, stat_data)
      VALUES ($1, $2, $3)
    `, ['institution_by_country', 'summary', JSON.stringify(institutionStats.rows)]);

    console.log('✅ Data import completed successfully!');

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Starting final JSON to Database migration...\n');
    
    await createTables();
    console.log('');
    await importData();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Database Summary:');
    
    const client = await pool.connect();
    try {
      const tables = ['reviews_summary', 'people', 'institutions', 'reviewers', 'submissions', 'conflict_analysis', 'review_statistics'];
      
      for (const tableName of tables) {
        try {
          const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
          console.log(`  📋 ${tableName}: ${count.rows[0].count} records`);
        } catch (err) {
          console.log(`  📋 ${tableName}: table not found`);
        }
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

module.exports = { createTables, importData };