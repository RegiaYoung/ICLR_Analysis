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
    const query = searchParams.get('q') || searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' }, 
        { status: 400 }
      );
    }

    // Search for people by name or person_id (case insensitive, fuzzy matching)
    // Only select columns that are guaranteed to exist in the current schema
    const people = await client.query(`
      SELECT
        person_id,
        name,
        nationality,
        institution,
        gender,
        role
      FROM people
      WHERE 
        LOWER(person_id) LIKE LOWER($1)
        OR LOWER(name) LIKE LOWER($1)
        OR LOWER(REPLACE(REPLACE(person_id, '~', ''), '_', ' ')) LIKE LOWER($1)
        OR LOWER(institution::text) LIKE LOWER($1)
      ORDER BY 
        CASE 
          WHEN LOWER(person_id) = LOWER($2) THEN 1
          WHEN LOWER(name) = LOWER($2) THEN 2
          WHEN LOWER(person_id) LIKE LOWER($3) THEN 3
          WHEN LOWER(name) LIKE LOWER($3) THEN 4
          ELSE 5
        END,
        name ASC
      LIMIT $4
    `, [`%${query}%`, query, `%${query}%`, limit]);

    // Get enhanced details for each person
    const enrichedResults = await Promise.all(people.rows.map(async (person) => {
      // Get detailed reviewer statistics from reviewers table
      let reviewerStats = null;
      try {
        const reviewerStatisticsQuery = await client.query(`
          SELECT
            review_count,
            avg_rating,
            rating_std,
            avg_confidence,
            avg_text_length,
            question_ratio,
            institution
          FROM reviewer_statistics
          WHERE reviewer_id = $1
        `, [person.person_id]);

        if (reviewerStatisticsQuery.rows.length > 0) {
          const stats = reviewerStatisticsQuery.rows[0];
          reviewerStats = {
            review_count: parseInt(stats.review_count || 0),
            avg_rating: parseFloat(Number(stats.avg_rating || 0).toFixed(2)),
            rating_std: parseFloat(Number(stats.rating_std || 0).toFixed(3)),
            avg_confidence: parseFloat(Number(stats.avg_confidence || 0).toFixed(2)),
            avg_text_length: parseInt(stats.avg_text_length || 0),
            question_ratio: parseFloat(Number(stats.question_ratio || 0).toFixed(3)),
            institution: stats.institution
          };
        }
      } catch (err) {
        console.warn('Could not get reviewer stats from reviewer_statistics table:', err.message);
      }

      // If not found in reviewer_statistics, fall back to reviewers table
      try {
        const reviewerQuery = await client.query(`
          SELECT
            reviews,
            avg_rating,
            median_rating,
            rating_std,
            min_rating,
            max_rating,
            avg_confidence,
            avg_text_words,
            avg_questions_words,
            ethics_flags,
            profile_url
          FROM reviewers
          WHERE reviewer_id = $1
        `, [person.person_id]);
        
        if (reviewerQuery.rows.length > 0) {
          const stats = reviewerQuery.rows[0];
          reviewerStats = {
            review_count: parseInt(stats.reviews || 0),
            avg_rating: parseFloat(Number(stats.avg_rating || 0).toFixed(2)),
            median_rating: parseFloat(Number(stats.median_rating || 0).toFixed(2)),
            rating_std: parseFloat(Number(stats.rating_std || 0).toFixed(3)),
            min_rating: parseInt(stats.min_rating || 0),
            max_rating: parseInt(stats.max_rating || 0),
            avg_confidence: parseFloat(Number(stats.avg_confidence || 0).toFixed(2)),
            avg_text_words: parseInt(stats.avg_text_words || 0),
            avg_questions_words: parseInt(stats.avg_questions_words || 0),
            ethics_flags: parseInt(stats.ethics_flags || 0),
            profile_url: stats.profile_url || `https://openreview.net/profile?id=${person.person_id}`
          };
        }
      } catch (err) {
        console.warn('Could not get reviewer stats from reviewers table:', err.message);
      }

      // Process institution data
      let institutionInfo = null;
      if (person.institution) {
        try {
          const rawInstitution = typeof person.institution === 'string'
            ? person.institution
            : JSON.stringify(person.institution);

          if (rawInstitution.trim().startsWith('{') || rawInstitution.trim().startsWith('[')) {
            const parsed = JSON.parse(rawInstitution);
            const institutionObj = Array.isArray(parsed) ? parsed[0] : parsed;

            institutionInfo = {
              name: institutionObj?.name || rawInstitution,
              country: institutionObj?.country || person.nationality || 'Unknown',
              type: institutionObj?.type || institutionObj?.institution_type || 'Unknown'
            };
          } else {
            institutionInfo = {
              name: rawInstitution,
              country: person.nationality || 'Unknown',
              type: 'Unknown'
            };
          }
        } catch (e) {
          institutionInfo = {
            name: typeof person.institution === 'string' ? person.institution : String(person.institution),
            country: person.nationality || 'Unknown',
            type: 'Unknown'
          };
        }
      }

      // Parse reviewer_stats JSON if it exists
      let parsedReviewerStats = null;
      if (person.reviewer_stats) {
        try {
          parsedReviewerStats = person.reviewer_stats;
        } catch (e) {
          console.warn('Could not parse reviewer_stats JSON:', e.message);
        }
      }

      // Get papers this person reviewed (审过谁)
      let reviewedSubmissions = [];
      try {
        const reviewedQuery = await client.query(`
          SELECT DISTINCT 
            rd.submission_number,
            rd.review_id,
            rd.rating,
            rd.confidence,
            rd.summary,
            ss.submission_id,
            ss.avg_rating as submission_avg_rating
          FROM review_details rd
          LEFT JOIN submission_statistics ss ON rd.submission_number = ss.submission_number
          WHERE rd.reviewer_id = $1
          ORDER BY rd.submission_number
          LIMIT 20
        `, [person.person_id]);
        
        reviewedSubmissions = reviewedQuery.rows.map(row => ({
          submission_number: row.submission_number,
          submission_id: row.submission_id || row.submission_number,
          review_id: row.review_id,
          openreview_url: `https://openreview.net/forum?id=ICLR_2026_Conference_Submission${row.submission_number}`,
          rating: row.rating,
          confidence: row.confidence,
          summary: row.summary ? row.summary.substring(0, 200) + '...' : 'No summary',
          submission_avg_rating: parseFloat(Number(row.submission_avg_rating || 0).toFixed(2))
        }));
      } catch (err) {
        console.warn('Could not get reviewed submissions:', err.message);
      }

      // Get papers this person authored
      let authoredSubmissions = [];
      try {
        const authoredQuery = await client.query(`
          SELECT DISTINCT 
            sa.submission_number,
            ss.submission_id,
            ss.avg_rating,
            ss.review_count
          FROM submission_authors sa
          LEFT JOIN submission_statistics ss ON sa.submission_number = ss.submission_number
          WHERE sa.author_id = $1
          ORDER BY sa.submission_number
          LIMIT 20
        `, [person.person_id]);
        
        authoredSubmissions = authoredQuery.rows.map(row => ({
          submission_number: row.submission_number,
          submission_id: row.submission_id || row.submission_number,
          openreview_url: `https://openreview.net/forum?id=ICLR_2026_Conference_Submission${row.submission_number}`,
          avg_rating: parseFloat(Number(row.avg_rating || 0).toFixed(2)),
          review_count: parseInt(row.review_count || 0)
        }));
      } catch (err) {
        console.warn('Could not get authored submissions:', err.message);
      }

      // Get "被谁审过" - Who reviewed this person's papers
      let reviewedByOthers = [];
      try {
        const reviewedByQuery = await client.query(`
          SELECT DISTINCT 
            rd.reviewer_id,
            rd.submission_number,
            rd.rating,
            rd.confidence,
            p_reviewer.name as reviewer_name,
            p_reviewer.nationality as reviewer_nationality,
            p_reviewer.institution as reviewer_institution
          FROM submission_authors sa
          JOIN review_details rd ON sa.submission_number = rd.submission_number
          LEFT JOIN people p_reviewer ON rd.reviewer_id = p_reviewer.person_id
          WHERE sa.author_id = $1
            AND rd.reviewer_id != $1
          ORDER BY rd.submission_number, rd.rating DESC
          LIMIT 30
        `, [person.person_id]);
        
        reviewedByOthers = reviewedByQuery.rows.map(row => ({
          reviewer_id: row.reviewer_id,
          reviewer_name: row.reviewer_name || row.reviewer_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '),
          reviewer_nationality: row.reviewer_nationality || 'Unknown',
          reviewer_institution: row.reviewer_institution || 'Unknown',
          submission_number: row.submission_number,
          rating: row.rating,
          confidence: row.confidence,
          openreview_url: `https://openreview.net/forum?id=ICLR_2026_Conference_Submission${row.submission_number}`
        }));
      } catch (err) {
        console.warn('Could not get reviewers of authored papers:', err.message);
      }

      // Get "审过谁" - Whose papers this person reviewed (with author details)
      let reviewedOthersDetails = [];
      try {
        const reviewedOthersQuery = await client.query(`
          SELECT DISTINCT 
            rd.submission_number,
            rd.rating,
            rd.confidence,
            sa.author_id,
            p_author.name as author_name,
            p_author.nationality as author_nationality,
            p_author.institution as author_institution
          FROM review_details rd
          JOIN submission_authors sa ON rd.submission_number = sa.submission_number
          LEFT JOIN people p_author ON sa.author_id = p_author.person_id
          WHERE rd.reviewer_id = $1
          ORDER BY rd.submission_number, sa.author_id
          LIMIT 30
        `, [person.person_id]);
        
        reviewedOthersDetails = reviewedOthersQuery.rows.map(row => ({
          submission_number: row.submission_number,
          rating: row.rating,
          confidence: row.confidence,
          author_id: row.author_id,
          author_name: row.author_name || row.author_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '),
          author_nationality: row.author_nationality || 'Unknown',
          author_institution: row.author_institution || 'Unknown',
          openreview_url: `https://openreview.net/forum?id=ICLR_2026_Conference_Submission${row.submission_number}`
        }));
      } catch (err) {
        console.warn('Could not get details of reviewed papers:', err.message);
      }

      return {
        person_id: person.person_id,
        name: person.name || person.person_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '),
        nationality: person.nationality || 'Unknown',
        gender: person.gender || 'Unknown',
        role: person.role || 'Unknown',
        institution: institutionInfo,
        institutions: person.institution ? [person.institution] : [],
        reviewer_stats: reviewerStats || parsedReviewerStats,
        total_papers: parseInt(person.total_papers || authoredSubmissions.length || 0),
        total_reviews: parseInt(person.total_reviews || reviewedSubmissions.length || 0),
        
        // Main functionality - complete review relationships
        reviewed_submissions: reviewedSubmissions,  // Papers this person reviewed
        authored_submissions: authoredSubmissions,  // Papers this person authored
        reviewed_by_others: reviewedByOthers,       // 被谁审过 - Who reviewed this person's papers
        reviewed_others_details: reviewedOthersDetails,  // 审过谁 - Detailed info about whose papers this person reviewed
        
        // Summary counts
        authored_papers_count: authoredSubmissions.length,
        reviewed_papers_count: reviewedSubmissions.length,
        reviewed_by_count: [...new Set(reviewedByOthers.map(r => r.reviewer_id))].length,  // Unique reviewers
        reviewed_others_count: [...new Set(reviewedOthersDetails.map(r => r.author_id))].length,  // Unique authors
        
        // Metadata
        data_note: "完整的审稿关系数据，基于新导入的数据库表",
        available_functionality: [
          "查看此人审过的所有论文",
          "查看此人发表的所有论文", 
          "查看谁审过此人的论文",
          "查看此人审过谁的论文"
        ]
      };
    }));

    const response = {
      results: enrichedResults,
      total: enrichedResults.length,
      query,
      limit,
      data_source: 'neon_database_new_schema',
      search_functionality: 'Complete review relationships with imported JSON data'
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search person in database', details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

