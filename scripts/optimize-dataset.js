#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Function to compress review data by removing unnecessary fields
function compressReviewData(review) {
  return {
    reviewer_id: review.reviewer_id,
    rating: review.rating?.value || null,
    confidence: review.confidence?.value || null,
    summary: review.content?.summary?.value || '',
    strengths: review.content?.strengths?.value || '',
    weaknesses: review.content?.weaknesses?.value || '',
    questions: review.content?.questions?.value || '',
    flag_for_ethics_review: review.content?.flag_for_ethics_review?.value?.[0] || 'No ethics review needed.',
    reviewer_profile_url: review.reviewer_profile_url
  };
}

function compressSubmissionData(submission) {
  return {
    submission_number: submission.submission_number,
    submission_id: submission.submission_id,
    // Only keep author IDs, not full profile objects
    authors: submission.authors ? submission.authors.map(a => a.id) : [],
    // Compress review data
    reviews: submission.reviews ? submission.reviews.map(compressReviewData) : [],
    // Keep essential metadata
    submission_url: submission.submission_url,
    submission_phase: submission.submission_phase,
    decision_status: submission.decision_status
  };
}

async function optimizeDataset() {
  const inputFile = path.join(process.cwd(), 'review-data', 'search_dataset.jsonl');
  const outputFile = path.join(process.cwd(), 'review-data', 'search_dataset_optimized.jsonl');
  
  console.log('Reading input file...');
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.trim().split('\n');
  
  console.log(`Processing ${lines.length} submissions...`);
  
  const outputLines = [];
  let originalSize = 0;
  let compressedSize = 0;
  
  for (const line of lines) {
    if (line.trim()) {
      const submission = JSON.parse(line);
      const compressed = compressSubmissionData(submission);
      
      const originalJson = JSON.stringify(submission);
      const compressedJson = JSON.stringify(compressed);
      
      originalSize += originalJson.length;
      compressedSize += compressedJson.length;
      
      outputLines.push(compressedJson);
    }
  }
  
  console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Compression ratio: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%`);
  
  fs.writeFileSync(outputFile, outputLines.join('\n') + '\n');
  console.log(`Optimized dataset saved to: ${outputFile}`);
  
  // Create a backup of the original file
  const backupFile = path.join(process.cwd(), 'review-data', 'search_dataset_original.jsonl');
  fs.copyFileSync(inputFile, backupFile);
  console.log(`Original file backed up to: ${backupFile}`);
  
  // Replace the original with optimized version
  fs.copyFileSync(outputFile, inputFile);
  console.log('Original file replaced with optimized version');
  
  // Clean up
  fs.unlinkSync(outputFile);
}

optimizeDataset().catch(console.error);