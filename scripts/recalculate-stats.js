const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

/**
 * 重新计算ICLR评审统计数据
 * 基于review-data/下的原始数据文件
 */

function readJsonFile(filepath) {
  try {
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error.message);
    return null;
  }
}

function calculateReviewerStats(reviewsData, peopleData) {
  const reviewerStats = {};
  
  console.log('计算审稿人统计数据...');
  
  // 遍历所有评审数据
  for (const [submissionId, submissionData] of Object.entries(reviewsData.reviews || {})) {
    if (!submissionData.reviews) continue;
    
    for (const review of submissionData.reviews) {
      const reviewerId = review.reviewer_id;
      if (!reviewerId) continue;
      
      if (!reviewerStats[reviewerId]) {
        reviewerStats[reviewerId] = {
          reviewer_id: reviewerId,
          review_count: 0,
          ratings: [],
          confidences: [],
          text_lengths: [],
          has_questions: 0,
          total_reviews: 0
        };
      }
      
      const stats = reviewerStats[reviewerId];
      stats.review_count++;
      stats.total_reviews++;
      
      // 评分数据
      if (review.rating !== null && review.rating !== undefined) {
        stats.ratings.push(parseFloat(review.rating));
      }
      
      // 置信度数据  
      if (review.confidence !== null && review.confidence !== undefined) {
        stats.confidences.push(parseFloat(review.confidence));
      }
      
      // 文本长度
      const textLength = (review.summary || '').length + (review.strengths || '').length + (review.weaknesses || '').length;
      stats.text_lengths.push(textLength);
      
      // 是否有问题
      if (review.questions && review.questions.trim().length > 0) {
        stats.has_questions++;
      }
    }
  }
  
  // 计算统计指标
  const processedStats = [];
  for (const [reviewerId, stats] of Object.entries(reviewerStats)) {
    if (stats.review_count === 0) continue;
    
    const avgRating = stats.ratings.length > 0 ? 
      stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length : 0;
    
    const avgConfidence = stats.confidences.length > 0 ?
      stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length : 0;
    
    const avgTextLength = stats.text_lengths.length > 0 ?
      stats.text_lengths.reduce((a, b) => a + b, 0) / stats.text_lengths.length : 0;
    
    const ratingStd = calculateStandardDeviation(stats.ratings);
    const questionRatio = stats.has_questions / stats.total_reviews;
    
    processedStats.push({
      reviewer_id: reviewerId,
      review_count: stats.review_count,
      avg_rating: parseFloat(avgRating.toFixed(2)),
      avg_confidence: parseFloat(avgConfidence.toFixed(2)),
      avg_text_length: Math.round(avgTextLength),
      rating_std: parseFloat(ratingStd.toFixed(3)),
      question_ratio: parseFloat(questionRatio.toFixed(3)),
      institution: peopleData.people[reviewerId]?.institutions?.[0] || 'Unknown'
    });
  }
  
  return processedStats;
}

