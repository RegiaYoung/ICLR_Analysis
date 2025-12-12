-- Create missing tables to support full search functionality
-- Based on analysis of reviews.json and people.json structure

-- 1. Submission Authors Table
-- Links people (authors) to the papers they authored
CREATE TABLE IF NOT EXISTS submission_authors (
    id SERIAL PRIMARY KEY,
    submission_number INTEGER NOT NULL,
    author_id VARCHAR(255) NOT NULL,  -- person_id from people.json
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Submission Reviews Table  
-- Links people (reviewers) to the papers they reviewed
CREATE TABLE IF NOT EXISTS submission_reviews (
    id SERIAL PRIMARY KEY,
    submission_number INTEGER NOT NULL,
    reviewer_id VARCHAR(255) NOT NULL,  -- person_id from people.json
    review_id VARCHAR(255),  -- review_id from reviews.json
    rating INTEGER,
    confidence INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Review Details Table
-- Detailed review content and scores
CREATE TABLE IF NOT EXISTS review_details (
    id SERIAL PRIMARY KEY,
    review_id VARCHAR(255) NOT NULL UNIQUE,
    submission_number INTEGER NOT NULL,
    reviewer_id VARCHAR(255) NOT NULL,
    reviewer_profile_url TEXT,
    signature TEXT,
    rating INTEGER,
    confidence INTEGER,
    summary TEXT,
    strengths TEXT,
    weaknesses TEXT,
    questions TEXT,
    soundness INTEGER,  -- 1-4 scale
    presentation INTEGER,  -- 1-4 scale
    contribution INTEGER,  -- 1-4 scale
    flag_for_ethics_review JSONB,
    code_of_conduct VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_submission_authors_submission ON submission_authors(submission_number);
CREATE INDEX IF NOT EXISTS idx_submission_authors_author ON submission_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission ON submission_reviews(submission_number);
CREATE INDEX IF NOT EXISTS idx_submission_reviews_reviewer ON submission_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_details_submission ON review_details(submission_number);
CREATE INDEX IF NOT EXISTS idx_review_details_reviewer ON review_details(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_details_review_id ON review_details(review_id);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submission_authors_composite ON submission_authors(author_id, submission_number);
CREATE INDEX IF NOT EXISTS idx_submission_reviews_composite ON submission_reviews(reviewer_id, submission_number);

-- Add foreign key constraints (optional, but good practice)
-- Note: These assume the submissions table exists with submission_number as a key
-- ALTER TABLE submission_authors ADD CONSTRAINT fk_submission_authors_submission 
--     FOREIGN KEY (submission_number) REFERENCES submissions(submission_number);
-- ALTER TABLE submission_reviews ADD CONSTRAINT fk_submission_reviews_submission 
--     FOREIGN KEY (submission_number) REFERENCES submissions(submission_number);
-- ALTER TABLE review_details ADD CONSTRAINT fk_review_details_submission 
--     FOREIGN KEY (submission_number) REFERENCES submissions(submission_number);

COMMENT ON TABLE submission_authors IS 'Maps authors to their submitted papers based on people.json authored_papers array';
COMMENT ON TABLE submission_reviews IS 'Maps reviewers to papers they reviewed based on people.json reviewed_papers array';
COMMENT ON TABLE review_details IS 'Detailed review content and scores from reviews.json';