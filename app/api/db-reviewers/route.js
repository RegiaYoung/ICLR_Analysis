import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 5,
});

export async function GET(request) {
  let client;
  try {
    client = await pool.connect();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const listType = searchParams.get('type') || null;
    
    // If specific list type is requested, get from top_lists table
    if (listType) {
      const query = `
        SELECT 
          item_id as reviewer_id,
          item_data,
          rank
        FROM top_lists 
        WHERE list_type = $1 
        ORDER BY rank 
        LIMIT $2
      `;
      
      const result = await client.query(query, [listType, limit]);
      const reviewers = result.rows.map(row => ({
        reviewer_id: row.reviewer_id,
        rank: row.rank,
        ...JSON.parse(row.item_data)
      }));
      
      return NextResponse.json({
        reviewers,
        total: reviewers.length,
        list_type: listType,
        data_source: 'top_lists_table'
      });
    }
    
    // Otherwise get from reviewer_statistics table
    let query = `
      SELECT 
        rs.reviewer_id,
        rs.review_count,
        rs.avg_rating,
        rs.rating_std,
        rs.avg_confidence,
        rs.avg_text_length,
        rs.question_ratio,
        rs.institution,
        p.name,
        p.nationality,
        CASE 
          WHEN rs.avg_rating IS NOT NULL THEN ((10 - rs.avg_rating) / 8 * 100)
          ELSE 0 
        END as strictness_score,
        CASE 
          WHEN rs.rating_std IS NOT NULL THEN GREATEST(0, (1 - rs.rating_std / 4) * 100)
          ELSE 100 
        END as consistency_score
      FROM reviewer_statistics rs
      LEFT JOIN people p ON rs.reviewer_id = p.person_id
      WHERE rs.review_count >= 3
      ORDER BY rs.review_count DESC, rs.avg_rating ASC 
      LIMIT $1
    `;
    
    const reviewers = await client.query(query, [limit]);
    
    // Process the results
    const processedReviewers = reviewers.rows.map(reviewer => ({
      reviewer_id: reviewer.reviewer_id,
      name: reviewer.name || reviewer.reviewer_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '),
      nationality: reviewer.nationality || 'Unknown',
      review_count: reviewer.review_count,
      avg_rating: reviewer.avg_rating ? parseFloat(parseFloat(reviewer.avg_rating).toFixed(2)) : 0,
      rating_std: reviewer.rating_std ? parseFloat(parseFloat(reviewer.rating_std).toFixed(3)) : 0,
      avg_confidence: reviewer.avg_confidence ? parseFloat(parseFloat(reviewer.avg_confidence).toFixed(2)) : 0,
      strictness_score: reviewer.strictness_score ? parseFloat(parseFloat(reviewer.strictness_score).toFixed(1)) : 0,
      consistency_score: reviewer.consistency_score ? parseFloat(parseFloat(reviewer.consistency_score).toFixed(1)) : 0,
      avg_text_length: reviewer.avg_text_length || 0,
      question_ratio: reviewer.question_ratio ? parseFloat(parseFloat(reviewer.question_ratio).toFixed(3)) : 0,
      institution: reviewer.institution || 'Unknown'
    }));
    
    const response = {
      reviewers: processedReviewers,
      pagination: {
        page: 1,
        limit: limit,
        total: processedReviewers.length,
        totalPages: 1
      },
      filters: {
        type: listType
      },
      data_source: 'optimized_database'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviewers from database', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}