import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 5,
});

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    
    // 1. Institution influence ranking
    const institutionInfluence = await client.query(`
      SELECT 
        institution_name,
        country,
        institution_type,
        total_members,
        submissions_involved,
        submissions_as_author as as_author,
        submissions_as_reviewer as as_reviewer,
        avg_rating_given,
        avg_confidence,
        (
          COALESCE(submissions_involved, 0) * 0.4 + 
          COALESCE(total_members, 0) * 0.3 + 
          COALESCE(submissions_as_reviewer, 0) * 0.3
        )::integer as influence_score
      FROM institutions 
      WHERE total_members > 0
      ORDER BY influence_score DESC
      LIMIT 30
    `);
    
    // 2. Institution type analysis
    const institutionTypeAnalysis = await client.query(`
      SELECT 
        COALESCE(institution_type, 'Unknown') as type,
        COUNT(*) as count,
        SUM(total_members) as total_members,
        SUM(author_count) as author_count,
        SUM(reviewer_count) as reviewer_count,
        COUNT(DISTINCT country) as country_count,
        AVG(total_members) as avg_members_per_institution
      FROM institutions 
      GROUP BY institution_type
    `);
    
    // 3. Country academic power
    const countryAcademicPower = await client.query(`
      SELECT 
        country,
        COUNT(*) as institution_count,
        SUM(total_members) as total_academic_members,
        SUM(author_count) as total_authors,
        SUM(reviewer_count) as total_reviewers,
        COUNT(CASE WHEN institution_type = 'University' THEN 1 END) as university_count,
        COUNT(CASE WHEN institution_type = 'Company' THEN 1 END) as company_count,
        (
          SUM(total_members) * 0.4 + 
          SUM(reviewer_count) * 0.35 + 
          COUNT(*) * 0.25
        )::integer as academic_power_score,
        (SUM(total_members) / GREATEST(COUNT(*), 1))::integer as researcher_density
      FROM institutions 
      WHERE country IS NOT NULL AND total_members > 0
      GROUP BY country
      ORDER BY academic_power_score DESC
      LIMIT 20
    `);
    
    // 4. Institution strictness analysis
    const institutionStrictness = await client.query(`
      SELECT 
        institution_name,
        country,
        avg_rating_given,
        submissions_as_reviewer as review_count,
        avg_confidence,
        CASE 
          WHEN avg_rating_given < 4.0 THEN 'Very Strict'
          WHEN avg_rating_given < 4.5 THEN 'Strict'
          WHEN avg_rating_given < 5.5 THEN 'Moderate'
          WHEN avg_rating_given < 6.5 THEN 'Lenient'
          ELSE 'Very Lenient'
        END as strictness_level
      FROM institutions 
      WHERE submissions_as_reviewer >= 10 AND avg_rating_given IS NOT NULL
      ORDER BY avg_rating_given ASC
      LIMIT 20
    `);
    
    const response = {
      institution_influence: institutionInfluence.rows.map(row => ({
        institution_name: row.institution_name,
        country: row.country || 'Unknown',
        institution_type: row.institution_type || 'Unknown',
        total_members: row.total_members,
        submissions_involved: row.submissions_involved,
        as_author: row.as_author,
        as_reviewer: row.as_reviewer,
        avg_rating_given: parseFloat(Number(row.avg_rating_given || 0).toFixed(2)),
        avg_confidence: parseFloat(Number(row.avg_confidence || 0).toFixed(2)),
        influence_score: row.influence_score
      })),
      institution_type_analysis: Object.fromEntries(
        institutionTypeAnalysis.rows.map(row => [
          row.type,
          {
            count: row.count,
            total_members: row.total_members,
            author_count: row.author_count,
            reviewer_count: row.reviewer_count,
            countries: [row.country_count + ' countries'], // Simplified for now
            avg_members_per_institution: Math.round(row.avg_members_per_institution || 0)
          }
        ])
      ),
      country_academic_power: countryAcademicPower.rows,
      institution_strictness: institutionStrictness.rows.map(row => ({
        institution_name: row.institution_name,
        country: row.country || 'Unknown',
        avg_rating_given: parseFloat(Number(row.avg_rating_given || 0).toFixed(2)),
        review_count: row.review_count,
        avg_confidence: parseFloat(Number(row.avg_confidence || 0).toFixed(2)),
        strictness_level: row.strictness_level
      })),
      metadata: {
        total_institutions_analyzed: institutionInfluence.rowCount,
        total_countries: countryAcademicPower.rowCount,
        analysis_timestamp: new Date().toISOString(),
        data_source: 'neon_database'
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze institution data from database', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}