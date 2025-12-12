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
    
    // Get sample submission numbers
    const submissions = await client.query(`
      SELECT submission_number, submission_id, submission_type 
      FROM submissions 
      WHERE submission_number IS NOT NULL 
      ORDER BY submission_number 
      LIMIT 10
    `);
    
    // Get sample people names
    const people = await client.query(`
      SELECT person_id, name 
      FROM people 
      WHERE name IS NOT NULL 
      ORDER BY name 
      LIMIT 10
    `);
    
    // Get some sample reviewers
    const reviewers = await client.query(`
      SELECT reviewer_id, reviews 
      FROM reviewers 
      ORDER BY reviews DESC 
      LIMIT 10
    `);
    
    const response = {
      sample_submissions: submissions.rows,
      sample_people: people.rows,
      sample_reviewers: reviewers.rows,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug data', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}