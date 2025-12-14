/**
 * 从 review-data 下的 people.json / institutions.json / reviews.json
 * 直接生成 static-analysis-data 所需的静态文件。
 *
 * 使用方式：
 *   node scripts/generate-static-from-json.js
 *
 * 生成文件：
 *   static-analysis-data/
 *     - stats.json
 *     - institutions.json
 *     - reviewers.json
 *     - conflict-analysis.json
 *     - quality-analysis.json
 *     - institution-analysis.json
 *     - reviewer-analysis.json
 */

const fs = require('fs');
const path = require('path');

const REVIEWER_LIMIT = parseInt(process.env.REVIEWER_LIMIT || '200', 10);
const INSTITUTION_LIMIT = parseInt(process.env.INSTITUTION_LIMIT || '200', 10);
const INPUT_DIR = path.join(process.cwd(), 'review-data');
// 默认直接写入前端使用的 static-analysis-data 目录，必要时可以通过 OUTPUT_DIR 环境变量覆盖
const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(process.cwd(), 'static-analysis-data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const safeReadJSON = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const sum = (arr) => arr.reduce((s, v) => s + v, 0);
const std = (arr) => {
  if (arr.length <= 1) return 0;
  const m = mean(arr) || 0;
  const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
};
const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const wordCount = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

function computeQualityScores(reviewer) {
  const consistency_score = reviewer.rating_std
    ? Number((100 - Math.min(30, reviewer.rating_std * 15)).toFixed(1))
    : 100;
  const engagement_score = Math.min(
    100,
    Math.round(((reviewer.avg_text_length || 0) / 30) + (reviewer.review_count || 0) * 3)
  );
  const experience_score = Math.min(100, (reviewer.review_count || 0) * 5);
  const confidence_score = Math.min(100, (reviewer.avg_confidence || 0) * 20);
  const overall_quality_score = Number(
    ((consistency_score + engagement_score + experience_score + confidence_score) / 4).toFixed(1)
  );

  return { consistency_score, engagement_score, experience_score, confidence_score, overall_quality_score };
}

function loadInputs() {
  const people = safeReadJSON(path.join(INPUT_DIR, 'people.json'));
  const institutions = safeReadJSON(path.join(INPUT_DIR, 'institutions.json'));
  const reviews = safeReadJSON(path.join(INPUT_DIR, 'reviews.json'));
  return { people, institutions, reviews };
}

function buildReviewerStats(reviewsData, peopleData) {
  const reviewerMap = new Map();

  Object.values(reviewsData.reviews || {}).forEach((sub) => {
    (sub.reviews || []).forEach((rev) => {
      const id = rev.reviewer_id;
      if (!id) return;
      const entry = reviewerMap.get(id) || {
        reviewer_id: id,
        ratings: [],
        confidences: [],
        textLengths: [],
        questionLengths: [],
        questionCount: 0,
        review_count: 0,
      };
      entry.review_count += 1;
      if (typeof rev.rating === 'number') entry.ratings.push(rev.rating);
      if (typeof rev.confidence === 'number') entry.confidences.push(rev.confidence);
      const content = rev.content || {};
      const textPieces = [content.summary, content.strengths, content.weaknesses].filter(Boolean);
      entry.textLengths.push(wordCount(textPieces.join(' ')));
      entry.questionLengths.push(wordCount(content.questions));
      if (content.questions) entry.questionCount += 1;
      reviewerMap.set(id, entry);
    });
  });

  const reviewers = [];
  reviewerMap.forEach((entry) => {
    const person = peopleData.people?.[entry.reviewer_id] || {};
    const avgRating = mean(entry.ratings);
    const avgConf = mean(entry.confidences);
    const avgTextLength = mean(entry.textLengths) || 0;
    const ratingStd = entry.ratings.length ? std(entry.ratings) : 0;
    const ratingMin = entry.ratings.length ? Math.min(...entry.ratings) : null;
    const ratingMax = entry.ratings.length ? Math.max(...entry.ratings) : null;
    reviewers.push({
      reviewer_id: entry.reviewer_id,
      name: person.name || entry.reviewer_id,
      profile_url: `https://openreview.net/profile?id=${entry.reviewer_id}`,
      institution: person.institution || 'Unknown Institution',
      country: person.nationality || 'Unknown',
      nationality: person.nationality || 'Unknown',
      gender: person.gender || 'Unknown',
      review_count: entry.review_count,
      submissions_reviewed: entry.review_count,
      avg_rating: avgRating !== null ? Number(avgRating.toFixed(2)) : null,
      rating_std: ratingStd ? Number(ratingStd.toFixed(2)) : 0,
      rating_min: ratingMin,
      rating_max: ratingMax,
      rating_range: ratingMin !== null && ratingMax !== null ? ratingMax - ratingMin : null,
      avg_confidence: avgConf !== null ? Number(avgConf.toFixed(2)) : null,
      confidence_std: entry.confidences.length ? Number(std(entry.confidences).toFixed(2)) : 0,
      avg_text_length: Math.round(avgTextLength),
      avg_questions_words: Math.round(mean(entry.questionLengths) || 0),
      question_ratio: entry.review_count ? Number((entry.questionCount / entry.review_count).toFixed(3)) : 0,
      questions_count: entry.questionCount,
      leniency_score: avgRating || 0,
      strictness_score: avgRating ? Number((10 - avgRating).toFixed(3)) : 0,
      volatility_score: ratingStd,
      stability_score: ratingStd ? Number((1 / (ratingStd + 0.1)).toFixed(3)) : 0,
      engagement_score: Math.round(avgTextLength * 0.05 + entry.review_count * 2),
    });
  });

  reviewers.sort((a, b) => b.review_count - a.review_count || (a.avg_rating || 0) - (b.avg_rating || 0));
  return reviewers;
}

function buildSubmissionStats(reviewsData) {
  const stats = [];
  Object.values(reviewsData.reviews || {}).forEach((sub) => {
    const ratings = (sub.reviews || []).map((r) => r.rating).filter((v) => typeof v === 'number');
    const confidences = (sub.reviews || []).map((r) => r.confidence).filter((v) => typeof v === 'number');
    const reviewCount = (sub.reviews || []).length;
    const ratingStd = ratings.length ? std(ratings) : 0;
    const ratingMin = ratings.length ? Math.min(...ratings) : null;
    const ratingMax = ratings.length ? Math.max(...ratings) : null;
    stats.push({
      submission_id: sub.submission_id || null,
      submission_number: sub.submission_number,
      review_count: reviewCount,
      avg_rating: ratings.length ? Number(mean(ratings).toFixed(2)) : null,
      rating_std: ratings.length ? Number(ratingStd.toFixed(3)) : null,
      rating_range: ratingMin !== null && ratingMax !== null ? ratingMax - ratingMin : null,
      avg_confidence: confidences.length ? Number(mean(confidences).toFixed(2)) : null,
      ethics_flag: 0,
    });
  });
  return stats;
}

function buildInstitutionStats(peopleData, institutionsData, reviewsData) {
  const instMap = new Map();

  for (const inst of institutionsData.institutions || []) {
    instMap.set(inst.institution_name, {
      institution_name: inst.institution_name,
      country: inst.country || 'Unknown',
      institution_type: inst.institution_type || inst.type || 'Unknown',
      total_members: 0,
      author_count: 0,
      reviewer_count: 0,
      submissions_as_author: 0,
      submissions_as_reviewer: 0,
      submissions: new Set(),
      ratings: [],
      confidences: [],
    });
  }

  for (const [pid, person] of Object.entries(peopleData.people || {})) {
    const instName = person.institution;
    if (!instName || instName === 'Unknown Institution') continue;
    const entry = instMap.get(instName) || {
      institution_name: instName,
      country: person.nationality || 'Unknown',
      institution_type: person.institution_type || person.institution_type || 'Unknown',
      total_members: 0,
      author_count: 0,
      reviewer_count: 0,
      submissions_as_author: 0,
      submissions_as_reviewer: 0,
      submissions: new Set(),
      ratings: [],
      confidences: [],
    };
    entry.total_members += 1;
    if ((person.role || '').includes('author')) {
      entry.author_count += 1;
      entry.submissions_as_author += (person.authored_papers || []).length;
      (person.authored_papers || []).forEach((sid) => entry.submissions.add(sid));
    }
    if ((person.role || '').includes('reviewer')) {
      entry.reviewer_count += 1;
      entry.submissions_as_reviewer += (person.reviewed_papers || []).length;
      (person.reviewed_papers || []).forEach((sid) => entry.submissions.add(sid));
    }
    instMap.set(instName, entry);
  }

  // 累计机构层面的评分/信心与参与稿件数
  Object.values(reviewsData.reviews || {}).forEach((sub) => {
    const submissionNumber = sub.submission_number;
    const authors = sub.authors || [];
    const authorInsts = new Set(
      authors
        .map((aid) => peopleData.people?.[aid]?.institution)
        .filter((v) => v && v !== 'Unknown Institution')
    );

    // 作为作者的机构参与统计
    authorInsts.forEach((instName) => {
      const entry = instMap.get(instName);
      if (entry) entry.submissions.add(submissionNumber);
    });

    // 作为审稿人的机构参与及评分
    (sub.reviews || []).forEach((rev) => {
      const instName = peopleData.people?.[rev.reviewer_id]?.institution;
      if (!instName) return;
      const entry = instMap.get(instName);
      if (!entry) return;
      entry.submissions.add(submissionNumber);
      if (typeof rev.rating === 'number') entry.ratings.push(rev.rating);
      if (typeof rev.confidence === 'number') entry.confidences.push(rev.confidence);
    });
  });

  const institutions = Array.from(instMap.values())
    .map((inst) => ({
      institution_name: inst.institution_name,
      country: inst.country,
      institution_type: inst.institution_type,
      total_members: inst.total_members,
      author_count: inst.author_count,
      reviewer_count: inst.reviewer_count,
      submissions_as_author: inst.submissions_as_author,
      submissions_as_reviewer: inst.submissions_as_reviewer,
      avg_rating_given: inst.ratings.length ? Number(mean(inst.ratings).toFixed(2)) : 0,
      avg_confidence: inst.confidences.length ? Number(mean(inst.confidences).toFixed(2)) : 0,
      unique_submissions: inst.submissions.size,
    }))
    .sort((a, b) => b.unique_submissions - a.unique_submissions || b.total_members - a.total_members);

  const countryAgg = {};
  institutions.forEach((inst) => {
    const c = inst.country || 'Unknown';
    if (!countryAgg[c]) {
      countryAgg[c] = {
        country: c,
        institution_count: 0,
        total_academic_members: 0,
        total_authors: 0,
        total_reviewers: 0,
        university_count: 0,
        company_count: 0,
      };
    }
    countryAgg[c].institution_count += 1;
    countryAgg[c].total_academic_members += inst.total_members;
    countryAgg[c].total_authors += inst.author_count;
    countryAgg[c].total_reviewers += inst.reviewer_count;
    if (inst.institution_type === 'University') countryAgg[c].university_count += 1;
    if (inst.institution_type === 'Company') countryAgg[c].company_count += 1;
  });

  const country_academic_power = Object.values(countryAgg)
    .map((c) => ({
      ...c,
      academic_power_score: Math.round(
        c.total_academic_members * 0.4 +
          c.total_reviewers * 0.35 +
          c.institution_count * 0.25
      ),
      researcher_density: Math.round(c.total_academic_members / Math.max(1, c.institution_count)),
    }))
    .sort((a, b) => b.academic_power_score - a.academic_power_score);

  const institution_type_analysis = {};
  institutions.forEach((inst) => {
    const key = inst.institution_type || 'Unknown';
    if (!institution_type_analysis[key]) {
      institution_type_analysis[key] = {
        count: 0,
        total_members: 0,
        author_count: 0,
        reviewer_count: 0,
        countries: new Set(),
      };
    }
    const bucket = institution_type_analysis[key];
    bucket.count += 1;
    bucket.total_members += inst.total_members;
    bucket.author_count += inst.author_count;
    bucket.reviewer_count += inst.reviewer_count;
    bucket.countries.add(inst.country || 'Unknown');
  });

  const cleanedTypeAnalysis = Object.fromEntries(
    Object.entries(institution_type_analysis).map(([type, data]) => [
      type,
      {
        count: data.count,
        total_members: data.total_members,
        author_count: data.author_count,
        reviewer_count: data.reviewer_count,
        countries: [`${data.countries.size} countries`],
        avg_members_per_institution: Math.round(data.total_members / Math.max(1, data.count)),
      },
    ])
  );

  return {
    institutions,
    country_academic_power,
    institution_type_analysis: cleanedTypeAnalysis,
  };
}

function buildStats(peopleData, institutionsData, reviewsData, reviewerList, submissionStats, instStats) {
  const total_people = Object.keys(peopleData.people || {}).length;
  const total_institutions = instStats.length || (institutionsData.institutions || []).length;
  const total_reviews = submissionStats.reduce((s, r) => s + (r.review_count || 0), 0);
  const total_submissions = submissionStats.length;
  const reviewersFromPeople = Object.values(peopleData.people || {}).filter((p) =>
    (p.role || '').includes('reviewer')
  ).length;

  const avg_rating = (() => {
    const allRatings = [];
    Object.values(reviewsData.reviews || {}).forEach((sub) => {
      (sub.reviews || []).forEach((r) => {
        if (typeof r.rating === 'number') allRatings.push(r.rating);
      });
    });
    const m = mean(allRatings);
    return m !== null ? Number(m.toFixed(2)) : 0;
  })();

  const avg_confidence = (() => {
    const all = [];
    Object.values(reviewsData.reviews || {}).forEach((sub) => {
      (sub.reviews || []).forEach((r) => {
        if (typeof r.confidence === 'number') all.push(r.confidence);
      });
    });
    const m = mean(all);
    return m !== null ? Number(m.toFixed(2)) : 0;
  })();

  const avg_text_length = reviewerList.length
    ? Math.round(mean(reviewerList.map((r) => r.avg_text_length || 0)) || 0)
    : 0;

  const reviewerDenominator = reviewerList.length || reviewersFromPeople;

  const countryAgg = {};
  instStats.forEach((inst) => {
    const c = inst.country || 'Unknown';
    if (!countryAgg[c]) {
      countryAgg[c] = {
        country: c,
        total_institutions: 0,
        total_members: 0,
        total_submissions: 0,
        avg_rating: [],
        institution_count: 0,
        total_academic_members: 0,
        reviewer_count: 0,
      };
    }
    countryAgg[c].total_institutions += 1;
    countryAgg[c].institution_count += 1;
    countryAgg[c].total_members += inst.total_members || 0;
    countryAgg[c].total_academic_members += inst.total_members || 0;
    countryAgg[c].total_submissions += (inst.submissions_as_author || 0) + (inst.submissions_as_reviewer || 0);
    countryAgg[c].reviewer_count += inst.reviewer_count || 0;
    if (typeof inst.avg_rating_given === 'number') countryAgg[c].avg_rating.push(inst.avg_rating_given);
  });

  const top_countries = Object.values(countryAgg)
    .map((c) => ({
      ...c,
      avg_rating: c.avg_rating.length ? Number(mean(c.avg_rating).toFixed(3)) : 0,
      academic_power_score: Number(
        (
          (c.total_academic_members || 0) * 0.4 +
          (c.reviewer_count || 0) * 0.35 +
          (c.institution_count || 0) * 0.25
        ).toFixed(1)
      ),
      reviewer_ratio: reviewerDenominator ? Number((c.reviewer_count / reviewerDenominator).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.total_institutions - a.total_institutions)
    .slice(0, 50);

  return {
    database_stats: {
      total_reviews,
      total_people,
      total_institutions,
      total_reviewers: reviewersFromPeople || reviewerList.length,
      total_submissions,
      avg_rating,
      avg_confidence,
      avg_text_length,
      institutions_count: total_institutions,
    },
    top_countries,
    data_source: 'generated_from_json',
    metadata: {
      timestamp: new Date().toISOString(),
      note: 'Generated from review-data/*.json without DB',
    },
  };
}

function buildConflictPlaceholder() {
  return {
    conflict_overview: {
      total_submissions: 0,
      submissions_with_conflicts: 0,
      total_conflict_instances: 0,
      conflict_rate: 0,
    },
    institution_conflict_ranking: [],
    conflict_type_analysis: [],
    affected_submission_analysis: [],
    reviewer_involvement_analysis: [],
    metadata: {
      analysis_timestamp: new Date().toISOString(),
      data_source: 'generated_from_json',
      note: 'No conflict data provided; placeholder values.',
    },
  };
}

function buildQualityAnalysis(submissionStats, reviewerList) {
  const well_reviewed = submissionStats.filter((s) => s.review_count >= 3).length;
  const under_reviewed = submissionStats.filter((s) => s.review_count > 0 && s.review_count < 3).length;
  const no_reviews = submissionStats.filter((s) => s.review_count === 0).length;
  const avg_reviews_per_submission = mean(submissionStats.map((s) => s.review_count)) || 0;
  const total_reviews = submissionStats.reduce((s, r) => s + (r.review_count || 0), 0);

  const top_quality_reviewers = reviewerList
    .filter((r) => r.review_count >= 3)
    .map((r) => {
      const { consistency_score, engagement_score, experience_score, confidence_score, overall_quality_score } =
        computeQualityScores(r);
      return {
        reviewer_id: r.reviewer_id,
        reviewer_types: [r.review_count > 10 ? 'experienced' : 'active'],
        review_count: r.review_count,
        avg_rating: r.avg_rating,
        rating_std: r.rating_std,
        avg_confidence: r.avg_confidence,
        avg_text_length: r.avg_text_length,
        question_ratio: r.question_ratio,
        consistency_score,
        engagement_score,
        experience_score,
        confidence_score,
        overall_quality_score,
      };
    })
    .sort((a, b) => b.overall_quality_score - a.overall_quality_score)
    .slice(0, 50);

  const paper_quality_analysis = submissionStats
    .filter((s) => s.review_count > 0)
    .map((s) => ({
      submission_id: s.submission_id || s.submission_number,
      submission_number: s.submission_number,
      type: (s.rating_std || 0) > 2 ? 'disputed_submissions' : (s.rating_std || 0) < 1 ? 'consensus_submissions' : 'regular_submissions',
      review_count: s.review_count,
      avg_rating: s.avg_rating,
      rating_std: s.rating_std,
      rating_variance: (s.rating_std || 0) ** 2,
      rating_range: s.rating_range || 0,
      avg_confidence: s.avg_confidence,
      quality_indicators: {
        high_disagreement: (s.rating_std || 0) > 2,
        wide_range: (s.rating_range || 0) > 4,
        low_confidence: (s.avg_confidence || 0) < 3,
        high_agreement: (s.rating_std || 0) < 1,
        narrow_range: (s.rating_range || 0) <= 2,
        high_confidence: (s.avg_confidence || 0) > 4,
      },
    }))
    .sort((a, b) => (b.rating_std || 0) - (a.rating_std || 0))
    .slice(0, 200);

  const quality_distribution = reviewerList.reduce(
    (acc, reviewer) => {
      const { overall_quality_score } = computeQualityScores(reviewer);
      if ((reviewer.review_count || 0) < 3) return acc;
      if (overall_quality_score >= 80) acc.high_quality_reviewers += 1;
      else if (overall_quality_score >= 60) acc.medium_quality_reviewers += 1;
      else acc.improvement_needed_reviewers += 1;
      return acc;
    },
    { high_quality_reviewers: 0, medium_quality_reviewers: 0, improvement_needed_reviewers: 0 }
  );

  return {
    coverage_analysis: {
      total_submissions: submissionStats.length,
      total_reviews,
      avg_reviews_per_submission: Number(avg_reviews_per_submission.toFixed(2)),
      well_reviewed,
      under_reviewed,
      no_reviews,
      review_distribution: {},
    },
    top_quality_reviewers,
    paper_quality_analysis,
    system_health_metrics: {
      reviewer_diversity: {
        total_unique_reviewers: reviewerList.length,
        active_reviewers: reviewerList.filter((r) => r.review_count >= 3).length,
        expert_reviewers: reviewerList.filter((r) => r.review_count >= 5).length,
      },
      quality_distribution,
      review_consistency: {
        highly_consistent_papers: submissionStats.filter((s) => (s.rating_std || 0) < 1 && s.review_count > 0).length,
        disputed_papers: submissionStats.filter((s) => (s.rating_std || 0) > 2 && s.review_count > 0).length,
        consistency_ratio: submissionStats.length
          ? Number((submissionStats.filter((s) => (s.rating_std || 0) < 1).length / submissionStats.length) * 100).toFixed(2)
          : 0,
      },
    },
    regional_quality_comparison: [],
    metadata: {
      analysis_timestamp: new Date().toISOString(),
      data_source: 'generated_from_json',
      data_quality: 'Comprehensive analysis based on local review data',
    },
  };
}

function buildReviewerAnalysis(reviewerList) {
  const filtered = reviewerList.filter((r) => r.review_count >= 3);
  const mapCategory = (arr) =>
    arr.map((r) => ({
      ...r,
      min_rating: r.rating_min ?? r.min_rating ?? null,
      max_rating: r.rating_max ?? r.max_rating ?? null,
    }));
  return {
    reviewer_categories: {
      most_lenient: mapCategory([...filtered].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 50)),
      most_strict: mapCategory([...filtered].sort((a, b) => (a.avg_rating || 0) - (b.avg_rating || 0)).slice(0, 50)),
      most_volatile: mapCategory([...filtered].sort((a, b) => (b.rating_std || 0) - (a.rating_std || 0)).slice(0, 50)),
      most_stable: mapCategory([...filtered].sort((a, b) => (a.rating_std || 0) - (b.rating_std || 0)).slice(0, 50)),
      most_engaged: mapCategory([...reviewerList].sort((a, b) => (b.review_count || 0) - (a.review_count || 0)).slice(0, 50)),
    },
    summary_statistics: {
      total_reviewers_analyzed: filtered.length,
      min_reviews_threshold: 3,
      avg_rating_overall: Number(mean(filtered.map((r) => r.avg_rating || 0)).toFixed(2)),
      avg_volatility: Number(mean(filtered.map((r) => r.rating_std || 0)).toFixed(2)),
      avg_reviews_per_reviewer: Math.round(mean(filtered.map((r) => r.review_count || 0)) || 0),
    },
    distribution_analysis: {
      rating_distribution: filtered.reduce(
        (acc, r) => {
          if ((r.avg_rating || 0) >= 8) acc.very_lenient += 1;
          else if ((r.avg_rating || 0) >= 6.5) acc.lenient += 1;
          else if ((r.avg_rating || 0) >= 4.5) acc.moderate += 1;
          else if ((r.avg_rating || 0) >= 3) acc.strict += 1;
          else acc.very_strict += 1;
          return acc;
        },
        { very_lenient: 0, lenient: 0, moderate: 0, strict: 0, very_strict: 0 }
      ),
      volatility_distribution: filtered.reduce(
        (acc, r) => {
          if ((r.rating_std || 0) <= 0.5) acc.very_stable += 1;
          else if ((r.rating_std || 0) <= 1) acc.stable += 1;
          else if ((r.rating_std || 0) <= 1.5) acc.moderate += 1;
          else if ((r.rating_std || 0) <= 2.5) acc.volatile += 1;
          else acc.very_volatile += 1;
          return acc;
        },
        { very_stable: 0, stable: 0, moderate: 0, volatile: 0, very_volatile: 0 }
      ),
    },
    metadata: {
      timestamp: new Date().toISOString(),
      data_source: 'generated_from_json',
    },
  };
}

function buildInstitutionAnalysis(instData) {
  const influence = instData.institutions.map((row) => ({
    institution_name: row.institution_name,
    country: row.country || 'Unknown',
    institution_type: row.institution_type || 'Unknown',
    total_members: row.total_members,
    submissions_involved: row.unique_submissions,
    as_author: row.submissions_as_author,
    as_reviewer: row.submissions_as_reviewer,
    avg_rating_given: row.avg_rating_given !== null ? row.avg_rating_given : 0,
    avg_confidence: row.avg_confidence !== null ? row.avg_confidence : 0,
    influence_score:
      (row.submissions_as_author || 0) * 0.3 +
      (row.submissions_as_reviewer || 0) * 0.5 +
      (row.total_members || 0) * 0.2,
  }));

  const institution_strictness = influence
    .filter((inst) => (inst.as_reviewer || 0) >= 3)
    .map((inst) => ({
      institution_name: inst.institution_name,
      country: inst.country,
      avg_rating_given: inst.avg_rating_given,
      review_count: inst.as_reviewer,
      avg_confidence: inst.avg_confidence,
      strictness_level:
        inst.avg_rating_given < 4
          ? 'Very Strict'
          : inst.avg_rating_given < 4.8
          ? 'Strict'
          : inst.avg_rating_given < 5.8
          ? 'Moderate'
          : inst.avg_rating_given < 6.8
          ? 'Lenient'
          : 'Very Lenient',
    }))
    .sort((a, b) => a.avg_rating_given - b.avg_rating_given);

  return {
    institution_influence: influence.slice(0, 50),
    institution_type_analysis: instData.institution_type_analysis,
    country_academic_power: instData.country_academic_power.slice(0, 50),
    institution_strictness: institution_strictness.slice(0, 50),
    summary_stats: {
      total_institutions: influence.length,
      total_countries: instData.country_academic_power.length,
      avg_members_per_institution: influence.length
        ? Math.round(influence.reduce((s, i) => s + (i.total_members || 0), 0) / influence.length)
        : 0,
    },
    metadata: {
      total_institutions_analyzed: influence.length,
      total_countries: instData.country_academic_power.length,
      analysis_timestamp: new Date().toISOString(),
      data_source: 'generated_from_json',
    },
  };
}

function buildConflictAnalysis(reviewsData, peopleData) {
  const conflicts = [];
  const institutionMap = new Map();
  const getPersonInst = (pid) => {
    const p = peopleData.people?.[pid];
    if (!p) return { name: 'Unknown', type: 'Unknown' };
    return { name: p.institution || 'Unknown', type: p.institution_type || 'Unknown', country: p.nationality || 'Unknown' };
  };

  Object.values(reviewsData.reviews || {}).forEach((sub) => {
    const subNum = sub.submission_number;
    const authors = sub.authors || [];
    const authorInsts = new Set();
    authors.forEach((aid) => {
      const inst = getPersonInst(aid).name;
      if (inst && inst !== 'Unknown Institution' && inst !== 'Unknown') authorInsts.add(inst);
    });

    const reviewerConflicts = [];
    (sub.reviews || []).forEach((rev) => {
      const rid = rev.reviewer_id;
      if (!rid) return;
      const revInfo = getPersonInst(rid);
      const revInst = revInfo.name;
      const sameAuthor = authors.includes(rid);
      const instConflict = revInst && authorInsts.has(revInst);
      if (sameAuthor || instConflict) {
        reviewerConflicts.push({
          reviewer_id: rid,
          reviewer_institution: revInst || 'Unknown',
          conflict_type: sameAuthor ? 'author_is_reviewer' : 'same_institution',
        });
        const key = revInst || 'Unknown';
        const agg =
          institutionMap.get(key) ||
          {
            institution_name: key,
            country: revInfo.country || 'Unknown',
            institution_type: revInfo.type || 'Unknown',
            total_conflicts: 0,
            submissions: new Set(),
            reviewers: new Set(),
          };
        if (agg.country === 'Unknown' && revInfo.country) agg.country = revInfo.country;
        if (agg.institution_type === 'Unknown' && revInfo.type) agg.institution_type = revInfo.type;
        agg.total_conflicts += 1;
        agg.submissions.add(subNum);
        agg.reviewers.add(rid);
        institutionMap.set(key, agg);
      }
    });

    if (reviewerConflicts.length) {
      conflicts.push({
        submission_number: subNum,
        conflict_count: reviewerConflicts.length,
        reviewers: reviewerConflicts,
        institutions_involved: Array.from(new Set(reviewerConflicts.map((c) => c.reviewer_institution).filter(Boolean))),
      });
    }
  });

  const totalSubs = Object.keys(reviewsData.reviews || {}).length;
  const submissionsWithConflicts = conflicts.length;
  const totalInstances = conflicts.reduce((s, c) => s + c.conflict_count, 0);

  const institution_conflict_ranking = Array.from(institutionMap.values()).map((item) => ({
    institution_name: item.institution_name,
    country: item.country || 'Unknown',
    institution_type: item.institution_type || 'Unknown',
    total_conflicts: item.total_conflicts,
    affected_submissions: item.submissions.size,
    involved_authors: 0,
    involved_reviewers: item.reviewers.size,
    conflict_severity: item.total_conflicts > 2 ? 'High' : item.total_conflicts > 1 ? 'Medium' : 'Low',
  }));

  institution_conflict_ranking.sort((a, b) => b.total_conflicts - a.total_conflicts);

  const conflict_type_counts = {
    same_institution: institution_conflict_ranking.reduce((s, c) => s + c.total_conflicts, 0),
    author_is_reviewer: conflicts.reduce(
      (s, c) => s + c.reviewers.filter((r) => r.conflict_type === 'author_is_reviewer').length,
      0
    ),
  };
  const totalTypes = conflict_type_counts.same_institution + conflict_type_counts.author_is_reviewer || 1;
  const conflict_type_analysis = [
    {
      conflict_type: 'Same Institution (Author-Reviewer)',
      count: conflict_type_counts.same_institution,
      percentage: Number(((conflict_type_counts.same_institution / totalTypes) * 100).toFixed(1)),
      severity: conflict_type_counts.same_institution > 2 ? 'High' : conflict_type_counts.same_institution > 0 ? 'Medium' : 'Low',
      description: 'Author and reviewer share institution.',
    },
    {
      conflict_type: 'Author is also Reviewer',
      count: conflict_type_counts.author_is_reviewer,
      percentage: Number(((conflict_type_counts.author_is_reviewer / totalTypes) * 100).toFixed(1)),
      severity: conflict_type_counts.author_is_reviewer > 0 ? 'Medium' : 'Low',
      description: 'Reviewer ID also appears in authors of the same submission.',
    },
  ];

  const affected_submission_analysis = conflicts.map((c) => ({
    submission_id: null,
    submission_number: c.submission_number,
    conflict_count: c.conflict_count,
    total_conflict_pairs: c.conflict_count,
    institutions_involved: c.institutions_involved,
    severity_score: c.conflict_count,
  }));

  const reviewer_involvement_map = {};
  conflicts.forEach((c) => {
    c.reviewers.forEach((r) => {
      const key = r.reviewer_id;
      reviewer_involvement_map[key] = reviewer_involvement_map[key] || { reviewer_id: key, reviewer_name: key, conflict_count: 0, institutions_involved: new Set(), submissions_involved: new Set() };
      reviewer_involvement_map[key].conflict_count += 1;
      reviewer_involvement_map[key].institutions_involved.add(r.reviewer_institution || 'Unknown');
      reviewer_involvement_map[key].submissions_involved.add(c.submission_number);
    });
  });

  const reviewer_involvement_analysis = Object.values(reviewer_involvement_map).map((r) => ({
    reviewer_id: r.reviewer_id,
    reviewer_name: r.reviewer_name,
    conflict_count: r.conflict_count,
    institutions_involved: r.institutions_involved.size,
    submissions_involved: r.submissions_involved.size,
    risk_level: r.conflict_count > 2 ? 'High' : r.conflict_count > 1 ? 'Medium' : 'Low',
  }));

  return {
    conflict_overview: {
      total_submissions: totalSubs,
      submissions_with_conflicts: submissionsWithConflicts,
      total_conflict_instances: totalInstances,
      conflict_rate: totalSubs ? Number(((submissionsWithConflicts / totalSubs) * 100).toFixed(2)) : 0,
    },
    institution_conflict_ranking,
    conflict_type_analysis,
    affected_submission_analysis,
    reviewer_involvement_analysis,
    data_source: 'generated_from_json',
    metadata: {
      analysis_timestamp: new Date().toISOString(),
      data_quality: 'Analysis based on institution overlap and author-reviewer identity',
      total_submissions_analyzed: totalSubs,
      conflict_detection_method: 'Institution based overlap with reviewer/author roles',
      conflicts_detected: totalInstances,
    },
  };
}

function main() {
  ensureDir(OUTPUT_DIR);
  const { people, institutions, reviews } = loadInputs();

  const reviewerList = buildReviewerStats(reviews, people);
  const submissionStats = buildSubmissionStats(reviews);
  const institutionData = buildInstitutionStats(people, institutions, reviews);

  const stats = buildStats(people, institutions, reviews, reviewerList, submissionStats, institutionData.institutions);
  const conflict = buildConflictAnalysis(reviews, people);
  const quality = buildQualityAnalysis(submissionStats, reviewerList);
  const institutionAnalysis = buildInstitutionAnalysis(institutionData);
  const reviewerAnalysis = buildReviewerAnalysis(reviewerList);

  const reviewersForList = reviewerList.map((r) => ({
    reviewer_id: r.reviewer_id,
    name: r.name,
    profile_url: r.profile_url,
    review_count: r.review_count,
    avg_rating: r.avg_rating,
    rating_std: r.rating_std,
    avg_confidence: r.avg_confidence,
    avg_text_length: r.avg_text_length,
    nationality: r.nationality || r.country,
    gender: r.gender || 'Unknown',
    institution: r.institution,
  }));

  const outputs = [
    ['stats.json', stats],
    [
      'institutions.json',
      {
        institutions: institutionData.institutions.map((inst) => ({
          institution_name: inst.institution_name,
          country: inst.country,
          institution_type: inst.institution_type,
          total_members: inst.total_members,
          as_author: inst.submissions_as_author,
          as_reviewer: inst.submissions_as_reviewer,
          unique_submissions: inst.unique_submissions,
          avg_rating: inst.avg_rating_given,
          avg_confidence: inst.avg_confidence,
        })),
      },
    ],
    ['reviewers.json', { reviewers: reviewersForList, total: reviewersForList.length, data_source: 'generated_from_json' }],
    ['conflict-analysis.json', conflict],
    ['quality-analysis.json', quality],
    ['institution-analysis.json', institutionAnalysis],
    ['reviewer-analysis.json', reviewerAnalysis],
  ];

  outputs.forEach(([file, data]) => {
    const fp = path.join(OUTPUT_DIR, file);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
    console.log(`  ✓ 写入 ${file}`);
  });

  console.log('\n🎉 完成！静态分析文件已从 review-data 生成。');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('生成失败:', err);
    process.exit(1);
  }
}

