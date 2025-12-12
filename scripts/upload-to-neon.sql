-- Script to create optimized tables and upload calculated stats to Neon database
-- Run this when database connection is available

-- 1. Clean up unnecessary tables
DROP TABLE IF EXISTS verification CASCADE;
DROP TABLE IF EXISTS reviews_summary CASCADE; 
DROP TABLE IF EXISTS submission_reviews CASCADE;
DROP TABLE IF EXISTS conflicts CASCADE;
DROP TABLE IF EXISTS paper_authorship CASCADE;

-- 2. Ensure core tables have proper structure
CREATE TABLE IF NOT EXISTS people (
  person_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT,
  gender TEXT,
  country TEXT,
  institutions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_people_role ON people(role);
CREATE INDEX IF NOT EXISTS idx_people_country ON people(country);

CREATE TABLE IF NOT EXISTS institutions (
  institution_name TEXT PRIMARY KEY,
  country TEXT,
  institution_type TEXT,
  total_members INTEGER DEFAULT 0,
  author_count INTEGER DEFAULT 0,
  reviewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_institutions_country ON institutions(country);
CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(institution_type);

-- 3. Create statistics tables
CREATE TABLE IF NOT EXISTS reviewer_statistics (
  reviewer_id TEXT PRIMARY KEY,
  review_count INTEGER,
  avg_rating DECIMAL(4,2),
  avg_confidence DECIMAL(4,2),
  avg_text_length INTEGER,
  rating_std DECIMAL(5,3),
  question_ratio DECIMAL(4,3),
  institution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviewer_stats_count ON reviewer_statistics(review_count);
CREATE INDEX IF NOT EXISTS idx_reviewer_stats_rating ON reviewer_statistics(avg_rating);
CREATE INDEX IF NOT EXISTS idx_reviewer_stats_std ON reviewer_statistics(rating_std);

CREATE TABLE IF NOT EXISTS submission_statistics (
  submission_id TEXT PRIMARY KEY,
  submission_number TEXT,
  review_count INTEGER,
  avg_rating DECIMAL(4,2),
  rating_std DECIMAL(5,3),
  avg_confidence DECIMAL(4,2),
  ethics_flag INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submission_stats_std ON submission_statistics(rating_std);
CREATE INDEX IF NOT EXISTS idx_submission_ethics ON submission_statistics(ethics_flag);

-- 4. Create top lists table
CREATE TABLE IF NOT EXISTS top_lists (
  list_type TEXT,
  rank INTEGER,
  item_id TEXT,
  item_data JSONB,
  PRIMARY KEY (list_type, rank)
);

CREATE INDEX IF NOT EXISTS idx_top_lists_type ON top_lists(list_type);

-- After creating tables, you need to run the Node.js upload script:
-- node scripts/optimize-database.js
-- 
-- This will:
-- 1. Import reviewer_statistics from calculated-stats/reviewer_stats.json
-- 2. Import submission_statistics from calculated-stats/submission_stats.json  
-- 3. Import institution data from calculated-stats/institution_stats.json
-- 4. Import top_lists from calculated-stats/top_lists.json
--
-- Example data counts you should see after import:
-- reviewer_statistics: ~13,560 rows
-- submission_statistics: ~7,655 rows
-- institutions: updated with calculated data
-- top_lists: ~270 rows (10 list types with varying counts)
--
-- To verify data import success:
-- SELECT list_type, COUNT(*) FROM top_lists GROUP BY list_type;
-- SELECT COUNT(*) FROM reviewer_statistics;
-- SELECT COUNT(*) FROM submission_statistics;