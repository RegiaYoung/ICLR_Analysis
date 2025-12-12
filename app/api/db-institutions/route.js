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
    const limit = parseInt(searchParams.get('limit') || '30');
    
    const institutions = await client.query(`
      SELECT 
        institution_name,
        country,
        institution_type,
        total_members,
        author_count,
        reviewer_count,
        submissions_involved,
        submissions_as_author,
        submissions_as_reviewer as total_reviews,
        avg_rating_given as avg_rating,
        avg_confidence,
        CASE 
          WHEN avg_rating_given IS NOT NULL THEN ((10 - avg_rating_given) / 8 * 100)
          ELSE 0 
        END as strictness_score
      FROM institutions
      WHERE total_members > 0
      ORDER BY total_members DESC, submissions_involved DESC
      LIMIT $1
    `, [limit]);
    
    const processedInstitutions = institutions.rows.map(institution => ({
      institution_id: institution.institution_name,
      institution_name: institution.institution_name,
      country: institution.country || 'Unknown',
      institution_type: institution.institution_type || 'Unknown',
      total_members: institution.total_members,
      author_count: institution.author_count,
      reviewer_count: institution.reviewer_count,
      submissions_involved: institution.submissions_involved,
      submissions_as_author: institution.submissions_as_author,
      total_reviews: institution.total_reviews,
      avg_rating: institution.avg_rating ? parseFloat(parseFloat(institution.avg_rating).toFixed(2)) : 0,
      avg_confidence: institution.avg_confidence ? parseFloat(parseFloat(institution.avg_confidence).toFixed(2)) : 0,
      strictness_score: institution.strictness_score ? parseFloat(parseFloat(institution.strictness_score).toFixed(1)) : 0
    }));
    
    const response = {
      institutions: processedInstitutions,
      pagination: {
        page: 1,
        limit: limit,
        total: processedInstitutions.length,
        totalPages: 1
      },
      data_source: 'neon_database'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch institutions from database', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}