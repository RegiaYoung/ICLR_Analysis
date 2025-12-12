import fs from "fs";
import readline from "readline";
import path from "path";

class ReviewerAnalyzer {
  constructor() {
    this.reviewerData = new Map();
  }

  parseNumeric(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const m = val.match(/-?\d+(\.\d+)?/);
      if (m) return parseFloat(m[0]);
    }
    return null;
  }

  addReview(reviewerId, review, submissionData) {
    if (!this.reviewerData.has(reviewerId)) {
      this.reviewerData.set(reviewerId, {
        reviewer_id: reviewerId,
        profile_url: review.reviewer_profile_url || `https://openreview.net/profile?id=${encodeURIComponent(reviewerId)}`,
        reviews: [],
        ratings: [],
        confidences: [],
        text_lengths: [],
        question_lengths: [],
        sub_scores: {
          soundness: [],
          presentation: [],
          contribution: []
        },
        ethics_flags: 0
      });
    }

    const data = this.reviewerData.get(reviewerId);
    
    // Extract basic metrics from compressed format
    const rating = this.parseNumeric(review.rating);
    const confidence = this.parseNumeric(review.confidence);
    
    if (rating !== null) data.ratings.push(rating);
    if (confidence !== null) data.confidences.push(confidence);
    
    // Use pre-calculated word counts from compressed format
    const totalWords = review.total_text_words || 0;
    const questionWords = review.questions_words || 0;
    
    data.text_lengths.push(totalWords);
    data.question_lengths.push(questionWords);
    
    // Sub-scores are not available in compressed format
    // Keep the structure for compatibility but don't populate
    
    // Ethics flags
    if (review.has_ethics_flag) {
      data.ethics_flags++;
    }
    
    data.reviews.push({
      submission_number: submissionData.submission_number,
      rating,
      confidence,
      text_words: totalWords,
      question_words: questionWords
    });
  }

  calculateStats() {
    const results = [];
    
    for (const [reviewerId, data] of this.reviewerData.entries()) {
      if (data.ratings.length === 0) continue;
      
      const stats = {
        reviewer_id: reviewerId,
        profile_url: data.profile_url,
        reviews: data.ratings.length,
        avg_rating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
        median_rating: this.median(data.ratings),
        min_rating: Math.min(...data.ratings),
        max_rating: Math.max(...data.ratings),
        rating_std: data.ratings.length > 1 ? this.standardDeviation(data.ratings) : null,
        avg_confidence: data.confidences.length > 0 ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length : null,
        avg_text_words: data.text_lengths.length > 0 ? data.text_lengths.reduce((a, b) => a + b, 0) / data.text_lengths.length : 0,
        avg_questions_words: data.question_lengths.length > 0 ? data.question_lengths.reduce((a, b) => a + b, 0) / data.question_lengths.length : 0,
        ethics_flags: data.ethics_flags,
        avg_sub_scores: {
          soundness: data.sub_scores.soundness.length > 0 ? data.sub_scores.soundness.reduce((a, b) => a + b, 0) / data.sub_scores.soundness.length : null,
          presentation: data.sub_scores.presentation.length > 0 ? data.sub_scores.presentation.reduce((a, b) => a + b, 0) / data.sub_scores.presentation.length : null,
          contribution: data.sub_scores.contribution.length > 0 ? data.sub_scores.contribution.reduce((a, b) => a + b, 0) / data.sub_scores.contribution.length : null
        }
      };
      
      results.push(stats);
    }
    
    return results;
  }

  median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  standardDeviation(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  generateRankings(minReviews = 3) {
    const allStats = this.calculateStats().filter(reviewer => reviewer.reviews >= minReviews);
    
    return {
      lenient_reviewers: [...allStats]
        .sort((a, b) => b.avg_rating - a.avg_rating)
        .slice(0, 200),
      
      strict_reviewers: [...allStats]
        .sort((a, b) => a.avg_rating - b.avg_rating)
        .slice(0, 200),
      
      volatile_reviewers: [...allStats]
        .filter(r => r.rating_std !== null)
        .sort((a, b) => b.rating_std - a.rating_std)
        .slice(0, 200),
      
      steady_reviewers: [...allStats]
        .filter(r => r.rating_std !== null)
        .sort((a, b) => a.rating_std - b.rating_std)
        .slice(0, 200),
      
      wordiest_reviewers: [...allStats]
        .sort((a, b) => b.avg_text_words - a.avg_text_words)
        .slice(0, 200),
      
      question_heavy_reviewers: [...allStats]
        .sort((a, b) => b.avg_questions_words - a.avg_questions_words)
        .slice(0, 200)
    };
  }

  async analyzeFromFile(filePath, minReviews = 3) {
    console.log(`Starting analysis with minReviews=${minReviews}...`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found: ${filePath}`);
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let processedCount = 0;
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const submission = JSON.parse(line);
        if (!submission.reviews || !Array.isArray(submission.reviews)) continue;
        
        for (const review of submission.reviews) {
          if (!review.reviewer_id) continue;
          
          this.addReview(review.reviewer_id, review, {
            submission_number: submission.submission_number,
            ethics_flags: submission.ethics_flags || 0
          });
        }
        
        processedCount++;
        if (processedCount % 1000 === 0) {
          console.log(`Processed ${processedCount} submissions...`);
        }
        
      } catch (error) {
        console.error(`Error processing line: ${error.message}`);
        continue;
      }
    }
    
    console.log(`Analysis complete. Processed ${processedCount} submissions.`);
    console.log(`Found ${this.reviewerData.size} unique reviewers.`);
    
    return this.generateRankings(minReviews);
  }
}

export default ReviewerAnalyzer;