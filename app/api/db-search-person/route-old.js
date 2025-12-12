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
    const query = searchParams.get('q') || searchParams.get('query');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' }, 
        { status: 400 }
      );
    }

    // Search for people by name or person_id (case insensitive, fuzzy matching)
    const people = await client.query(`
      SELECT 
        person_id,
        name,
        nationality,
        role,
        institution,
        institutions,
        institution_type,
        gender
      FROM people 
      WHERE 
        LOWER(person_id) LIKE LOWER($1)
        OR LOWER(name) LIKE LOWER($1)
        OR LOWER(REPLACE(REPLACE(person_id, '~', ''), '_', ' ')) LIKE LOWER($1)
        OR LOWER(institution::text) LIKE LOWER($1)
        OR EXISTS (
          SELECT 1 FROM unnest(institutions) as inst 
          WHERE LOWER(inst::text) LIKE LOWER($1)
        )
      ORDER BY 
        CASE 
          WHEN LOWER(person_id) = LOWER($2) THEN 1
          WHEN LOWER(name) = LOWER($2) THEN 2
          WHEN LOWER(person_id) LIKE LOWER($3) THEN 3
          WHEN LOWER(name) LIKE LOWER($3) THEN 4
          ELSE 5
        END
      LIMIT 10
    `, [`%${query}%`, query, `${query}%`]);

    if (people.rows.length === 0) {
      return NextResponse.json(
        { error: 'No person found matching the query' }, 
        { status: 404 }
      );
    }

    const results = [];

    for (const person of people.rows) {
      // Get reviewer information if they are a reviewer
      const reviewerInfo = await client.query(`
        SELECT 
          list_type,
          reviews,
          avg_rating,
          avg_confidence,
          profile_url
        FROM reviewers 
        WHERE reviewer_id = $1
      `, [person.person_id]);

        // Get submissions they actually reviewed with detailed author information
      const reviewedSubmissions = await client.query(`
        SELECT DISTINCT
          sr.submission_number,
          sr.submission_id,
          sr.rating as rating_given,
          sr.confidence,
          sr.review_summary,
          s.avg_rating as submission_avg_rating,
          -- Get author institutions from conflict analysis
          ARRAY_AGG(DISTINCT 
            CASE WHEN ca.institution_name IS NOT NULL 
                 THEN jsonb_build_object(
                   'institution', ca.institution_name,
                   'country', 'Unknown',
                   'author_count', ca.author_count,
                   'reviewer_count', ca.reviewer_count,
                   -- Get specific people from this institution
                   'people_from_institution', (
                     SELECT ARRAY_AGG(
                       jsonb_build_object(
                         'name', p_inst.name,
                         'person_id', p_inst.person_id,
                         'nationality', p_inst.nationality,
                         'gender', p_inst.gender
                       )
                     )
                     FROM people p_inst 
                     WHERE p_inst.institution = ca.institution_name 
                     AND p_inst.name IS NOT NULL
                     LIMIT 5
                   )
                 )
            END
          ) FILTER (WHERE ca.institution_name IS NOT NULL) as author_institutions
        FROM submission_reviews sr
        LEFT JOIN submissions s ON sr.submission_number = s.submission_number
        LEFT JOIN conflict_analysis ca ON sr.submission_number = ca.submission_number
        WHERE sr.reviewer_id = $1
        GROUP BY sr.submission_number, sr.submission_id, sr.rating, sr.confidence, sr.review_summary, s.avg_rating
        ORDER BY sr.submission_number
        LIMIT 10
      `, [person.person_id]);

      // Get submissions they potentially authored with detailed reviewer information
      const authoredSubmissions = await client.query(`
        SELECT DISTINCT
          ca.submission_number,
          ca.submission_id,
          ca.avg_rating as avg_rating_received,
          ca.institution_name,
          -- Get all reviewers for this submission with complete details
          ARRAY_AGG(DISTINCT 
            jsonb_build_object(
              'reviewer_id', sr.reviewer_id,
              'name', p_reviewers.name,
              'institution', p_reviewers.institution,
              'nationality', p_reviewers.nationality,
              'gender', p_reviewers.gender,
              'institution_type', p_reviewers.institution_type,
              'rating_given', sr.rating,
              'confidence', sr.confidence,
              'profile_url', COALESCE(sr.reviewer_profile_url, 'https://openreview.net/profile?id=' || sr.reviewer_id)
            )
          ) FILTER (WHERE sr.reviewer_id IS NOT NULL) as reviewers_details
        FROM conflict_analysis ca 
        LEFT JOIN people p ON ca.institution_name = p.institution
        LEFT JOIN submission_reviews sr ON ca.submission_number = sr.submission_number
        LEFT JOIN people p_reviewers ON sr.reviewer_id = p_reviewers.person_id
        WHERE p.person_id = $1 AND ca.institution_name IS NOT NULL
        GROUP BY ca.submission_number, ca.submission_id, ca.avg_rating, ca.institution_name
        ORDER BY ca.avg_rating DESC
        LIMIT 5
      `, [person.person_id]);

      // If no authored submissions found through conflict analysis, try institution matching
      let authoredSubmissionsList = authoredSubmissions.rows;
      
      if (authoredSubmissionsList.length === 0) {
        // Try to find submissions through institution matching with reviewer details
        const institutionSubmissions = await client.query(`
          SELECT DISTINCT
            sr.submission_number,
            sr.submission_id,
            AVG(sr.rating) as avg_rating_received,
            p.institution as institution_involved,
            ARRAY_AGG(DISTINCT 
              jsonb_build_object(
                'reviewer_id', sr.reviewer_id,
                'name', p_reviewers.name,
                'institution', p_reviewers.institution,
                'nationality', p_reviewers.nationality,
                'gender', p_reviewers.gender,
                'institution_type', p_reviewers.institution_type,
                'rating_given', sr.rating,
                'confidence', sr.confidence,
                'profile_url', COALESCE(sr.reviewer_profile_url, 'https://openreview.net/profile?id=' || sr.reviewer_id)
              )
            ) FILTER (WHERE sr.reviewer_id != $1) as reviewers_details
          FROM submission_reviews sr
          JOIN people p ON sr.reviewer_id != $1  -- Not reviewed by this person
          LEFT JOIN people p_reviewers ON sr.reviewer_id = p_reviewers.person_id
          WHERE p.institution = (SELECT institution FROM people WHERE person_id = $1 LIMIT 1)
          AND p.institution IS NOT NULL
          GROUP BY sr.submission_number, sr.submission_id, p.institution
          LIMIT 3
        `, [person.person_id]);
        
        authoredSubmissionsList = institutionSubmissions.rows;
      }

      const personResult = {
        person_id: person.person_id,
        name: person.name || person.person_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '),
        nationality: person.nationality,
        gender: person.gender,
        institution: person.institution,
        institutions: person.institutions,
        institution_type: person.institution_type,
        profile_url: `https://openreview.net/profile?id=${encodeURIComponent(person.person_id)}`,
        
        // Reviewer statistics
        reviewer_stats: reviewerInfo.rows.length > 0 ? {
          total_reviews: reviewerInfo.rows[0].reviews,
          avg_rating: reviewerInfo.rows[0].avg_rating,
          avg_confidence: reviewerInfo.rows[0].avg_confidence,
          review_types: reviewerInfo.rows.map(r => r.list_type)
        } : null,

        // Submissions reviewed with author information
        reviewed_submissions: reviewedSubmissions.rows.map(s => ({
          submission_number: s.submission_number,
          submission_id: s.submission_id,
          rating_given: s.rating_given,
          confidence_given: s.confidence,
          review_summary: s.review_summary ? s.review_summary.substring(0, 200) + '...' : 'No summary available',
          submission_avg_rating: Number(s.submission_avg_rating || 0).toFixed(2),
          openreview_url: `https://openreview.net/forum?id=${s.submission_id}`,
          author_institutions: s.author_institutions || []
        })),

        // Submissions authored with detailed reviewer information
        authored_submissions: authoredSubmissionsList.map(s => ({
          submission_number: s.submission_number,
          submission_id: s.submission_id,
          avg_rating_received: Number(s.avg_rating_received || 0).toFixed(2),
          institution_involved: s.institution_involved || s.institution_name || 'Unknown',
          openreview_url: `https://openreview.net/forum?id=${s.submission_id}`,
          reviewers_details: s.reviewers_details || []
        }))
      };

      results.push(personResult);
    }

    const response = {
      query: query,
      results: results,
      total_found: people.rows.length,
      data_source: 'neon_database_real'
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to search person in database', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}