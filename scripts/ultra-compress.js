#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Only keep essential data for reviewer analysis
function ultraCompressReview(review) {
  return {
    reviewer_id: review.reviewer_id,
    rating: review.rating?.value || null,
    confidence: review.confidence?.value || null,
    // Calculate text metrics instead of storing full text
    summary_words: review.content?.summary?.value ? review.content.summary.value.split(/\s+/).length : 0,
    strengths_words: review.content?.strengths?.value ? review.content.strengths.value.split(/\s+/).length : 0,
    weaknesses_words: review.content?.weaknesses?.value ? review.content.weaknesses.value.split(/\s+/).length : 0,
    questions_words: review.content?.questions?.value ? review.content.questions.value.split(/\s+/).length : 0,
    total_text_words: 0, // Will be calculated below
    has_ethics_flag: review.content?.flag_for_ethics_review?.value?.[0] !== 'No ethics review needed.'
  };
}

function ultraCompressSubmission(submission) {
  const reviews = submission.reviews ? submission.reviews.map(ultraCompressReview) : [];
  
  // Calculate total text words for each review
  reviews.forEach(review => {
    review.total_text_words = review.summary_words + review.strengths_words + 
                             review.weaknesses_words + review.questions_words;
  });
  
  return {
    submission_number: submission.submission_number,
    submission_id: submission.submission_id,
    author_count: submission.authors ? submission.authors.length : 0,
    reviews: reviews,
    review_count: reviews.length,
    ethics_flags: reviews.filter(r => r.has_ethics_flag).length
  };
}

async function ultraOptimizeDataset() {
  const inputFile = path.join(process.cwd(), 'review-data', 'search_dataset_original.jsonl');
  const outputFile = path.join(process.cwd(), 'review-data', 'search_dataset.jsonl');
  
  console.log('Reading original file...');
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.trim().split('\n');
  
  console.log(`Ultra-compressing ${lines.length} submissions...`);
  
  const outputLines = [];
  let originalSize = 0;
  let compressedSize = 0;
  
  for (const line of lines) {
    if (line.trim()) {
      const submission = JSON.parse(line);
      const compressed = ultraCompressSubmission(submission);
      
      const originalJson = JSON.stringify(submission);
      const compressedJson = JSON.stringify(compressed);
      
      originalSize += originalJson.length;
      compressedSize += compressedJson.length;
      
      outputLines.push(compressedJson);
    }
  }
  
  console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Ultra-compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Compression ratio: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%`);
  
  fs.writeFileSync(outputFile, outputLines.join('\n') + '\n');
  console.log(`Ultra-compressed dataset saved to: ${outputFile}`);
  
  // Verify the new file size
  const stats = fs.statSync(outputFile);
  const fileSizeMB = stats.size / 1024 / 1024;
  console.log(`Actual file size: ${fileSizeMB.toFixed(2)} MB`);
  
  if (fileSizeMB < 100) {
    console.log('✅ File size is now under 100MB Vercel limit!');
  } else {
    console.log('❌ File is still too large for Vercel');
  }
}

ultraOptimizeDataset().catch(console.error);