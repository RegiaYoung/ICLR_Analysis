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
    
    // 1. Coverage analysis from submission_statistics
    const coverageAnalysis = await client.query(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN review_count >= 3 THEN 1 END) as well_reviewed,
        COUNT(CASE WHEN review_count < 3 AND review_count > 0 THEN 1 END) as under_reviewed,
        COUNT(CASE WHEN review_count = 0 THEN 1 END) as no_reviews,
        AVG(review_count) as avg_reviews_per_submission
      FROM submission_statistics
    `);
    
    // Get total reviews from reviewer_statistics
    const totalReviewsResult = await client.query(`
      SELECT SUM(review_count) as total_reviews FROM reviewer_statistics
    `);
    
    // 2. Top quality reviewers from reviewer_statistics and top_lists
    const topQualityReviewers = await client.query(`
      SELECT 
        rs.reviewer_id,
        rs.review_count,
        rs.avg_rating,
        rs.rating_std,
        rs.avg_confidence,
        rs.avg_text_length,
        rs.question_ratio,
        p.name,
        CASE 
          WHEN rs.rating_std IS NOT NULL THEN GREATEST(0, 100 - (rs.rating_std * 25))
          ELSE 100 
        END as consistency_score,
        LEAST(100, rs.avg_text_length / 10 + rs.question_ratio * 500) as engagement_score,
        LEAST(100, rs.review_count * 2) as experience_score,
        rs.avg_confidence * 20 as confidence_score,
        (
          COALESCE(GREATEST(0, 100 - (rs.rating_std * 25)), 100) * 0.25 +
          LEAST(100, rs.avg_text_length / 10 + rs.question_ratio * 500) * 0.25 +
          LEAST(100, rs.review_count * 2) * 0.25 +
          rs.avg_confidence * 20 * 0.25
        ) as overall_quality_score
      FROM reviewer_statistics rs
      LEFT JOIN people p ON rs.reviewer_id = p.person_id
      WHERE rs.review_count >= 3
      ORDER BY overall_quality_score DESC
      LIMIT 30
    `);
    
    // 3. Paper quality analysis from submission_statistics
    const paperQualityAnalysis = await client.query(`
      SELECT 
        submission_id,
        submission_number,
        review_count,
        avg_rating,
        rating_std,
        avg_confidence,
        CASE 
          WHEN rating_std > 2 THEN 'disputed_submissions'
          WHEN rating_std < 1 THEN 'consensus_submissions'
          ELSE 'regular_submissions'
        END as type
      FROM submission_statistics
      WHERE rating_std IS NOT NULL AND review_count > 0
      ORDER BY 
        CASE 
          WHEN rating_std > 2 THEN rating_std
          WHEN rating_std < 1 THEN -rating_std
          ELSE 0
        END DESC
      LIMIT 40
    `);
    
    // 4. System health metrics
    const systemHealthMetrics = await client.query(`
      SELECT 
        COUNT(*) as total_unique_reviewers,
        COUNT(CASE WHEN review_count >= 3 THEN 1 END) as active_reviewers,
        COUNT(CASE WHEN review_count >= 10 THEN 1 END) as expert_reviewers
      FROM reviewer_statistics
    `);
    
    const qualityDistribution = await client.query(`
      WITH quality_scores AS (
        SELECT 
          (
            COALESCE(GREATEST(0, 100 - (rating_std * 25)), 100) * 0.25 +
            LEAST(100, avg_text_length / 10 + question_ratio * 500) * 0.25 +
            LEAST(100, review_count * 2) * 0.25 +
            avg_confidence * 20 * 0.25
          ) as overall_quality_score
        FROM reviewer_statistics
        WHERE review_count >= 3
      )
      SELECT 
        COUNT(CASE WHEN overall_quality_score >= 80 THEN 1 END) as high_quality_reviewers,
        COUNT(CASE WHEN overall_quality_score >= 60 AND overall_quality_score < 80 THEN 1 END) as medium_quality_reviewers,
        COUNT(CASE WHEN overall_quality_score < 60 THEN 1 END) as improvement_needed_reviewers
      FROM quality_scores
    `);
    
    const reviewConsistency = await client.query(`
      SELECT 
        COUNT(CASE WHEN rating_std < 1 AND review_count > 0 THEN 1 END) as highly_consistent_papers,
        COUNT(CASE WHEN rating_std > 2 AND review_count > 0 THEN 1 END) as disputed_papers,
        (COUNT(CASE WHEN rating_std < 1 AND review_count > 0 THEN 1 END)::float / 
         NULLIF(COUNT(CASE WHEN rating_std IS NOT NULL AND review_count > 0 THEN 1 END), 0) * 100) as consistency_ratio
      FROM submission_statistics
    `);
    
    // 5. Regional quality comparison
    const regionalQualityComparison = await client.query(`
      SELECT 
        p.nationality,
        COUNT(DISTINCT rs.reviewer_id) as reviewer_count,
        AVG(rs.review_count) as avg_reviews_per_reviewer,
        AVG(rs.avg_rating) as avg_rating_given,
        AVG(rs.avg_confidence) as avg_confidence,
        AVG(COALESCE(GREATEST(0, 100 - (rs.rating_std * 25)), 100)) as avg_consistency,
        CASE 
          WHEN COUNT(DISTINCT rs.reviewer_id) >= 50 THEN 'Major Contributor'
          WHEN COUNT(DISTINCT rs.reviewer_id) >= 20 THEN 'Active Contributor'
          ELSE 'Regular Contributor'
        END as quality_tier
      FROM reviewer_statistics rs
      JOIN people p ON rs.reviewer_id = p.person_id
      WHERE rs.review_count >= 3 AND p.nationality IS NOT NULL
      GROUP BY p.nationality
      HAVING COUNT(DISTINCT rs.reviewer_id) >= 5
      ORDER BY avg_consistency DESC
      LIMIT 20
    `);
    
    const coverage = coverageAnalysis.rows[0];
    const totalReviews = totalReviewsResult.rows[0];
    const systemHealth = systemHealthMetrics.rows[0];
    const qualityDist = qualityDistribution.rows[0];
    const reviewCons = reviewConsistency.rows[0];
    
    const response = {
      coverage_analysis: {
        total_submissions: parseInt(coverage.total_submissions || 0),
        total_reviews: parseInt(totalReviews.total_reviews || 0),
        avg_reviews_per_submission: parseFloat(Number(coverage.avg_reviews_per_submission || 0).toFixed(2)),
        well_reviewed: parseInt(coverage.well_reviewed || 0),
        under_reviewed: parseInt(coverage.under_reviewed || 0),
        no_reviews: parseInt(coverage.no_reviews || 0),
        review_distribution: {}
      },
      top_quality_reviewers: topQualityReviewers.rows.map(reviewer => ({
        reviewer_id: reviewer.reviewer_id,
        reviewer_types: ['experienced'],
        review_count: reviewer.review_count,
        avg_rating: parseFloat(Number(reviewer.avg_rating || 0).toFixed(2)),
        consistency_score: parseFloat(Number(reviewer.consistency_score || 0).toFixed(1)),
        engagement_score: parseFloat(Number(reviewer.engagement_score || 0).toFixed(1)),
        experience_score: parseFloat(Number(reviewer.experience_score || 0).toFixed(1)),
        confidence_score: parseFloat(Number(reviewer.confidence_score || 0).toFixed(1)),
        overall_quality_score: parseFloat(Number(reviewer.overall_quality_score || 0).toFixed(1))
      })),
      paper_quality_analysis: paperQualityAnalysis.rows.map(paper => ({
        submission_id: paper.submission_id,
        submission_number: paper.submission_number,
        type: paper.type,
        review_count: paper.review_count,
        avg_rating: paper.avg_rating,
        rating_std: paper.rating_std,
        rating_range: 0, // Placeholder
        avg_confidence: paper.avg_confidence,
        quality_indicators: {
          high_disagreement: paper.rating_std > 2,
          wide_range: paper.rating_std > 2,
          low_confidence: paper.avg_confidence < 3,
          high_agreement: paper.rating_std < 1,
          narrow_range: paper.rating_std < 1,
          high_confidence: paper.avg_confidence > 4
        }
      })),
      system_health_metrics: {
        reviewer_diversity: {
          total_unique_reviewers: parseInt(systemHealth.total_unique_reviewers || 0),
          active_reviewers: parseInt(systemHealth.active_reviewers || 0),
          expert_reviewers: parseInt(systemHealth.expert_reviewers || 0)
        },
        quality_distribution: {
          high_quality_reviewers: parseInt(qualityDist.high_quality_reviewers || 0),
          medium_quality_reviewers: parseInt(qualityDist.medium_quality_reviewers || 0),
          improvement_needed_reviewers: parseInt(qualityDist.improvement_needed_reviewers || 0)
        },
        review_consistency: {
          highly_consistent_papers: parseInt(reviewCons.highly_consistent_papers || 0),
          disputed_papers: parseInt(reviewCons.disputed_papers || 0),
          consistency_ratio: parseFloat(Number(reviewCons.consistency_ratio || 0).toFixed(2))
        }
      },
      regional_quality_comparison: regionalQualityComparison.rows.map(region => ({
        nationality: region.nationality,
        reviewer_count: parseInt(region.reviewer_count || 0),
        avg_reviews_per_reviewer: parseFloat(Number(region.avg_reviews_per_reviewer || 0).toFixed(1)),
        avg_rating_given: parseFloat(Number(region.avg_rating_given || 0).toFixed(2)),
        avg_confidence: parseFloat(Number(region.avg_confidence || 0).toFixed(2)),
        avg_consistency: parseFloat(Number(region.avg_consistency || 0).toFixed(1)),
        quality_tier: region.quality_tier
      })),
      metadata: {
        analysis_timestamp: new Date().toISOString(),
        data_quality: 'Comprehensive analysis based on Neon database',
        data_source: 'neon_database'
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze quality data from database', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}