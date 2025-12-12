const fs = require('fs');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 30000,
  max: 10,
});

// Batch size for bulk inserts
const BATCH_SIZE = 1000;

async function loadJSONData() {
  console.log('Loading JSON data files...');
  
  const peopleData = JSON.parse(fs.readFileSync('./tmp/people.json', 'utf8'));
  const reviewsData = JSON.parse(fs.readFileSync('./tmp/reviews.json', 'utf8'));
  
  console.log(`Loaded ${peopleData.metadata.total_people} people`);
  console.log(`Loaded ${reviewsData.summary.total_submissions} submissions with ${reviewsData.summary.total_reviews} reviews`);
  
  return { peopleData, reviewsData };
}

async function createTables(client) {
  console.log('Creating missing tables...');
  
  const createTablesSQL = fs.readFileSync('./scripts/create-missing-tables.sql', 'utf8');
  await client.query(createTablesSQL);
  
  console.log('Tables created successfully');
}

async function importSubmissionAuthors(client, peopleData) {
  console.log('Importing submission authors...');
  
  const authorData = [];
  
  // Extract author-paper relationships from people.json
  Object.entries(peopleData.people).forEach(([personId, personData]) => {
    if (personData.authored_papers && personData.authored_papers.length > 0) {
      personData.authored_papers.forEach(submissionNumber => {
        authorData.push([submissionNumber, personId]);
      });
    }
  });
  
  console.log(`Found ${authorData.length} author-paper relationships`);
  
  // Batch insert
  const batches = [];
  for (let i = 0; i < authorData.length; i += BATCH_SIZE) {
    batches.push(authorData.slice(i, i + BATCH_SIZE));
  }
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const values = batch.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
    const flatValues = batch.flat();
    
    const query = `
      INSERT INTO submission_authors (submission_number, author_id)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `;
    
    await client.query(query, flatValues);
    
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`Processed ${Math.min((i + 1) * BATCH_SIZE, authorData.length)}/${authorData.length} author records`);
    }
  }
  
  console.log('Submission authors import completed');
}

async function importSubmissionReviews(client, peopleData) {
  console.log('Importing submission reviews...');
  
  const reviewData = [];
  
  // Extract reviewer-paper relationships from people.json
  Object.entries(peopleData.people).forEach(([personId, personData]) => {
    if (personData.reviewed_papers && personData.reviewed_papers.length > 0) {
      personData.reviewed_papers.forEach(submissionNumber => {
        reviewData.push([submissionNumber, personId]);
      });
    }
  });
  
  console.log(`Found ${reviewData.length} review-paper relationships`);
  
  // Batch insert
  const batches = [];
  for (let i = 0; i < reviewData.length; i += BATCH_SIZE) {
    batches.push(reviewData.slice(i, i + BATCH_SIZE));
  }
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const values = batch.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
    const flatValues = batch.flat();
    
    const query = `
      INSERT INTO submission_reviews (submission_number, reviewer_id)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `;
    
    await client.query(query, flatValues);
    
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`Processed ${Math.min((i + 1) * BATCH_SIZE, reviewData.length)}/${reviewData.length} review records`);
    }
  }
  
  console.log('Submission reviews import completed');
}

