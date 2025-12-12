import { Pool } from 'pg';

let pool;

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function to get reviews with pagination
export async function getReviews(limit = 100, offset = 0, filters = {}) {
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // Add filters
  if (filters.minRating) {
    whereConditions.push(`rating >= $${paramIndex}`);
    queryParams.push(filters.minRating);
    paramIndex++;
  }

  if (filters.maxRating) {
    whereConditions.push(`rating <= $${paramIndex}`);
    queryParams.push(filters.maxRating);
    paramIndex++;
  }

  if (filters.minConfidence) {
    whereConditions.push(`confidence >= $${paramIndex}`);
    queryParams.push(filters.minConfidence);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  queryParams.push(limit, offset);
  
  const queryText = `
    SELECT 
      r.*,
      p.name as reviewer_name,
      p.nationality as reviewer_nationality,
      p.gender as reviewer_gender
    FROM reviews r
    LEFT JOIN people p ON r.reviewer_id = p.person_id
    ${whereClause}
    ORDER BY r.submission_number, r.review_id
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  return await query(queryText, queryParams);
}

// Helper function to get people with pagination
export async function getPeople(limit = 100, offset = 0, filters = {}) {
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  if (filters.nationality) {
    whereConditions.push(`nationality = $${paramIndex}`);
    queryParams.push(filters.nationality);
    paramIndex++;
  }

  if (filters.gender) {
    whereConditions.push(`gender = $${paramIndex}`);
    queryParams.push(filters.gender);
    paramIndex++;
  }

  if (filters.roles && filters.roles.length > 0) {
    whereConditions.push(`roles && $${paramIndex}::text[]`);
    queryParams.push(filters.roles);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  queryParams.push(limit, offset);
  
  const queryText = `
    SELECT * FROM people
    ${whereClause}
    ORDER BY person_id
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  return await query(queryText, queryParams);
}

// Helper function to get institutions with pagination
export async function getInstitutions(limit = 100, offset = 0, filters = {}) {
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  if (filters.country) {
    whereConditions.push(`country = $${paramIndex}`);
    queryParams.push(filters.country);
    paramIndex++;
  }

  if (filters.type) {
    whereConditions.push(`type = $${paramIndex}`);
    queryParams.push(filters.type);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  queryParams.push(limit, offset);
  
  const queryText = `
    SELECT * FROM institutions
    ${whereClause}
    ORDER BY institution_name
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  return await query(queryText, queryParams);
}

// Get aggregated statistics
export async function getStatistics() {
  const statsQuery = `
    SELECT 
      (SELECT COUNT(*) FROM reviews) as total_reviews,
      (SELECT COUNT(*) FROM people) as total_people,
      (SELECT COUNT(*) FROM institutions) as total_institutions,
      (SELECT AVG(rating) FROM reviews WHERE rating IS NOT NULL) as avg_rating,
      (SELECT AVG(confidence) FROM reviews WHERE confidence IS NOT NULL) as avg_confidence,
      (SELECT COUNT(DISTINCT reviewer_id) FROM reviews WHERE reviewer_id IS NOT NULL) as total_reviewers,
      (SELECT COUNT(DISTINCT submission_number) FROM reviews) as total_submissions
  `;
  
  const result = await query(statsQuery);
  return result.rows[0];
}

// Get top countries by reviewer count
export async function getTopCountries(limit = 10) {
  const queryText = `
    SELECT 
      nationality as country,
      COUNT(*) as reviewer_count,
      AVG(CASE WHEN 'reviewer' = ANY(roles) THEN 1.0 ELSE 0.0 END) as reviewer_ratio
    FROM people 
    WHERE nationality IS NOT NULL AND nationality != 'Unknown'
    GROUP BY nationality
    ORDER BY reviewer_count DESC
    LIMIT $1
  `;
  
  return await query(queryText, [limit]);
}

// Get reviewer statistics
export async function getReviewerStats() {
  const queryText = `
    SELECT 
      r.reviewer_id,
      p.name,
      p.nationality,
      p.gender,
      COUNT(*) as review_count,
      AVG(r.rating) as avg_rating,
      STDDEV(r.rating) as rating_std,
      AVG(r.confidence) as avg_confidence,
      MIN(r.rating) as min_rating,
      MAX(r.rating) as max_rating
    FROM reviews r
    JOIN people p ON r.reviewer_id = p.person_id
    WHERE r.rating IS NOT NULL
    GROUP BY r.reviewer_id, p.name, p.nationality, p.gender
    HAVING COUNT(*) >= 3
    ORDER BY review_count DESC
  `;
  
  return await query(queryText);
}

export default { getPool, query, getReviews, getPeople, getInstitutions, getStatistics, getTopCountries, getReviewerStats };