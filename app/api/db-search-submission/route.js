import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

export async function GET(request) {
  let client;
  try {
    client = await pool.connect();
    
    const { searchParams } = new URL(request.url);
    const submissionNumber = searchParams.get('number') || searchParams.get('submission_number');
    
    if (!submissionNumber) {
      return NextResponse.json(
        { error: 'Submission number is required' }, 
        { status: 400 }
      );
    }

    // Get submission statistics from submission_statistics table
    const submissionStats = await client.query(`
      SELECT 
        submission_id,
        submission_number,
        review_count,
        avg_rating,
        rating_std,
        avg_confidence,
        ethics_flag
      FROM submission_statistics
      WHERE submission_number::text = $1
    `, [submissionNumber]);

    if (submissionStats.rows.length === 0) {
      // Check the range of available submissions
      const rangeQuery = await client.query(`
        SELECT 
          MIN(submission_number::int) as min_num, 
          MAX(submission_number::int) as max_num,
          COUNT(*) as total_count
        FROM submission_statistics
      `);
      
      const range = rangeQuery.rows[0];
      
      return NextResponse.json({
        error: 'Submission not found',
        submission_number: parseInt(submissionNumber),
        found: false,
        available_range: {
          min: range.min_num,
          max: range.max_num,
          total_submissions: parseInt(range.total_count)
        },
        suggestion: `Try searching for a submission number between ${range.min_num} and ${range.max_num}. We currently have ${range.total_count} submissions in the database.`
      }, { status: 404 });
    }

    const submission = submissionStats.rows[0];

    // Get detailed review data using our new tables
    const reviewsQuery = await client.query(`
      SELECT 
        rd.review_id,
        rd.reviewer_id,
        rd.rating,
        rd.confidence,
        rd.summary,
        rd.strengths,
        rd.weaknesses,
        rd.questions,
        rd.soundness,
        rd.presentation,
        rd.contribution,
        rd.reviewer_profile_url,
        p.name as reviewer_name,
        p.nationality as reviewer_nationality,
        p.gender as reviewer_gender,
        p.institution as reviewer_institution,
        r.reviews as reviewer_total_reviews,
        r.avg_rating as reviewer_avg_rating,
        r.avg_confidence as reviewer_avg_confidence
      FROM review_details rd
      LEFT JOIN people p ON rd.reviewer_id = p.person_id
      LEFT JOIN reviewers r ON rd.reviewer_id = r.reviewer_id
      WHERE rd.submission_number = $1
      ORDER BY rd.rating DESC
    `, [parseInt(submissionNumber)]);

    // Transform the review data
    const reviews = reviewsQuery.rows.map(row => {
      const isAnonymous = row.reviewer_id && row.reviewer_id.startsWith('anonymous_reviewer_');
      
      return {
        review_id: row.review_id,
        reviewer_id: row.reviewer_id,
        reviewer_name: isAnonymous 
          ? `Anonymous Reviewer (${row.reviewer_id.split('_').pop()})`
          : (row.reviewer_name || row.reviewer_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' ')),
        reviewer_profile_url: isAnonymous 
          ? null 
          : (row.reviewer_profile_url || `https://openreview.net/profile?id=${row.reviewer_id}`),
        rating: row.rating,
        confidence: row.confidence,
        review_summary: row.summary || 'No summary provided',
        review_strengths: row.strengths ? row.strengths.split('\n').filter(s => s.trim()) : [],
        review_weaknesses: row.weaknesses ? row.weaknesses.split('\n').filter(s => s.trim()) : [],
        review_questions: row.questions && row.questions !== 'N/A' ? [row.questions] : [],
        soundness: row.soundness,
        presentation: row.presentation,
        contribution: row.contribution,
        reviewer_nationality: isAnonymous ? 'Anonymous' : (row.reviewer_nationality || 'Unknown'),
        reviewer_gender: isAnonymous ? 'Anonymous' : (row.reviewer_gender || 'Unknown'),
        reviewer_institution: isAnonymous ? 'Anonymous' : (row.reviewer_institution || 'Unknown'),
        reviewer_total_reviews: isAnonymous ? null : (row.reviewer_total_reviews || 0),
        reviewer_avg_rating: isAnonymous ? null : parseFloat(Number(row.reviewer_avg_rating || 0).toFixed(2)),
        reviewer_avg_confidence: isAnonymous ? null : parseFloat(Number(row.reviewer_avg_confidence || 0).toFixed(2)),
        is_anonymous: isAnonymous
      };
    });

    // Calculate statistics from actual review data
    const validRatings = reviews.filter(r => r.rating != null && !isNaN(r.rating)).map(r => r.rating);
    const validConfidences = reviews.filter(r => r.confidence != null && !isNaN(r.confidence)).map(r => r.confidence);
    
    const calculatedStats = {
      avg_rating: validRatings.length > 0 ? 
        parseFloat((validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length).toFixed(2)) : 
        submission.avg_rating,
      avg_confidence: validConfidences.length > 0 ?
        parseFloat((validConfidences.reduce((sum, r) => sum + r, 0) / validConfidences.length).toFixed(2)) :
        submission.avg_confidence,
      rating_std: submission.rating_std || 0,
      review_count: reviews.length,
      ethics_flags: submission.ethics_flag || 0
    };

    // Get authors information
    const authorsQuery = await client.query(`
      SELECT 
        sa.author_id,
        p.name as author_name,
        p.nationality as author_nationality,
        p.institution as author_institution,
        p.gender as author_gender
      FROM submission_authors sa
      LEFT JOIN people p ON sa.author_id = p.person_id
      WHERE sa.submission_number = $1
    `, [parseInt(submissionNumber)]);

    const authors = authorsQuery.rows.map(row => ({
      author_id: row.author_id,
      author_name: row.author_name || row.author_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '),
      author_nationality: row.author_nationality || 'Unknown',
      author_institution: row.author_institution || 'Unknown',
      author_gender: row.author_gender || 'Unknown'
    }));

    const response = {
      submission_number: parseInt(submission.submission_number),
      submission_id: submission.submission_id,
      found: true,
      authors: authors,
      reviews: reviews,
      statistics: calculatedStats,
      metadata: {
        search_timestamp: new Date().toISOString(),
        data_source: 'neon_database_new_schema',
        note: 'Real review data from imported JSON files using new table structure'
      }
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Submission search error:', error);
    return NextResponse.json(
      { error: 'Failed to search submission in database', details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}