import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_VMzu14dfSmNI@ep-plain-sound-ad6539zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  connectionTimeoutMillis: 10000,
  max: 5,
});

export async function GET() {
  let client;
  
  try {
    client = await pool.connect();
    
    // Get stats from database tables
    const peopleStats = await client.query(`
      SELECT 
        COUNT(*) as total_people,
        COUNT(CASE WHEN role LIKE '%reviewer%' THEN 1 END) as total_reviewers,
        COUNT(CASE WHEN role LIKE '%author%' THEN 1 END) as total_authors
      FROM people
    `);
    
    const institutionStats = await client.query(`
      SELECT 
        COUNT(*) as total_institutions,
        SUM(total_members) as total_members
      FROM institutions 
      WHERE total_members > 0
    `);
    
    const reviewerStatsCount = await client.query('SELECT COUNT(*) as count FROM reviewer_statistics');
    const submissionStatsCount = await client.query('SELECT COUNT(*) as count FROM submission_statistics');
    
    const avgStats = await client.query(`
      SELECT 
        AVG(avg_rating) as avg_rating,
        AVG(avg_confidence) as avg_confidence,
        SUM(review_count) as total_reviews
      FROM reviewer_statistics
    `);
    
    // Get top countries
    const topCountries = await client.query(`
      SELECT 
        nationality as country,
        COUNT(*) as reviewer_count,
        COUNT(*)::float / (SELECT COUNT(*) FROM people WHERE nationality IS NOT NULL) as reviewer_ratio
      FROM people 
      WHERE nationality IS NOT NULL 
      GROUP BY nationality 
      ORDER BY reviewer_count DESC 
      LIMIT 20
    `);
    
    const response = {
      database_stats: {
        total_reviews: parseInt(avgStats.rows[0]?.total_reviews || 0),
        total_people: parseInt(peopleStats.rows[0]?.total_people || 0),
        total_institutions: parseInt(institutionStats.rows[0]?.total_institutions || 0),
        total_reviewers: parseInt(reviewerStatsCount.rows[0]?.count || 0),
        total_submissions: parseInt(submissionStatsCount.rows[0]?.count || 0),
        avg_rating: parseFloat(Number(avgStats.rows[0]?.avg_rating || 6.2).toFixed(2)),
        avg_confidence: parseFloat(Number(avgStats.rows[0]?.avg_confidence || 3.8).toFixed(2))
      },
      top_countries: topCountries.rows,
      last_updated: new Date().toISOString(),
      data_source: 'neon_database'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error.message);
    return NextResponse.json(
      { error: 'Database connection failed', message: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}