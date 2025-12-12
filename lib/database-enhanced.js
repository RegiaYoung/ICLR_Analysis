import { Pool } from 'pg';

// Enhanced connection configuration for Neon
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for Neon wake-up
  query_timeout: 30000,
  statement_timeout: 30000,
  // Neon-specific: keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

let pool = new Pool(poolConfig);
let isResetting = false;

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
  if (err.message.includes('password authentication failed') && !isResetting) {
    resetPool();
  }
});

// Reset pool function for connection issues
async function resetPool() {
  if (isResetting) return;
  
  isResetting = true;
  console.log('Resetting database connection pool...');
  
  try {
    await pool.end();
  } catch (err) {
    console.error('Error ending pool:', err);
  }
  
  pool = new Pool(poolConfig);
  isResetting = false;
  console.log('Pool reset complete');
}

// Enhanced query function with retry logic
export async function query(text, params) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // For Neon: First attempt might wake up the database
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Query attempt ${attempt} failed:`, error.message);
      
      // Handle specific Neon errors
      if (error.message.includes('password authentication failed')) {
        console.error('Password authentication failed. Please check Neon dashboard and update DATABASE_URL');
        throw error; // Don't retry auth errors
      }
      
      if (error.message.includes('Connection terminated') || 
          error.message.includes('connect ETIMEDOUT') ||
          error.code === 'ECONNRESET') {
        // Connection issues - might be Neon waking up
        if (attempt < maxRetries) {
          console.log(`Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          
          // Reset pool on repeated connection failures
          if (attempt === 2) {
            await resetPool();
          }
          continue;
        }
      }
      
      // For other errors, fail immediately
      throw error;
    }
  }
  
  throw lastError;
}

// Keep-alive function to prevent Neon suspension
export async function keepAlive() {
  try {
    await query('SELECT 1');
    console.log('Keep-alive query successful');
  } catch (error) {
    console.error('Keep-alive query failed:', error.message);
  }
}

// Set up periodic keep-alive (every 4 minutes)
if (process.env.NODE_ENV === 'production') {
  setInterval(keepAlive, 4 * 60 * 1000);
}

// Get functions with enhanced error handling
export async function getReviews(limit = 100, offset = 0, filters = {}) {
  try {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (filters.minRating) {
      conditions.push(`r.rating >= $${paramIndex}`);
      params.push(filters.minRating);
      paramIndex++;
    }

    if (filters.maxRating) {
      conditions.push(`r.rating <= $${paramIndex}`);
      params.push(filters.maxRating);
      paramIndex++;
    }

    if (filters.confidence) {
      conditions.push(`r.confidence >= $${paramIndex}`);
      params.push(filters.confidence);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const queryText = `
      SELECT 
        r.*,
        p.name as reviewer_name,
        p.nationality,
        p.gender
      FROM reviews r
      LEFT JOIN people p ON r.reviewer_id = p.person_id
      ${whereClause}
      ORDER BY r.submission_number, r.review_id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(queryText, params);
    return result;
  } catch (error) {
    console.error('Error in getReviews:', error);
    throw error;
  }
}

export async function getPeople(limit = 100, offset = 0, filters = {}) {
  try {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.nationality) {
      conditions.push(`nationality = $${paramIndex}`);
      params.push(filters.nationality);
      paramIndex++;
    }

    if (filters.gender) {
      conditions.push(`gender = $${paramIndex}`);
      params.push(filters.gender);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const queryText = `
      SELECT * FROM people
      ${whereClause}
      ORDER BY person_id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(queryText, params);
    return result;
  } catch (error) {
    console.error('Error in getPeople:', error);
    throw error;
  }
}

export async function getInstitutions(limit = 100, offset = 0) {
  try {
    const queryText = `
      SELECT * FROM institutions
      ORDER BY institution_id
      LIMIT $1 OFFSET $2
    `;

    const result = await query(queryText, [limit, offset]);
    return result;
  } catch (error) {
    console.error('Error in getInstitutions:', error);
    throw error;
  }
}

export async function getStatistics() {
  try {
    const queryText = `
      SELECT 
        (SELECT COUNT(*) FROM reviews) as total_reviews,
        (SELECT COUNT(*) FROM people) as total_people,
        (SELECT COUNT(*) FROM institutions) as total_institutions,
        (SELECT COUNT(DISTINCT reviewer_id) FROM reviews) as total_reviewers,
        (SELECT COUNT(DISTINCT submission_number) FROM reviews) as total_submissions,
        (SELECT AVG(rating) FROM reviews) as avg_rating,
        (SELECT AVG(confidence) FROM reviews) as avg_confidence
    `;

    const result = await query(queryText);
    return result.rows[0];
  } catch (error) {
    console.error('Error in getStatistics:', error);
    throw error;
  }
}

export async function getReviewerStats() {
  try {
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

    const result = await query(queryText);
    return result;
  } catch (error) {
    console.error('Error in getReviewerStats:', error);
    throw error;
  }
}

export async function getTopCountries(limit = 10) {
  try {
    const queryText = `
      SELECT 
        p.nationality as country,
        COUNT(DISTINCT p.person_id) as reviewer_count,
        COUNT(DISTINCT p.person_id)::float / (SELECT COUNT(DISTINCT reviewer_id) FROM reviews) as reviewer_ratio
      FROM people p
      JOIN reviews r ON p.person_id = r.reviewer_id
      WHERE p.nationality IS NOT NULL
      GROUP BY p.nationality
      ORDER BY reviewer_count DESC
      LIMIT $1
    `;

    const result = await query(queryText, [limit]);
    return result;
  } catch (error) {
    console.error('Error in getTopCountries:', error);
    throw error;
  }
}

// Test connection function
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as time, current_database() as database');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

export default {
  query,
  getReviews,
  getPeople,
  getInstitutions,
  getStatistics,
  getReviewerStats,
  getTopCountries,
  testConnection,
  keepAlive,
  resetPool
};