function calculateStandardDeviation(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

function calculateSubmissionStats(reviewsData) {
  const submissionStats = [];
  
  console.log('计算论文统计数据...');
  
  for (const [submissionId, submissionData] of Object.entries(reviewsData.reviews || {})) {
    if (!submissionData.reviews || submissionData.reviews.length === 0) continue;
    
    const ratings = submissionData.reviews
      .map(r => parseFloat(r.rating))
      .filter(r => !isNaN(r));
    
    const confidences = submissionData.reviews
      .map(r => parseFloat(r.confidence))  
      .filter(c => !isNaN(c));
    
    if (ratings.length === 0) continue;
    
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const ratingStd = calculateStandardDeviation(ratings);
    const avgConfidence = confidences.length > 0 ?
      confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    
    // 检查伦理标记
    const hasEthicsFlag = submissionData.reviews.some(r => 
      r.ethics_flag === 'Yes' || r.ethics_flag === 'yes' || r.ethics_flag === true
    );
    
    submissionStats.push({
      submission_id: submissionId,
      submission_number: submissionData.submission_number || submissionId,
      review_count: submissionData.reviews.length,
      avg_rating: parseFloat(avgRating.toFixed(2)),
      rating_std: parseFloat(ratingStd.toFixed(3)),
      avg_confidence: parseFloat(avgConfidence.toFixed(2)),
      ethics_flag: hasEthicsFlag ? 1 : 0
    });
  }
  
  return submissionStats;
}

function calculateInstitutionStats(peopleData, institutionsData) {
  const institutionStats = {};
  
  console.log('计算机构统计数据...');
  
  // 从people数据中统计机构
  for (const [personId, personData] of Object.entries(peopleData.people || {})) {
    const institutions = personData.institutions || [];
    
    institutions.forEach(institution => {
      if (!institutionStats[institution]) {
        institutionStats[institution] = {
          institution_name: institution,
          total_members: 0,
          author_count: 0,
          reviewer_count: 0,
          country: 'Unknown',
          institution_type: 'Unknown'
        };
      }
      
      institutionStats[institution].total_members++;
      
      if (personData.role && personData.role.includes('author')) {
        institutionStats[institution].author_count++;
      }
      
      if (personData.role && personData.role.includes('reviewer')) {
        institutionStats[institution].reviewer_count++;
      }
    });
  }
  
  // 从institutions数据中补充信息
  if (institutionsData && institutionsData.institutions) {
    institutionsData.institutions.forEach(inst => {
      if (institutionStats[inst.institution_name]) {
        institutionStats[inst.institution_name].country = inst.country || 'Unknown';
        institutionStats[inst.institution_name].institution_type = inst.institution_type || 'Unknown';
      }
    });
  }
  
  return Object.values(institutionStats);
}

function generateTopLists(reviewerStats, submissionStats) {
  console.log('生成排行榜数据...');
  
  const topLists = {
    // 最宽松的审稿人 (高平均评分)
    most_lenient: reviewerStats
      .filter(r => r.review_count >= 5)
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 20),
    
    // 最严格的审稿人 (低平均评分)  
    most_strict: reviewerStats
      .filter(r => r.review_count >= 5)
      .sort((a, b) => a.avg_rating - b.avg_rating)
      .slice(0, 20),
    
    // 最不稳定的审稿人 (高评分标准差)
    most_volatile: reviewerStats
      .filter(r => r.review_count >= 5)
      .sort((a, b) => b.rating_std - a.rating_std)
      .slice(0, 20),
    
    // 最稳定的审稿人 (低评分标准差)
    most_stable: reviewerStats
      .filter(r => r.review_count >= 5)
      .sort((a, b) => a.rating_std - b.rating_std)
      .slice(0, 20),
    
    // 文本最长的审稿人
    longest_texts: reviewerStats
      .filter(r => r.review_count >= 3)
      .sort((a, b) => b.avg_text_length - a.avg_text_length)
      .slice(0, 20),
    
    // 问题最多的审稿人
    most_questions: reviewerStats
      .filter(r => r.review_count >= 3)
      .sort((a, b) => b.question_ratio - a.question_ratio)
      .slice(0, 20),
    
    // 最有争议的论文 (高评分标准差)
    most_disputed_papers: submissionStats
      .filter(s => s.review_count >= 3)
      .sort((a, b) => b.rating_std - a.rating_std)
      .slice(0, 50),
    
    // 最一致的论文 (低评分标准差)
    most_consistent_papers: submissionStats
      .filter(s => s.review_count >= 3)
      .sort((a, b) => a.rating_std - b.rating_std)
      .slice(0, 50),
    
    // 伦理标记的论文
    ethics_flagged_submissions: submissionStats
      .filter(s => s.ethics_flag > 0)
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 30),
    
    // 常见作者 (这里我们用最活跃的审稿人代替)
    repeat_authors: reviewerStats
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 50)
      .map(r => ({
        author_id: r.reviewer_id,
        submissions: r.review_count
      }))
  };
  
  return topLists;
}