async function importReviewDetails(client, reviewsData) {
  console.log('Importing detailed review data...');
  
  const detailsData = [];
  
  // Extract detailed review data from reviews.json
  let skippedCount = 0;
  Object.entries(reviewsData.reviews).forEach(([submissionNumber, submissionData]) => {
    if (submissionData.reviews && Array.isArray(submissionData.reviews)) {
      submissionData.reviews.forEach(review => {
        // Include reviews with null reviewer_id but use a placeholder
        let reviewerId = review.reviewer_id;
        if (!reviewerId) {
          // Generate a placeholder ID based on signature or review_id
          if (review.signature && review.signature.includes('Reviewer_')) {
            const reviewerCode = review.signature.split('Reviewer_')[1];
            reviewerId = `anonymous_reviewer_${reviewerCode}`;
          } else {
            reviewerId = `anonymous_reviewer_${review.review_id}`;
          }
          skippedCount++; // Count for reporting, but still include the review
        }
        
        detailsData.push([
          review.review_id,
          parseInt(submissionNumber),
          reviewerId,
          review.reviewer_profile_url || null,
          review.signature || null,
          review.rating || null,
          review.confidence || null,
          review.content?.summary || null,
          review.content?.strengths || null,
          review.content?.weaknesses || null,
          review.content?.questions || null,
          review.content?.soundness || null,
          review.content?.presentation || null,
          review.content?.contribution || null,
          review.content?.flag_for_ethics_review ? JSON.stringify(review.content.flag_for_ethics_review) : null,
          review.content?.code_of_conduct || null
        ]);
      });
    }
  });
  
  console.log(`Found ${skippedCount} reviews with null reviewer_id, converted to anonymous placeholders (${(skippedCount/reviewsData.summary.total_reviews*100).toFixed(1)}% of total)`);
  
  console.log(`Found ${detailsData.length} detailed review records`);
  
  // Batch insert
  const batches = [];
  for (let i = 0; i < detailsData.length; i += BATCH_SIZE) {
    batches.push(detailsData.slice(i, i + BATCH_SIZE));
  }
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const values = batch.map((_, index) => {
      const baseIndex = index * 16;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16})`;
    }).join(', ');
    const flatValues = batch.flat();
    
    const query = `
      INSERT INTO review_details (
        review_id, submission_number, reviewer_id, reviewer_profile_url, signature,
        rating, confidence, summary, strengths, weaknesses, questions,
        soundness, presentation, contribution, flag_for_ethics_review, code_of_conduct
      )
      VALUES ${values}
      ON CONFLICT (review_id) DO NOTHING
    `;
    
    await client.query(query, flatValues);
    
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`Processed ${Math.min((i + 1) * BATCH_SIZE, detailsData.length)}/${detailsData.length} review detail records`);
    }
  }
  
  console.log('Review details import completed');
}

async function updateSubmissionReviewsWithDetails(client) {
  console.log('Updating submission_reviews with rating and confidence from review_details...');
  
  const query = `
    UPDATE submission_reviews sr
    SET 
      review_id = rd.review_id,
      rating = rd.rating,
      confidence = rd.confidence
    FROM review_details rd
    WHERE sr.submission_number = rd.submission_number 
    AND sr.reviewer_id = rd.reviewer_id
    AND sr.review_id IS NULL
  `;
  
  const result = await client.query(query);
  console.log(`Updated ${result.rowCount} submission_reviews records with detail data`);
}

async function printSummaryStats(client) {
  console.log('\n=== Import Summary ===');
  
  const queries = [
    ['submission_authors', 'SELECT COUNT(*) FROM submission_authors'],
    ['submission_reviews', 'SELECT COUNT(*) FROM submission_reviews'],
    ['review_details', 'SELECT COUNT(*) FROM review_details'],
  ];
  
  for (const [tableName, query] of queries) {
    const result = await client.query(query);
    console.log(`${tableName}: ${result.rows[0].count} records`);
  }
  
  // Test queries
  console.log('\n=== Test Queries ===');
  
  // Test: Find reviewers for submission 1
  const submission1Reviews = await client.query(`
    SELECT sr.reviewer_id, p.name, rd.rating, rd.confidence
    FROM submission_reviews sr
    LEFT JOIN people p ON sr.reviewer_id = p.person_id
    LEFT JOIN review_details rd ON sr.submission_number = rd.submission_number AND sr.reviewer_id = rd.reviewer_id
    WHERE sr.submission_number = 1
    LIMIT 5
  `);
  
  console.log(`Submission 1 reviewers (${submission1Reviews.rows.length} found):`);
  submission1Reviews.rows.forEach(row => {
    console.log(`  - ${row.reviewer_id} (${row.name || 'Unknown'}) - Rating: ${row.rating}, Confidence: ${row.confidence}`);
  });
  
  // Test: Find papers authored by first person in database
  const firstPerson = await client.query('SELECT person_id FROM people LIMIT 1');
  if (firstPerson.rows.length > 0) {
    const personId = firstPerson.rows[0].person_id;
    const authoredPapers = await client.query(`
      SELECT sa.submission_number, s.avg_rating
      FROM submission_authors sa
      LEFT JOIN submissions s ON sa.submission_number = s.submission_number
      WHERE sa.author_id = $1
      LIMIT 5
    `, [personId]);
    
    console.log(`\n${personId} authored papers (${authoredPapers.rows.length} found):`);
    authoredPapers.rows.forEach(row => {
      console.log(`  - Submission ${row.submission_number} (avg rating: ${row.avg_rating || 'N/A'})`);
    });
  }
}

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('Starting JSON data import to database...\n');
    
    // Load JSON data
    const { peopleData, reviewsData } = await loadJSONData();
    
    // Create tables
    await createTables(client);
    
    // Import data in stages
    await importSubmissionAuthors(client, peopleData);
    await importSubmissionReviews(client, peopleData);
    await importReviewDetails(client, reviewsData);
    
    // Update submission_reviews with details
    await updateSubmissionReviewsWithDetails(client);
    
    // Print summary
    await printSummaryStats(client);
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
main().catch(console.error);