const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

async function createSubmissionReviewsTable() {
  let client;
  try {
    client = await pool.connect();
    
    // Create submission_reviews table
    console.log('Creating submission_reviews table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_reviews (
        id SERIAL PRIMARY KEY,
        submission_number INTEGER NOT NULL,
        submission_id VARCHAR(255),
        reviewer_id VARCHAR(255) NOT NULL,
        reviewer_profile_url VARCHAR(255),
        review_id VARCHAR(255),
        signature VARCHAR(255),
        rating INTEGER,
        confidence INTEGER,
        review_summary TEXT,
        review_strengths TEXT,
        review_weaknesses TEXT,
        review_questions TEXT,
        soundness INTEGER,
        presentation INTEGER,
        contribution INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission_number 
      ON submission_reviews (submission_number)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_submission_reviews_reviewer_id 
      ON submission_reviews (reviewer_id)
    `);

    console.log('Table and indexes created successfully!');

    // Load and process reviews data
    console.log('Loading reviews.json...');
    const reviewsData = JSON.parse(fs.readFileSync('./review-data/reviews.json', 'utf8'));
    
    console.log('Processing reviews data...');
    const reviewsToInsert = [];
    
    // Process each submission
    Object.values(reviewsData.reviews).forEach(submission => {
      const submissionNumber = submission.submission_number;
      const submissionId = `ICLR.cc/2026/Conference/Submission${submissionNumber}`;
      
      submission.reviews.forEach(review => {
        // Skip reviews without reviewer_id
        if (!review.reviewer_id) {
          console.log(`Skipping review without reviewer_id for submission ${submissionNumber}`);
          return;
        }
        
        reviewsToInsert.push({
          submission_number: submissionNumber,
          submission_id: submissionId,
          reviewer_id: review.reviewer_id,
          reviewer_profile_url: review.reviewer_profile_url,
          review_id: review.review_id,
          signature: review.signature,
          rating: review.rating || null,
          confidence: review.confidence || null,
          review_summary: review.content?.summary || null,
          review_strengths: review.content?.strengths || null,
          review_weaknesses: review.content?.weaknesses || null,
          review_questions: review.content?.questions || null,
          soundness: review.content?.soundness || null,
          presentation: review.content?.presentation || null,
          contribution: review.content?.contribution || null
        });
      });
    });

    console.log(`Processing ${reviewsToInsert.length} reviews...`);

    // Batch insert reviews
    const batchSize = 1000;
    for (let i = 0; i < reviewsToInsert.length; i += batchSize) {
      const batch = reviewsToInsert.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reviewsToInsert.length / batchSize)}`);
      
      const query = `
        INSERT INTO submission_reviews (
          submission_number, submission_id, reviewer_id, reviewer_profile_url,
          review_id, signature, rating, confidence, review_summary,
          review_strengths, review_weaknesses, review_questions,
          soundness, presentation, contribution
        ) VALUES ${batch.map((_, index) => 
          `($${index * 15 + 1}, $${index * 15 + 2}, $${index * 15 + 3}, $${index * 15 + 4}, 
           $${index * 15 + 5}, $${index * 15 + 6}, $${index * 15 + 7}, $${index * 15 + 8}, 
           $${index * 15 + 9}, $${index * 15 + 10}, $${index * 15 + 11}, $${index * 15 + 12}, 
           $${index * 15 + 13}, $${index * 15 + 14}, $${index * 15 + 15})`
        ).join(', ')}
      `;

      const values = batch.flatMap(review => [
        review.submission_number, review.submission_id, review.reviewer_id, 
        review.reviewer_profile_url, review.review_id, review.signature,
        review.rating, review.confidence, review.review_summary,
        review.review_strengths, review.review_weaknesses, review.review_questions,
        review.soundness, review.presentation, review.contribution
      ]);

      await client.query(query, values);
    }

    console.log('Reviews data inserted successfully!');
    
    // Get some stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_reviews,
        COUNT(DISTINCT submission_number) as unique_submissions,
        COUNT(DISTINCT reviewer_id) as unique_reviewers
      FROM submission_reviews
    `);
    
    console.log('Final statistics:', stats.rows[0]);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) client.release();
    pool.end();
  }
}

createSubmissionReviewsTable().catch(console.error);