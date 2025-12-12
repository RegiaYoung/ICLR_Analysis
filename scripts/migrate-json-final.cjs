const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 3,
});

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
    console.log(`  Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)}`);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Database Migration for Search API...');

    // 1. Drop old tables & Create new ones matching Search API requirements
    console.log('🏗️  Creating tables...');
    await client.query(`
      DROP TABLE IF EXISTS review_details, submission_statistics, submission_authors, people, reviewers CASCADE;

      -- People Table (Authors & Reviewers)
      CREATE TABLE people (
        id SERIAL PRIMARY KEY,
        person_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        nationality VARCHAR(100),
        institution VARCHAR(500),
        gender VARCHAR(50),
        role VARCHAR(100)
      );

      -- Submission Statistics (Meta info)
      CREATE TABLE submission_statistics (
        submission_number INTEGER PRIMARY KEY,
        submission_id VARCHAR(255),
        review_count INTEGER,
        avg_rating DECIMAL(4,2),
        rating_std DECIMAL(4,2),
        avg_confidence DECIMAL(4,2),
        ethics_flag INTEGER
      );

      -- Review Details (Detailed content for search)
      CREATE TABLE review_details (
        id SERIAL PRIMARY KEY,
        submission_number INTEGER,
        review_id VARCHAR(255),
        reviewer_id VARCHAR(255),
        reviewer_profile_url VARCHAR(500),
        rating INTEGER,
        confidence INTEGER,
        summary TEXT,
        strengths TEXT,
        weaknesses TEXT,
        questions TEXT,
        soundness INTEGER,
        presentation INTEGER,
        contribution INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Submission Authors (Linking table)
      CREATE TABLE submission_authors (
        id SERIAL PRIMARY KEY,
        submission_number INTEGER,
        author_id VARCHAR(255)
      );

      -- Reviewers Stats (Used for aggregation in search results)
      CREATE TABLE reviewers (
        reviewer_id VARCHAR(255) PRIMARY KEY,
        reviews INTEGER DEFAULT 0,
        avg_rating DECIMAL(4,2),
        avg_confidence DECIMAL(4,2)
      );

      CREATE INDEX idx_review_details_sub_num ON review_details(submission_number);
      CREATE INDEX idx_submission_authors_sub_num ON submission_authors(submission_number);
      CREATE INDEX idx_people_person_id ON people(person_id);
    `);

    // 2. Import People
    console.log('👥 Importing People...');
    const peopleData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'review-data', 'people.json'), 'utf8'));
    
    // Fix: Ensure we get ID from key
    const peopleRows = Object.entries(peopleData.people).map(([id, p]) => [
      id,
      p.name,
      p.nationality,
      p.institution,
      p.gender || 'Unknown',
      p.role
    ]);

    await batchInsert(client, 
      `INSERT INTO people (person_id, name, nationality, institution, gender, role) VALUES `, 
      peopleRows, 3000
    );

    // 3. Import Reviews & Submissions
    console.log('📝 Importing Reviews & Submissions...');
    const reviewsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'review-data', 'reviews.json'), 'utf8'));
    
    const subStatsRows = [];
    const reviewRows = [];
    const authorRows = [];
    const reviewerStatsMap = {};

    Object.values(reviewsData.reviews).forEach(sub => {
      // Submission Stats
      const ratings = sub.reviews.map(r => r.rating || 0).filter(r => r > 0);
      const confidences = sub.reviews.map(r => r.confidence || 0).filter(r => r > 0);
      
      const avgRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
      const avgConf = confidences.length ? confidences.reduce((a,b)=>a+b,0)/confidences.length : 0;
      
      // Standard Deviation
      const ratingStd = ratings.length ? Math.sqrt(ratings.map(r => Math.pow(r-avgRating, 2)).reduce((a,b)=>a+b,0)/ratings.length) : 0;
      
      // === FIX: Robust Ethics Flag Check ===
      const ethicsFlag = sub.reviews.some(r => {
        let flag = r.content?.flag_for_ethics_review;
        if (!flag) return false;
        
        // Handle array (OpenReview often returns lists like ["No ethics review needed."])
        if (Array.isArray(flag)) {
            flag = flag.join(' ');
        }
        
        // Convert to string safely and check
        return String(flag).toLowerCase().includes('yes');
      }) ? 1 : 0;

      subStatsRows.push([
        sub.submission_number,
        sub.submission_id,
        sub.reviews.length,
        avgRating,
        ratingStd,
        avgConf,
        ethicsFlag
      ]);

      // Authors
      sub.authors.forEach(aid => {
        authorRows.push([sub.submission_number, aid]);
      });

      // Reviews
      sub.reviews.forEach(r => {
        const rid = r.reviewer_id || 'anonymous';
        reviewRows.push([
          sub.submission_number,
          r.review_id,
          rid,
          r.reviewer_profile_url,
          r.rating || null,
          r.confidence || null,
          r.content?.summary || '',
          r.content?.strengths || '',
          r.content?.weaknesses || '',
          r.content?.questions || '',
          r.content?.soundness || null,
          r.content?.presentation || null,
          r.content?.contribution || null
        ]);

        // Reviewer Stats Accumulation
        if (!reviewerStatsMap[rid]) reviewerStatsMap[rid] = { count: 0, sumRating: 0, sumConf: 0 };
        reviewerStatsMap[rid].count++;
        reviewerStatsMap[rid].sumRating += (r.rating || 0);
        reviewerStatsMap[rid].sumConf += (r.confidence || 0);
      });
    });

    // Execute Inserts
    if (subStatsRows.length > 0) {
      console.log('  Inserting submission statistics...');
      await batchInsert(client, 
        `INSERT INTO submission_statistics (submission_number, submission_id, review_count, avg_rating, rating_std, avg_confidence, ethics_flag) VALUES `, 
        subStatsRows, 2000
      );
    }

    if (authorRows.length > 0) {
      console.log('  Inserting authors...');
      await batchInsert(client, 
        `INSERT INTO submission_authors (submission_number, author_id) VALUES `, 
        authorRows, 3000
      );
    }

    if (reviewRows.length > 0) {
      console.log('  Inserting reviews...');
      await batchInsert(client, 
        `INSERT INTO review_details (submission_number, review_id, reviewer_id, reviewer_profile_url, rating, confidence, summary, strengths, weaknesses, questions, soundness, presentation, contribution) VALUES `, 
        reviewRows, 1000
      );
    }

    // 4. Import Reviewer Stats
    console.log('📊 Importing Reviewer Stats...');
    const reviewerStatsRows = Object.entries(reviewerStatsMap).map(([rid, stats]) => [
      rid,
      stats.count,
      stats.count ? stats.sumRating / stats.count : 0,
      stats.count ? stats.sumConf / stats.count : 0
    ]);

    await batchInsert(client, 
      `INSERT INTO reviewers (reviewer_id, reviews, avg_rating, avg_confidence) VALUES `, 
      reviewerStatsRows, 3000
    );

    console.log('🎉 Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration Failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();