async function main() {
  console.log('开始重新计算ICLR统计数据...\n');
  
  // 读取原始数据文件
  const reviewsPath = path.join(process.cwd(), 'review-data', 'reviews.json');
  const peoplePath = path.join(process.cwd(), 'review-data', 'people.json');
  const institutionsPath = path.join(process.cwd(), 'review-data', 'institutions.json');
  
  console.log('加载数据文件...');
  const reviewsData = readJsonFile(reviewsPath);
  const peopleData = readJsonFile(peoplePath);
  const institutionsData = readJsonFile(institutionsPath);
  
  if (!reviewsData || !peopleData) {
    console.error('无法加载必要的数据文件');
    return;
  }
  
  console.log(`已加载: ${Object.keys(reviewsData.reviews || {}).length} 个论文评审`);
  console.log(`已加载: ${Object.keys(peopleData.people || {}).length} 个人员数据`);
  console.log(`已加载: ${institutionsData?.institutions?.length || 0} 个机构数据\n`);
  
  // 计算统计数据
  const reviewerStats = calculateReviewerStats(reviewsData, peopleData);
  const submissionStats = calculateSubmissionStats(reviewsData);
  const institutionStats = calculateInstitutionStats(peopleData, institutionsData);
  
  console.log(`计算完成: ${reviewerStats.length} 个审稿人统计`);
  console.log(`计算完成: ${submissionStats.length} 个论文统计`);
  console.log(`计算完成: ${institutionStats.length} 个机构统计\n`);
  
  // 生成排行榜
  const topLists = generateTopLists(reviewerStats, submissionStats);
  
  // 保存结果
  const outputDir = path.join(process.cwd(), 'calculated-stats');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  console.log('保存计算结果...');
  
  // 保存各类数据
  fs.writeFileSync(
    path.join(outputDir, 'reviewer_stats.json'),
    JSON.stringify({
      metadata: {
        total_reviewers: reviewerStats.length,
        calculation_date: new Date().toISOString()
      },
      reviewers: reviewerStats
    }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, 'submission_stats.json'),
    JSON.stringify({
      metadata: {
        total_submissions: submissionStats.length,
        calculation_date: new Date().toISOString()
      },
      submissions: submissionStats
    }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, 'institution_stats.json'),
    JSON.stringify({
      metadata: {
        total_institutions: institutionStats.length,
        calculation_date: new Date().toISOString()
      },
      institutions: institutionStats
    }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, 'top_lists.json'),
    JSON.stringify({
      metadata: {
        calculation_date: new Date().toISOString(),
        list_descriptions: {
          most_lenient: 'Top 20 most lenient reviewers (highest avg rating)',
          most_strict: 'Top 20 most strict reviewers (lowest avg rating)', 
          most_volatile: 'Top 20 most volatile reviewers (highest rating std)',
          most_stable: 'Top 20 most stable reviewers (lowest rating std)',
          longest_texts: 'Top 20 reviewers with longest review texts',
          most_questions: 'Top 20 reviewers asking most questions',
          most_disputed_papers: 'Top 50 most disputed papers (highest rating std)',
          most_consistent_papers: 'Top 50 most consistent papers (lowest rating std)',
          ethics_flagged_submissions: 'Papers with ethics flags',
          repeat_authors: 'Most frequent reviewers/authors'
        }
      },
      ...topLists
    }, null, 2)
  );
  
  // 生成汇总报告
  const summaryReport = {
    metadata: {
      calculation_date: new Date().toISOString(),
      data_source: 'review-data/*.json files'
    },
    summary: {
      total_reviews: Object.values(reviewsData.reviews || {}).reduce((sum, sub) => 
        sum + (sub.reviews ? sub.reviews.length : 0), 0),
      total_submissions: Object.keys(reviewsData.reviews || {}).length,
      total_reviewers: reviewerStats.length,
      total_people: Object.keys(peopleData.people || {}).length,
      total_institutions: institutionStats.length,
      avg_reviews_per_submission: parseFloat((
        Object.values(reviewsData.reviews || {}).reduce((sum, sub) => 
          sum + (sub.reviews ? sub.reviews.length : 0), 0) /
        Math.max(Object.keys(reviewsData.reviews || {}).length, 1)
      ).toFixed(2)),
      submissions_with_ethics_flags: submissionStats.filter(s => s.ethics_flag > 0).length
    },
    top_list_counts: {
      most_lenient: topLists.most_lenient.length,
      most_strict: topLists.most_strict.length,
      most_volatile: topLists.most_volatile.length,
      most_stable: topLists.most_stable.length,
      longest_texts: topLists.longest_texts.length,
      most_questions: topLists.most_questions.length,
      most_disputed_papers: topLists.most_disputed_papers.length,
      most_consistent_papers: topLists.most_consistent_papers.length,
      ethics_flagged_submissions: topLists.ethics_flagged_submissions.length,
      repeat_authors: topLists.repeat_authors.length
    }
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'summary_report.json'),
    JSON.stringify(summaryReport, null, 2)
  );
  
  console.log(`\n✓ 计算完成! 结果已保存到 ${outputDir}/`);
  console.log('文件列表:');
  console.log('  - reviewer_stats.json (审稿人统计)');
  console.log('  - submission_stats.json (论文统计)');
  console.log('  - institution_stats.json (机构统计)');
  console.log('  - top_lists.json (排行榜数据)');
  console.log('  - summary_report.json (汇总报告)');
  
  console.log('\n数据概览:');
  console.log(`  总评审数: ${summaryReport.summary.total_reviews}`);
  console.log(`  总论文数: ${summaryReport.summary.total_submissions}`);
  console.log(`  总审稿人: ${summaryReport.summary.total_reviewers}`);
  console.log(`  总人员数: ${summaryReport.summary.total_people}`);
  console.log(`  总机构数: ${summaryReport.summary.total_institutions}`);
  console.log(`  平均每篇论文评审数: ${summaryReport.summary.avg_reviews_per_submission}`);
  console.log(`  有伦理标记的论文: ${summaryReport.summary.submissions_with_ethics_flags}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  calculateReviewerStats,
  calculateSubmissionStats,
  calculateInstitutionStats,
  generateTopLists
};