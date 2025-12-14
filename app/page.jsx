"use client";
import { useEffect, useState, useMemo } from "react";
import { trackNavigation, trackLanguageChange, trackThemeChange, trackButtonClick } from "../lib/tracking";
import StatsCards from "../components/charts/StatsCards";
import GlobalDistributionChart from "../components/charts/GlobalDistributionChart";
import InstitutionInfluenceChart from "../components/charts/InstitutionInfluenceChart";
import CountryAcademicComparisonChart from "../components/charts/CountryAcademicComparisonChart";
import QualityAnalysisChart from "../components/charts/QualityAnalysisChart";
import ReviewerStrictnessChart from "../components/charts/ReviewerStrictnessChart";
import InstitutionTypeComparisonChart from "../components/charts/InstitutionTypeComparisonChart";
import ReviewControversyChart from "../components/charts/ReviewControversyChart";

const fmt = (n, digits = 1) => (n === null || n === undefined ? "—" : Number(n).toFixed(digits));
const fmtInt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US"));

export default function Home() {
  const [lang, setLang] = useState("en");
  const [themeLight, setThemeLight] = useState(true);
  const [activeDim, setActiveDim] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // ICLR Analysis states
  const [iclrStats, setIclrStats] = useState(null);
  const [iclrLoading, setIclrLoading] = useState(true); // Start as loading
  const [iclrActiveTab, setIclrActiveTab] = useState("overview");

  // Advanced analysis states
  const [institutionAnalysis, setInstitutionAnalysis] = useState(null);
  const [conflictAnalysis, setConflictAnalysis] = useState(null);
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [reviewerAnalysis, setReviewerAnalysis] = useState(null);
  const [advancedLoading, setAdvancedLoading] = useState(true); // Start as loading

  // Helper function to handle "Unknown" values
  const formatValue = (value) => {
    return value === 'Unknown' ? '' : (value || '');
  };

  const t = useMemo(() => {
    const en = {
      lang_toggle: "EN / 中",
      theme_light_label: "Light mode",
      theme_dark_label: "Dark mode",
      nav_overview: "Overview",
      nav_search: "Search",
      reviewed_by: "Reviewed by",
      reviewers: "reviewers",
      reviewed_others: "Reviewed",
      papers_by_others: "papers by others",
      search_results_for: "Search Results for",
      people_found: "people found",
    };
    const zh = {
      lang_toggle: "中 / EN",
      theme_light_label: "明亮模式",
      theme_dark_label: "暗黑模式",
      nav_overview: "概览",
      nav_search: "搜索",
      reviewed_by: "被谁审过",
      reviewers: "位审稿人",
      reviewed_others: "审过谁",
      papers_by_others: "篇论文",
      search_results_for: "搜索结果",
      people_found: "人",
    };
    const translations = lang === "zh" ? zh : en;
    return (key) => translations[key] || key;
  }, [lang]);

  useEffect(() => {
    if (themeLight) document.body.classList.add("light");
    else document.body.classList.remove("light");
  }, [themeLight]);

  useEffect(() => {
    loadStaticAnalysisData();
  }, []);

  // Load static analysis data (replaces dynamic API calls)
  const loadStaticAnalysisData = async () => {
    setIclrLoading(true);
    setAdvancedLoading(true);
    try {
      const response = await fetch('/api/static-analysis');
      const result = await response.json();
      
      if (result.success && result.data) {
        const { stats, institutionAnalysis, reviewerAnalysis, qualityAnalysis, conflictAnalysis } = result.data;

        // Set ICLR basic data
        setIclrStats(stats);

        // Set advanced analysis data
        setInstitutionAnalysis(institutionAnalysis);
        setConflictAnalysis(conflictAnalysis);
        setQualityAnalysis(qualityAnalysis);
        setReviewerAnalysis(reviewerAnalysis);
      }
    } catch (error) {
      console.error('Failed to load static analysis data:', error);
    } finally {
      setIclrLoading(false);
      setAdvancedLoading(false);
    }
  };

  const doSearch = async () => {
    setSearchError("");
    setSearchResults(null);
    if (!searchTerm) {
      setSearchError("Enter submission number or person name");
      return;
    }
    setSearchLoading(true);
    trackButtonClick('search_submit', searchTerm);
    
    try {
      // Determine if it's a number (submission) or text (person)
      const isNumber = /^\d+$/.test(searchTerm.trim());
      
      if (isNumber) {
        // Search for submission
        const res = await fetch(`/api/db-search-submission?number=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Submission not found");
        
        setSearchResults({
          type: 'submission',
          submission_number: data.submission_number,
          submission_id: data.submission_id,
          submission_type: data.submission_type,
          review_count: data.statistics?.review_count,
          avg_rating: data.statistics?.avg_rating,
          statistics: data.statistics,
          reviews: data.reviews || [],
          authors: data.authors || []
        });
      } else {
        // Search for person
        const res = await fetch(`/api/db-search-person?q=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Person not found");
        
        setSearchResults({
          type: 'person',
          query: data.query,
          results: data.results,
          total_found: data.total
        });
      }
      
      trackButtonClick('search_success', searchTerm);
    } catch (err) {
      setSearchError(err.message);
      trackButtonClick('search_error', searchTerm);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <button className="toggle-btn" onClick={() => setActiveDim("search")}>
            Search
          </button>
        </div>
        <div className="topbar-right">
          <a 
            href="https://github.com/RegiaYoung/ICLR_Analysis" 
            target="_blank" 
            rel="noopener noreferrer"
            className="toggle-btn"
            style={{ 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              color: 'inherit'
            }}
            onClick={() => trackButtonClick('github_link')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <button className="toggle-btn" onClick={() => {
            const newLang = lang === "zh" ? "en" : "zh";
            trackLanguageChange(newLang, lang);
            setLang(newLang);
          }}>
            {t("lang_toggle")}
          </button>
          <button 
            className="toggle-btn" 
            onClick={() => {
              const newTheme = !themeLight;
              trackThemeChange(newTheme ? 'light' : 'dark', themeLight ? 'light' : 'dark');
              setThemeLight(newTheme);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0',
              borderRadius: '24px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-secondary)',
              overflow: 'hidden',
              height: '36px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
          >
            <span 
              style={{
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: '500',
                background: themeLight 
                  ? 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-surface) 100%)' 
                  : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                color: themeLight ? 'var(--color-text)' : '#495057',
                transition: 'all 0.2s ease',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                borderTopLeftRadius: '23px',
                borderBottomLeftRadius: '23px',
                boxShadow: themeLight 
                  ? '0 1px 3px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                  : '0 1px 2px rgba(0, 0, 0, 0.05)',
                position: 'relative'
              }}
            >
              Light
            </span>
            <div 
              style={{
                width: '1px',
                height: '70%',
                background: 'linear-gradient(to bottom, transparent, var(--color-secondary), transparent)',
                alignSelf: 'center'
              }}
            />
            <span 
              style={{
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: '500',
                background: !themeLight 
                  ? 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-surface) 100%)' 
                  : 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                color: !themeLight ? 'var(--color-text)' : '#e9ecef',
                transition: 'all 0.2s ease',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                borderTopRightRadius: '23px',
                borderBottomRightRadius: '23px',
                boxShadow: !themeLight 
                  ? '0 1px 3px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)' 
                  : '0 1px 2px rgba(0, 0, 0, 0.05)',
                position: 'relative'
              }}
            >
              Dark
            </span>
          </button>
        </div>
      </div>
      <header className="hero">
        <div className="hero-text">
          <div className="eyebrow">ICLR Review Radar</div>
          <h1>ICLR Review Analysis System</h1>
          <p className="lede">
            Stats from review JSON: scores, confidence, text signals, and contention. All insights and search are open for everyone without login.
          </p>
        </div>
      </header>

      <div className="nav">
        {[
          ["overview", lang === 'zh' ? "概览" : "Overview"],
          ["institution", lang === 'zh' ? "机构分析" : "Institution Analysis"],
          ["conflict", lang === 'zh' ? "利益冲突" : "Conflict Analysis"],
          ["quality", lang === 'zh' ? "评审质量" : "Quality Analysis"],
          ["reviewers", lang === 'zh' ? "审稿人分析" : "Reviewer Analysis"],
          ["search", t("nav_search")],
        ].map(([key, label]) => (
          <button 
            key={key} 
            className={`nav-btn ${activeDim === key ? "active" : ""}`} 
            onClick={() => {
              trackNavigation(key, activeDim);
              setActiveDim(key);
              // Data is auto-loaded on mount, no need for manual loading
            }}
          >
            {label}
          </button>
        ))}
      </div>


      <main>





        {/* Overview Section */}
        <section className={`dim-section ${activeDim === "overview" ? "active" : ""}`} data-dim="overview">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-title">{lang === 'zh' ? 'ICLR 学术评审概览' : 'ICLR Academic Review Overview'}</div>
              {(iclrLoading || advancedLoading) && (
                <div style={{ fontSize: "14px", color: "var(--color-muted)" }}>
                  {iclrLoading ? (lang === 'zh' ? "正在加载基础数据..." : "Loading basic data...") : (lang === 'zh' ? "正在加载深度分析..." : "Loading advanced analysis...")}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            {/* Loading States */}
            {(iclrLoading || advancedLoading) && (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <div className="loading-spinner"></div>
                <p>{iclrLoading ? (lang === 'zh' ? "加载基础数据中..." : "Loading basic data...") : (lang === 'zh' ? "加载深度分析中..." : "Loading advanced analysis...")}</p>
              </div>
            )}

            {/* Overview Content */}
            {iclrStats && (
              <>
                {/* Use the enhanced stats cards */}
                <div style={{ marginBottom: "32px" }}>
                  <StatsCards stats={iclrStats?.database_stats} lang={lang} />
                </div>

                {/* Chart Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                  gap: '24px', 
                  marginBottom: '32px' 
                }}>
                  {iclrStats?.top_countries && (
                    <div className="panel" style={{ padding: '20px' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                        🌍 {lang === 'zh' ? '全球评审分布' : 'Global Review Distribution'}
                      </h3>
                      <GlobalDistributionChart data={iclrStats.top_countries} lang={lang} />
                    </div>
                  )}

                  {institutionAnalysis?.country_academic_power && (
                    <div className="panel" style={{ padding: '20px' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                        🎯 {lang === 'zh' ? '国家学术实力对比' : 'Country Academic Power Comparison'}
                      </h3>
                      <CountryAcademicComparisonChart data={institutionAnalysis.country_academic_power} lang={lang} />
                    </div>
                  )}
                </div>

                {/* Traditional table for detailed data */}
                {iclrStats?.top_countries && (
                  <div style={{ marginBottom: "24px" }}>
                    <div className="section-title">{lang === 'zh' ? '详细国家数据' : 'Detailed Country Data'}</div>
                    <div className="list-scroll" style={{ maxHeight: "300px" }}>
                      <table className="table">
                        <thead><tr><th>#</th><th>{lang === 'zh' ? '国家' : 'Country'}</th><th>{lang === 'zh' ? '审稿人数量' : 'Reviewers'}</th><th>{lang === 'zh' ? '占比' : 'Percentage'}</th></tr></thead>
                        <tbody>
                          {iclrStats.top_countries.slice(0, 15).map((country, idx) => (
                            <tr key={country.country}>
                              <td>{idx + 1}</td><td>{country.country}</td>
                              <td>{fmtInt(country.reviewer_count)}</td>
                              <td>{fmt(country.reviewer_ratio * 100, 1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Institution Analysis Tab */}
            {iclrActiveTab === "institution" && institutionAnalysis && (
              <>
                {/* Institution Influence Chart */}
                <div style={{ marginBottom: "32px" }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      🏫 {lang === 'zh' ? '机构学术参与度分析' : 'Institution Academic Participation Analysis'}
                    </h3>
                    <InstitutionInfluenceChart data={institutionAnalysis.institution_influence} lang={lang} />
                  </div>
                </div>

                {/* Institution Type Comparison */}
                <div style={{ marginBottom: "32px" }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      🎯 {lang === 'zh' ? '大学 vs 公司参与特征对比' : 'University vs Company Participation Characteristics'}
                    </h3>
                    <InstitutionTypeComparisonChart data={institutionAnalysis} lang={lang} />
                  </div>
                </div>

                
                {/* Detailed Tables */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
                  gap: '24px' 
                }}>
                  <div>
                    <div className="section-title">{lang === 'zh' ? '机构参与度详细数据' : 'Institution Participation Details'}</div>
                    <div className="list-scroll" style={{ maxHeight: "400px" }}>
                      <table className="table">
                        <thead><tr><th>#</th><th>{lang === 'zh' ? '机构' : 'Institution'}</th><th>{lang === 'zh' ? '国家' : 'Country'}</th><th>{lang === 'zh' ? '总成员数' : 'Total Members'}</th><th>{lang === 'zh' ? '活跃审稿人' : 'Active Reviewers'}</th><th>{lang === 'zh' ? '参与作者' : 'Authors'}</th></tr></thead>
                        <tbody>
                          {institutionAnalysis.institution_influence?.slice(0, 20).map((inst, idx) => (
                            <tr key={inst.institution_name}>
                              <td>{idx + 1}</td><td className="wide">{inst.institution_name}</td>
                              <td>{inst.country}</td>
                              <td>{fmtInt(inst.total_members)}</td>
                              <td>{fmtInt(inst.as_reviewer)}</td>
                              <td>{fmtInt(inst.as_author)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="section-title">{lang === 'zh' ? '国家学术实力详细数据' : 'Country Academic Power Details'}</div>
                    <div className="list-scroll" style={{ maxHeight: "400px" }}>
                      <table className="table">
                        <thead><tr><th>#</th><th>{lang === 'zh' ? '国家' : 'Country'}</th><th>{lang === 'zh' ? '学术实力指数' : 'Power Score'}</th><th>{lang === 'zh' ? '机构数' : 'Institutions'}</th><th>{lang === 'zh' ? '研究人员' : 'Researchers'}</th></tr></thead>
                        <tbody>
                          {institutionAnalysis.country_academic_power?.slice(0, 15).map((country, idx) => (
                            <tr key={country.country}>
                              <td>{idx + 1}</td><td>{country.country}</td>
                              <td>{country.academic_power_score}</td>
                              <td>{country.institution_count}</td>
                              <td>{fmtInt(country.total_academic_members)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Conflict Analysis Tab */}
            {iclrActiveTab === "conflict" && conflictAnalysis && (
              <>
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '冲突率' : 'Conflict Rate'}</div>
                    <div className="stat">
                      <div className="value">{fmt(conflictAnalysis.conflict_overview?.conflict_rate, 2)}%</div>
                      <div className="hint">{lang === 'zh' ? '总体利益冲突比例' : 'Overall conflict ratio'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '涉及论文' : 'Papers Involved'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(conflictAnalysis.conflict_overview?.submissions_with_conflicts)}</div>
                      <div className="hint">{lang === 'zh' ? '存在冲突的论文数量' : 'Number of papers with conflicts'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '冲突案例' : 'Conflict Cases'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(conflictAnalysis.conflict_overview?.total_conflict_instances)}</div>
                      <div className="hint">{lang === 'zh' ? '总冲突实例数' : 'Total conflict instances'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '透明度' : 'Transparency'}</div>
                    <div className="stat">
                      <div className="value">{fmt(conflictAnalysis.fairness_metrics?.institutional_transparency?.transparency_score, 1)}%</div>
                      <div className="hint">{lang === 'zh' ? '冲突披露透明度' : 'Conflict disclosure transparency'}</div>
                    </div>
                  </div>
                </div>

                <div className="section-title">{lang === 'zh' ? '机构冲突排行' : 'Institution Conflict Ranking'}</div>
                <div className="list-scroll" style={{ maxHeight: "400px" }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>{lang === 'zh' ? '机构' : 'Institution'}</th><th>{lang === 'zh' ? '国家' : 'Country'}</th><th>{lang === 'zh' ? '冲突次数' : 'Conflicts'}</th><th>{lang === 'zh' ? '涉及论文' : 'Papers'}</th><th>{lang === 'zh' ? '平均评分' : 'Avg Rating'}</th></tr></thead>
                    <tbody>
                      {conflictAnalysis.institution_conflict_ranking?.slice(0, 15).map((inst, idx) => (
                        <tr key={inst.institution_name}>
                          <td>{idx + 1}</td><td className="wide">{inst.institution_name}</td>
                          <td>{inst.country || 'Unknown'}</td><td>{inst.total_conflicts}</td>
                          <td>{inst.affected_submissions}</td>
                          <td>-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Quality Analysis Tab */}
            {iclrActiveTab === "quality" && qualityAnalysis && (
              <>
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '评审覆盖率' : 'Review Coverage'}</div>
                    <div className="stat">
                      <div className="value">{fmt(qualityAnalysis.coverage_analysis?.avg_reviews_per_submission, 1)}</div>
                      <div className="hint">{lang === 'zh' ? '平均每篇论文评审数' : 'Average reviews per paper'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '高质量审稿人' : 'High Quality Reviewers'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(qualityAnalysis.system_health_metrics?.quality_distribution?.high_quality_reviewers)}</div>
                      <div className="hint">{lang === 'zh' ? '综合质量80+的审稿人' : 'Reviewers with quality score ≥ 80'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '一致性比例' : 'Consistency Ratio'}</div>
                    <div className="stat">
                      <div className="value">{fmt(qualityAnalysis.system_health_metrics?.review_consistency?.consistency_ratio, 1)}%</div>
                      <div className="hint">{lang === 'zh' ? '高一致性论文占比' : 'High consistency papers ratio'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '专家审稿人' : 'Expert Reviewers'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(qualityAnalysis.system_health_metrics?.reviewer_diversity?.expert_reviewers)}</div>
                      <div className="hint">{lang === 'zh' ? '5+评审的资深专家' : 'Senior experts with 5+ reviews'}</div>
                    </div>
                  </div>
                </div>

                {/* Multiple Quality Analysis Charts */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
                  gap: '24px',
                  marginBottom: '32px'
                }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      📊 {lang === 'zh' ? '论文质量分布分析' : 'Paper Quality Distribution Analysis'}
                    </h3>
                    <QualityAnalysisChart data={qualityAnalysis} />
                  </div>

                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      🔥 {lang === 'zh' ? '评审争议度热力图' : 'Review Controversy Heatmap'}
                    </h3>
                    <ReviewControversyChart data={qualityAnalysis} lang={lang} />
                  </div>
                </div>

                {/* Reviewer Strictness Distribution */}
                <div style={{ marginBottom: "32px" }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      📈 {lang === 'zh' ? '审稿人严格度分布' : 'Reviewer Strictness Distribution'}
                    </h3>
                    <ReviewerStrictnessChart data={qualityAnalysis} lang={lang} />
                  </div>
                </div>

                <div className="section-title">{lang === 'zh' ? '顶级质量审稿人' : 'Top Quality Reviewers'}</div>
                <div className="list-scroll" style={{ maxHeight: "400px" }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>{lang === 'zh' ? '审稿人' : 'Reviewer'}</th><th>{lang === 'zh' ? '综合质量' : 'Overall Quality'}</th><th>{lang === 'zh' ? '一致性' : 'Consistency'}</th><th>{lang === 'zh' ? '参与度' : 'Engagement'}</th><th>{lang === 'zh' ? '经验' : 'Experience'}</th></tr></thead>
                    <tbody>
                      {qualityAnalysis.top_quality_reviewers?.slice(0, 20).map((reviewer, idx) => (
                        <tr key={reviewer.reviewer_id}>
                          <td>{idx + 1}</td><td className="wide">{reviewer.reviewer_id ? reviewer.reviewer_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' ') : 'Unknown'}</td>
                          <td>{fmt(reviewer.overall_quality_score, 1)}</td>
                          <td>{fmt(reviewer.consistency_score, 1)}</td>
                          <td>{fmt(reviewer.engagement_score, 1)}</td>
                          <td>{fmt(reviewer.experience_score, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Reviewer Analysis Tab */}
            {iclrActiveTab === "reviewers" && reviewerAnalysis && (
              <>
                {/* Summary Statistics */}
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '分析审稿人数' : 'Reviewers Analyzed'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(reviewerAnalysis.summary_statistics?.total_reviewers_analyzed)}</div>
                      <div className="hint">{lang === 'zh' ? '3篇及以上评审' : '3+ reviews threshold'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均给分' : 'Average Rating'}</div>
                    <div className="stat">
                      <div className="value">{fmt(reviewerAnalysis.summary_statistics?.avg_rating_overall, 2)}</div>
                      <div className="hint">{lang === 'zh' ? '所有审稿人平均分' : 'Overall average rating'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均波动性' : 'Average Volatility'}</div>
                    <div className="stat">
                      <div className="value">{fmt(reviewerAnalysis.summary_statistics?.avg_volatility, 2)}</div>
                      <div className="hint">{lang === 'zh' ? '评分标准差' : 'Rating standard deviation'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均评审数' : 'Avg Reviews'}</div>
                    <div className="stat">
                      <div className="value">{fmt(reviewerAnalysis.summary_statistics?.avg_reviews_per_reviewer, 1)}</div>
                      <div className="hint">{lang === 'zh' ? '每位审稿人平均评审数' : 'Reviews per reviewer'}</div>
                    </div>
                  </div>
                </div>

                {/* Distribution Analysis */}
                <div className="grid-2" style={{ marginBottom: "24px" }}>
                  <div className="card" style={{ padding: "20px" }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                      {lang === 'zh' ? '🎯 评分倾向分布' : '🎯 Rating Tendency Distribution'}
                    </h3>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常宽松 (8.0+)' : 'Very Lenient (8.0+)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.very_lenient)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '宽松 (6.5-8.0)' : 'Lenient (6.5-8.0)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.lenient)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '中等 (4.5-6.5)' : 'Moderate (4.5-6.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.moderate)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '严格 (3.0-4.5)' : 'Strict (3.0-4.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.strict)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常严格 (<3.0)' : 'Very Strict (<3.0)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.very_strict)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: "20px" }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                      {lang === 'zh' ? '📈 评分波动分布' : '📈 Rating Volatility Distribution'}
                    </h3>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常稳定 (≤0.5)' : 'Very Stable (≤0.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.very_stable)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '稳定 (0.5-1.0)' : 'Stable (0.5-1.0)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.stable)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '中等 (1.0-1.5)' : 'Moderate (1.0-1.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.moderate)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '波动 (1.5-2.5)' : 'Volatile (1.5-2.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.volatile)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常波动 (>2.5)' : 'Very Volatile (>2.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.very_volatile)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reviewer Categories */}
                {['most_lenient', 'most_strict', 'most_volatile', 'most_stable'].map((category) => (
                  <div key={category} style={{ marginBottom: "32px" }}>
                    <div className="section-header">
                      <div className="section-title">
                        {category === 'most_lenient' && (lang === 'zh' ? '🟢 最宽松审稿人' : '🟢 Most Lenient Reviewers')}
                        {category === 'most_strict' && (lang === 'zh' ? '🔴 最严格审稿人' : '🔴 Most Strict Reviewers')}
                        {category === 'most_volatile' && (lang === 'zh' ? '📊 评分波动最大审稿人' : '📊 Most Volatile Reviewers')}
                        {category === 'most_stable' && (lang === 'zh' ? '📏 评分最稳定审稿人' : '📏 Most Stable Reviewers')}
                      </div>
                    </div>
                    <div className="list-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{lang === 'zh' ? '审稿人' : 'Reviewer'}</th>
                            <th>{lang === 'zh' ? '机构' : 'Institution'}</th>
                            <th>{lang === 'zh' ? '评审数' : 'Reviews'}</th>
                            <th>{lang === 'zh' ? '平均分' : 'Avg Rating'}</th>
                            <th>{lang === 'zh' ? '标准差' : 'Std Dev'}</th>
                            <th>{lang === 'zh' ? '分数范围' : 'Range'}</th>
                            <th>{lang === 'zh' ? '平均置信度' : 'Avg Confidence'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewerAnalysis.reviewer_categories?.[category]?.slice(0, 20).map((reviewer, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>
                                <a href={`https://openreview.net/profile?id=${encodeURIComponent(reviewer.reviewer_id)}`} target="_blank" rel="noreferrer">
                                  {reviewer.reviewer_name || reviewer.reviewer_id}
                                </a>
                              </td>
                              <td className="wide" style={{ fontSize: "12px" }}>
                                {reviewer.institution || 'Unknown'}
                                {reviewer.country && reviewer.country !== 'Unknown' && (
                                  <div style={{ color: 'var(--color-muted)' }}>{reviewer.country}</div>
                                )}
                              </td>
                              <td>{fmtInt(reviewer.review_count)}</td>
                              <td>{fmt(reviewer.avg_rating, 2)}</td>
                              <td>{fmt(reviewer.rating_std, 2)}</td>
                              <td>{reviewer.rating_min}-{reviewer.rating_max}</td>
                              <td>{fmt(reviewer.avg_confidence, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* No Data State */}
            {!iclrStats && !institutionAnalysis && !conflictAnalysis && !qualityAnalysis && !reviewerAnalysis && !iclrLoading && !advancedLoading && (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>{lang === 'zh' ? '点击上方按钮加载ICLR分析数据' : 'Click the button above to load ICLR analysis data'}</p>
                <div style={{ fontSize: "14px", color: "var(--color-muted)", marginTop: "16px" }}>
                  <p><strong>{lang === 'zh' ? '基础数据:' : 'Basic Data:'}</strong> {lang === 'zh' ? '统计概览、国家分布、顶级审稿人' : 'Statistical overview, country distribution, top reviewers'}</p>
                  <p><strong>{lang === 'zh' ? '深度分析:' : 'Advanced Analysis:'}</strong> {lang === 'zh' ? '机构影响力、利益冲突、评审质量' : 'Institution influence, conflicts of interest, review quality'}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Institution Analysis Section */}
        <section className={`dim-section ${activeDim === "institution" ? "active" : ""}`} data-dim="institution">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-title">{lang === 'zh' ? '机构分析' : 'Institution Analysis'}</div>
            </div>
          </div>
          <div className="panel">
            {institutionAnalysis && (
              <>
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '总机构数' : 'Total Institutions'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(institutionAnalysis.summary_stats?.total_institutions)}</div>
                      <div className="hint">{lang === 'zh' ? '参与评审机构' : 'Participating institutions'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '顶级机构' : 'Top Institutions'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(institutionAnalysis.institution_influence?.slice(0, 10).length)}</div>
                      <div className="hint">{lang === 'zh' ? '影响力排名前10' : 'Top 10 by influence'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均影响力' : 'Avg Influence'}</div>
                    <div className="stat">
                      <div className="value">{fmt(institutionAnalysis.country_academic_power?.[0]?.academic_power_score, 1)}</div>
                      <div className="hint">{lang === 'zh' ? '机构影响力均值' : 'Average influence score'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '国家/地区' : 'Countries'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(institutionAnalysis.country_academic_power?.length)}</div>
                      <div className="hint">{lang === 'zh' ? '覆盖国家地区' : 'Countries covered'}</div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                  gap: '24px',
                  marginBottom: '32px'
                }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      🏛️ {lang === 'zh' ? '机构影响力排名' : 'Institution Influence Rankings'}
                    </h3>
                    <InstitutionInfluenceChart data={institutionAnalysis} />
                  </div>

                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      🏢 {lang === 'zh' ? '机构类型对比' : 'Institution Type Comparison'}
                    </h3>
                    <InstitutionTypeComparisonChart data={institutionAnalysis} lang={lang} />
                  </div>
                </div>

                <div className="section-title">{lang === 'zh' ? '机构参与度详细数据' : 'Institution Participation Details'}</div>
                <div className="list-scroll" style={{ maxHeight: "400px" }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>{lang === 'zh' ? '机构' : 'Institution'}</th><th>{lang === 'zh' ? '国家' : 'Country'}</th><th>{lang === 'zh' ? '总成员数' : 'Total Members'}</th><th>{lang === 'zh' ? '活跃审稿人' : 'Active Reviewers'}</th><th>{lang === 'zh' ? '参与作者' : 'Authors'}</th></tr></thead>
                    <tbody>
                      {institutionAnalysis.institution_influence?.slice(0, 20).map((inst, idx) => (
                        <tr key={inst.institution_name}>
                          <td>{idx + 1}</td><td className="wide">{inst.institution_name}</td>
                          <td>{inst.country}</td>
                          <td>{fmtInt(inst.total_members)}</td>
                          <td>{fmtInt(inst.as_reviewer)}</td>
                          <td>{fmtInt(inst.as_author)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Conflict Analysis Section */}
        <section className={`dim-section ${activeDim === "conflict" ? "active" : ""}`} data-dim="conflict">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-title">{lang === 'zh' ? '利益冲突分析' : 'Conflict Analysis'}</div>
            </div>
          </div>
          <div className="panel">
            {conflictAnalysis && (
              <>
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '冲突率' : 'Conflict Rate'}</div>
                    <div className="stat">
                      <div className="value">{fmt(conflictAnalysis.conflict_overview?.conflict_rate, 2)}%</div>
                      <div className="hint">{lang === 'zh' ? '总体利益冲突比例' : 'Overall conflict ratio'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '涉及论文' : 'Papers Involved'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(conflictAnalysis.conflict_overview?.submissions_with_conflicts)}</div>
                      <div className="hint">{lang === 'zh' ? '存在冲突的论文数量' : 'Number of papers with conflicts'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '冲突案例' : 'Conflict Cases'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(conflictAnalysis.conflict_overview?.total_conflict_instances)}</div>
                      <div className="hint">{lang === 'zh' ? '总冲突实例数' : 'Total conflict instances'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '透明度' : 'Transparency'}</div>
                    <div className="stat">
                      <div className="value">{fmt(conflictAnalysis.fairness_metrics?.institutional_transparency?.transparency_score, 1)}%</div>
                      <div className="hint">{lang === 'zh' ? '冲突披露透明度' : 'Conflict disclosure transparency'}</div>
                    </div>
                  </div>
                </div>

                <div className="section-title">{lang === 'zh' ? '机构冲突排行' : 'Institution Conflict Ranking'}</div>
                <div className="list-scroll" style={{ maxHeight: "400px" }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>{lang === 'zh' ? '机构' : 'Institution'}</th><th>{lang === 'zh' ? '国家' : 'Country'}</th><th>{lang === 'zh' ? '冲突次数' : 'Conflicts'}</th><th>{lang === 'zh' ? '涉及论文' : 'Papers'}</th><th>{lang === 'zh' ? '平均评分' : 'Avg Rating'}</th></tr></thead>
                    <tbody>
                      {conflictAnalysis.institution_conflict_ranking?.slice(0, 15).map((inst, idx) => (
                        <tr key={inst.institution_name}>
                          <td>{idx + 1}</td><td className="wide">{inst.institution_name}</td>
                          <td>{inst.country || 'Unknown'}</td><td>{inst.total_conflicts}</td>
                          <td>{inst.affected_submissions}</td>
                          <td>-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Quality Analysis Section */}
        <section className={`dim-section ${activeDim === "quality" ? "active" : ""}`} data-dim="quality">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-title">{lang === 'zh' ? '评审质量分析' : 'Quality Analysis'}</div>
            </div>
          </div>
          <div className="panel">
            {qualityAnalysis && (
              <>
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '评审覆盖率' : 'Review Coverage'}</div>
                    <div className="stat">
                      <div className="value">{fmt(qualityAnalysis.coverage_analysis?.avg_reviews_per_submission, 1)}</div>
                      <div className="hint">{lang === 'zh' ? '平均每篇论文评审数' : 'Average reviews per paper'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '高质量审稿人' : 'High Quality Reviewers'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(qualityAnalysis.system_health_metrics?.quality_distribution?.high_quality_reviewers)}</div>
                      <div className="hint">{lang === 'zh' ? '综合质量80+的审稿人' : 'Reviewers with quality score ≥ 80'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '一致性比例' : 'Consistency Ratio'}</div>
                    <div className="stat">
                      <div className="value">{fmt(qualityAnalysis.system_health_metrics?.review_consistency?.consistency_ratio, 1)}%</div>
                      <div className="hint">{lang === 'zh' ? '高一致性论文占比' : 'High consistency papers ratio'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '专家审稿人' : 'Expert Reviewers'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(qualityAnalysis.system_health_metrics?.reviewer_diversity?.expert_reviewers)}</div>
                      <div className="hint">{lang === 'zh' ? '5+评审的资深专家' : 'Senior experts with 5+ reviews'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
                  gap: '24px',
                  marginBottom: '32px'
                }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      📊 {lang === 'zh' ? '论文质量分布分析' : 'Paper Quality Distribution Analysis'}
                    </h3>
                    <QualityAnalysisChart data={qualityAnalysis} />
                  </div>

                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      🔥 {lang === 'zh' ? '评审争议度热力图' : 'Review Controversy Heatmap'}
                    </h3>
                    <ReviewControversyChart data={qualityAnalysis} lang={lang} />
                  </div>
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <div className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                      📈 {lang === 'zh' ? '审稿人严格度分布' : 'Reviewer Strictness Distribution'}
                    </h3>
                    <ReviewerStrictnessChart data={qualityAnalysis} lang={lang} />
                  </div>
                </div>

                <div className="section-title">{lang === 'zh' ? '顶级质量审稿人' : 'Top Quality Reviewers'}</div>
                <div className="list-scroll" style={{ maxHeight: "400px" }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>{lang === 'zh' ? '审稿人' : 'Reviewer'}</th><th>{lang === 'zh' ? '综合质量' : 'Overall Quality'}</th><th>{lang === 'zh' ? '一致性' : 'Consistency'}</th><th>{lang === 'zh' ? '参与度' : 'Engagement'}</th><th>{lang === 'zh' ? '经验' : 'Experience'}</th></tr></thead>
                    <tbody>
                      {qualityAnalysis.top_quality_reviewers?.slice(0, 20).map((reviewer, idx) => (
                        <tr key={reviewer.reviewer_id}>
                          <td>{idx + 1}</td><td className="wide">{reviewer.reviewer_id ? reviewer.reviewer_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' ') : 'Unknown'}</td>
                          <td>{fmt(reviewer.overall_quality_score, 1)}</td>
                          <td>{fmt(reviewer.consistency_score, 1)}</td>
                          <td>{fmt(reviewer.engagement_score, 1)}</td>
                          <td>{fmt(reviewer.experience_score, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Reviewer Analysis Section */}
        <section className={`dim-section ${activeDim === "reviewers" ? "active" : ""}`} data-dim="reviewers">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-title">{lang === 'zh' ? '审稿人分析' : 'Reviewer Analysis'}</div>
            </div>
          </div>
          <div className="panel">
            {advancedLoading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <div className="loading-spinner" style={{ margin: "0 auto 20px" }}></div>
                <p>{lang === 'zh' ? '正在加载审稿人分析数据...' : 'Loading reviewer analysis data...'}</p>
              </div>
            ) : reviewerAnalysis ? (
              <>
                <div className="grid-4" style={{ marginBottom: "24px" }}>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '分析审稿人数' : 'Reviewers Analyzed'}</div>
                    <div className="stat">
                      <div className="value">{fmtInt(reviewerAnalysis.summary_statistics?.total_reviewers_analyzed)}</div>
                      <div className="hint">{lang === 'zh' ? '3篇及以上评审' : '3+ reviews threshold'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均给分' : 'Average Rating'}</div>
                    <div className="stat">
                      <div className="value">{fmt(reviewerAnalysis.summary_statistics?.avg_rating_overall, 2)}</div>
                      <div className="hint">{lang === 'zh' ? '所有审稿人平均分' : 'Overall average rating'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均波动性' : 'Average Volatility'}</div>
                    <div className="stat">
                      <div className="value">{fmt(reviewerAnalysis.summary_statistics?.avg_volatility, 2)}</div>
                      <div className="hint">{lang === 'zh' ? '评分标准差' : 'Rating standard deviation'}</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">{lang === 'zh' ? '平均评审数' : 'Avg Reviews'}</div>
                    <div className="stat">
                      <div className="value">{fmt(reviewerAnalysis.summary_statistics?.avg_reviews_per_reviewer, 1)}</div>
                      <div className="hint">{lang === 'zh' ? '每位审稿人平均评审数' : 'Reviews per reviewer'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: "24px" }}>
                  <div className="card" style={{ padding: "20px" }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                      {lang === 'zh' ? '🎯 评分倾向分布' : '🎯 Rating Tendency Distribution'}
                    </h3>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常宽松 (8.0+)' : 'Very Lenient (8.0+)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.very_lenient)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '宽松 (6.5-8.0)' : 'Lenient (6.5-8.0)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.lenient)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '中等 (4.5-6.5)' : 'Moderate (4.5-6.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.moderate)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '严格 (3.0-4.5)' : 'Strict (3.0-4.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.strict)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常严格 (<3.0)' : 'Very Strict (<3.0)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.rating_distribution?.very_strict)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: "20px" }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                      {lang === 'zh' ? '📈 评分波动分布' : '📈 Rating Volatility Distribution'}
                    </h3>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常稳定 (≤0.5)' : 'Very Stable (≤0.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.very_stable)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '稳定 (0.5-1.0)' : 'Stable (0.5-1.0)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.stable)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '中等 (1.0-1.5)' : 'Moderate (1.0-1.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.moderate)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '波动 (1.5-2.5)' : 'Volatile (1.5-2.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.volatile)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{lang === 'zh' ? '非常波动 (>2.5)' : 'Very Volatile (>2.5)'}</span>
                        <strong>{fmtInt(reviewerAnalysis.distribution_analysis?.volatility_distribution?.very_volatile)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {['most_lenient', 'most_strict', 'most_volatile', 'most_stable'].map((category) => (
                  <div key={category} style={{ marginBottom: "32px" }}>
                    <div className="section-header">
                      <div className="section-title">
                        {category === 'most_lenient' && (lang === 'zh' ? '🟢 最宽松审稿人' : '🟢 Most Lenient Reviewers')}
                        {category === 'most_strict' && (lang === 'zh' ? '🔴 最严格审稿人' : '🔴 Most Strict Reviewers')}
                        {category === 'most_volatile' && (lang === 'zh' ? '📊 评分波动最大审稿人' : '📊 Most Volatile Reviewers')}
                        {category === 'most_stable' && (lang === 'zh' ? '📏 评分最稳定审稿人' : '📏 Most Stable Reviewers')}
                      </div>
                    </div>
                    <div className="list-scroll" style={{ maxHeight: "400px" }}>
                      <table className="table">
                        <thead><tr><th>#</th><th>{lang === 'zh' ? '审稿人' : 'Reviewer'}</th><th>{lang === 'zh' ? '评审数' : 'Reviews'}</th><th>{category === 'most_lenient' || category === 'most_strict' ? (lang === 'zh' ? '平均分' : 'Avg Rating') : (lang === 'zh' ? '波动性' : 'Volatility')}</th><th>{lang === 'zh' ? '置信度' : 'Confidence'}</th><th>{lang === 'zh' ? '分数范围' : 'Rating Range'}</th></tr></thead>
                        <tbody>
                          {reviewerAnalysis.reviewer_categories?.[category]?.slice(0, 10).map((reviewer, idx) => (
                            <tr key={reviewer.reviewer_id}>
                              <td>{idx + 1}</td><td className="wide">{reviewer.reviewer_id ? reviewer.reviewer_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' ') : 'Unknown'}</td>
                              <td>{reviewer.review_count}</td>
                              <td>{fmt(reviewer.avg_rating, 2)}</td>
                              <td>{fmt(reviewer.avg_confidence, 1)}</td>
                              <td>{fmt(reviewer.min_rating, 1)} - {fmt(reviewer.max_rating, 1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <p style={{ color: "var(--color-muted)" }}>
                  {lang === 'zh' ? '没有找到审稿人分析数据' : 'No reviewer analysis data found'}
                </p>
                <button 
                  className="toggle-btn"
                  onClick={loadStaticAnalysisData}
                  style={{ marginTop: "16px" }}
                >
                  {lang === 'zh' ? '重新加载' : 'Reload Data'}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={`dim-section ${activeDim === "search" ? "active" : ""}`} data-dim="search">
          <div className="section-header">
            <div className="section-title">🔍 Search Submissions & Reviewers</div>
          </div>
          <div className="panel">
            <div style={{ marginBottom: '24px' }}>
              <div style={{ 
                background: 'var(--color-surface)', 
                borderRadius: '12px', 
                padding: '24px', 
                marginBottom: '20px',
                border: '2px solid var(--color-secondary)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-primary)', fontSize: '18px' }}>
                  Smart Search - Two Ways to Explore
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '14px' }}>
                  <div style={{ 
                    padding: '16px', 
                    background: 'var(--color-bg)', 
                    borderRadius: '8px',
                    border: '1px solid var(--color-accent)'
                  }}>
                    <strong style={{ color: 'var(--color-accent)' }}>📄 Search by Submission Number</strong>
                    <div style={{ margin: '8px 0', color: 'var(--color-muted)' }}>
                      Find reviewers who evaluated a specific paper
                    </div>
                    <div style={{ fontFamily: 'monospace', background: 'var(--color-surface)', padding: '8px', borderRadius: '4px' }}>
                      Try: <strong>1</strong> or <strong>2765</strong>
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--color-muted)' }}>
                      → Shows reviewers, ratings, confidence scores, and review summaries
                    </div>
                  </div>
                  <div style={{ 
                    padding: '16px', 
                    background: 'var(--color-bg)', 
                    borderRadius: '8px',
                    border: '1px solid var(--color-accent)'
                  }}>
                    <strong style={{ color: 'var(--color-accent)' }}>👤 Search by Person Name</strong>
                    <div style={{ margin: '8px 0', color: 'var(--color-muted)' }}>
                      Find what someone reviewed or authored
                    </div>
                    <div style={{ fontFamily: 'monospace', background: 'var(--color-surface)', padding: '8px', borderRadius: '4px' }}>
                      Try: <strong>David</strong> or <strong>Kim</strong>
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--color-muted)' }}>
                      → Shows reviewed papers, authored papers, and reviewer statistics
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="auth-grid" style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div className="field">
                  <label style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'block' }}>
                    🔎 Enter Submission Number or Person Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="search-input"
                      type="text"
                      placeholder="e.g., 1234 or 'David Kim'"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !searchLoading && searchTerm.trim()) {
                          doSearch();
                        }
                      }}
                      style={{ 
                        fontSize: '18px', 
                        padding: '20px 24px', 
                        borderRadius: '12px',
                        border: '2px solid var(--color-secondary)',
                        width: '100%',
                        paddingRight: '150px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        ':focus': { 
                          borderColor: 'var(--color-primary)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                        }
                      }}
                    />
                    <div style={{ 
                      position: 'absolute', 
                      right: '20px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      fontSize: '14px', 
                      color: 'var(--color-muted)',
                      pointerEvents: 'none'
                    }}>
                      Press Enter ↵
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--color-muted)', 
                    marginTop: '12px',
                    textAlign: 'center'
                  }}>
                    💡 Case-insensitive search with fuzzy matching<br /> • Click any OpenReview link to visit profiles
                  </div>
                </div>
                <div className="buttons" style={{ justifyContent: 'center' }}>
                  <button 
                    onClick={doSearch} 
                    disabled={searchLoading || !searchTerm.trim()}
                    style={{ 
                      padding: '12px 32px', 
                      fontSize: '16px', 
                      borderRadius: '8px',
                      background: searchLoading || !searchTerm.trim() ? 'var(--color-muted)' : 'var(--color-primary)',
                      border: 'none',
                      color: 'white',
                      cursor: searchLoading || !searchTerm.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {searchLoading ? "🔄 Searching..." : "🔍 Search"}
                  </button>
                </div>
                {searchError && (
                  <div style={{ 
                    color: 'var(--color-error)', 
                    textAlign: 'center', 
                    fontSize: '14px',
                    padding: '12px',
                    background: 'rgba(255, 0, 0, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 0, 0, 0.2)'
                  }}>
                    ⚠️ {searchError}
                  </div>
                )}
              </div>
            </div>
            {searchResults && searchResults.type === 'submission' && (
              <div style={{ marginTop: '32px' }}>
                <div className="section-header">
                  <div className="section-title">
                    📄 Submission #{searchResults.submission_number} • {searchResults.reviews?.length || 0} reviewers • {searchResults.authors?.length || 0} authors • Avg: {fmt(searchResults.statistics?.avg_rating, 1)}/10
                  </div>
                </div>
                
                {searchResults.authors && (
                  <div className="panel" style={{ marginBottom: '16px' }}>
                    <div style={{ 
                      padding: '12px 16px', 
                      fontWeight: 600, 
                      borderBottom: '1px solid var(--color-secondary)'
                    }}>
                      ✍️ Authors ({searchResults.authors.length || 0})
                    </div>
                    <div className="list-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>👤 Author</th>
                            <th>🌍 Country</th>
                            <th>🏫 Institution</th>
                            <th>🆔 ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.authors.map((author, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td className="wide">
                                <a 
                                  href={`https://openreview.net/profile?id=${author.author_id}`}
                                  target="_blank" 
                                  rel="noreferrer"
                                  style={{ 
                                    color: 'var(--color-primary)', 
                                    textDecoration: 'none',
                                    fontWeight: '500'
                                  }}
                                >
                                  {author.author_name}
                                </a>
                              </td>
                              <td>{formatValue(author.author_nationality)}</td>
                              <td className="wide">
                                {(() => {
                                  if (author.author_institution && typeof author.author_institution === 'string' && author.author_institution.startsWith('{')) {
                                    try {
                                      const inst = JSON.parse(author.author_institution);
                                      return formatValue(inst && inst.name);
                                    } catch {
                                      return formatValue(author.author_institution);
                                    }
                                  }
                                  return formatValue(author.author_institution);
                                })()}
                              </td>
                              <td style={{ fontFamily: 'monospace' }}>{author.author_id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="panel">
                  <div className="list-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>👤 Reviewer</th>
                          <th>🌍 Nationality</th>
                          <th>🚻 Gender</th>
                          <th>🏫 Institution</th>
                          <th>⭐ Rating</th>
                          <th>🎯 Confidence</th>
                          <th>📝 Reviews</th>
                          <th>📊 Summary</th>
                          <th>💪 Strengths</th>
                          <th>⚠️ Weaknesses</th>
                          <th>❓ Questions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.reviews?.map((r, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <a href={r.reviewer_profile_url} target="_blank" rel="noreferrer">
                                {r.reviewer_name}
                              </a>
                            </td>
                            <td>{r.reviewer_nationality || 'Unknown'}</td>
                            <td>
                              {r.reviewer_gender === 'Male' ? '👨 Male' : r.reviewer_gender === 'Female' ? '👩 Female' : (r.reviewer_gender || 'Unknown')}
                            </td>
                            <td>
                              {r.reviewer_institution ? (() => {
                                if (typeof r.reviewer_institution === 'object' && r.reviewer_institution.name) {
                                  return `${r.reviewer_institution.name} (${r.reviewer_institution.country})`;
                                } else if (typeof r.reviewer_institution === 'string' && r.reviewer_institution.startsWith('{')) {
                                  try {
                                    const inst = JSON.parse(r.reviewer_institution);
                                    return inst.name || 'Unknown';
                                  } catch {
                                    return r.reviewer_institution;
                                  }
                                }
                                return r.reviewer_institution;
                              })() : 'Unknown'}
                            </td>
                            <td>{fmt(r.rating, 1)}</td>
                            <td>{fmt(r.confidence, 1)}</td>
                            <td>{r.reviewer_total_reviews || 0}</td>
                            <td className="wide">{r.review_summary ? r.review_summary.substring(0, 100) + '...' : 'No summary'}</td>
                            <td className="wide">{r.review_strengths && Array.isArray(r.review_strengths) ? r.review_strengths.join('; ').substring(0, 100) + '...' : (r.review_strengths ? r.review_strengths.substring(0, 100) + '...' : 'No strengths')}</td>
                            <td className="wide">{r.review_weaknesses && Array.isArray(r.review_weaknesses) ? r.review_weaknesses.join('; ').substring(0, 100) + '...' : (r.review_weaknesses ? r.review_weaknesses.substring(0, 100) + '...' : 'No weaknesses')}</td>
                            <td className="wide">{r.review_questions && Array.isArray(r.review_questions) ? r.review_questions.join('; ').substring(0, 100) + '...' : (r.review_questions ? r.review_questions.substring(0, 100) + '...' : 'No questions')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {searchResults && searchResults.type === 'person' && (
              <div style={{ marginTop: '32px' }}>
                <div className="section-header">
                  <div className="section-title">
                    👤 {t('search_results_for')} "{searchResults.query}" • {searchResults.total || 0} {t('people_found')}
                  </div>
                </div>
                <div className="panel">
                  <div className="list-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>👤 Name</th>
                          <th>🌍 Country</th>
                          <th>🚻 Gender</th>
                          <th>🏫 Institution</th>
                          <th>🏢 Type</th>
                          <th>📝 Reviews Given</th>
                          <th>📄 Papers Authored</th>
                          <th>⭐ Avg Rating Given</th>
                          <th>🔍 Reviewed By</th>
                          <th>📋 Reviewed Others</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.results?.map((person, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td className="wide">
                              <a 
                                href={person.reviewer_stats?.profile_url || `https://openreview.net/profile?id=${person.person_id}`}
                                target="_blank" 
                                rel="noreferrer"
                                style={{ 
                                  color: "var(--color-primary)", 
                                  textDecoration: 'none',
                                  fontWeight: '500'
                                }}
                              >
                                {person.name || person.person_id.replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' ')}
                              </a>
                              <div style={{ 
                                fontSize: '12px', 
                                color: 'var(--color-muted)',
                                fontFamily: 'monospace',
                                marginTop: '2px'
                              }}>
                                ID: {person.person_id}
                              </div>
                            </td>
                            <td>
                              {(() => {
                                if (typeof person.institution === 'object' && person.institution && person.institution.country) {
                                  return person.institution.country;
                                } else {
                                  try {
                                    const inst = typeof person.institution === 'string' && person.institution.startsWith('{') 
                                      ? JSON.parse(person.institution) 
                                      : person.institution;
                                    return formatValue((inst && inst.country) || person.nationality);
                                  } catch {
                                    return formatValue(person.nationality);
                                  }
                                }
                              })()}
                            </td>
                            <td>
                              {person.gender === 'Male' ? '👨 Male' : 
                               person.gender === 'Female' ? '👩 Female' : 
                               person.gender && person.gender !== 'Unknown' ? `🧑 ${person.gender}` : ''}
                            </td>
                            <td className="wide">
                              {person.institution ? (() => {
                                if (typeof person.institution === 'object' && person.institution && person.institution.name) {
                                  return person.institution.name;
                                } else {
                                  try {
                                    const inst = typeof person.institution === 'string' && person.institution.startsWith('{') 
                                      ? JSON.parse(person.institution) 
                                      : person.institution;
                                    if (inst && inst.name) {
                                      return inst.name;
                                    } else {
                                      return formatValue(person.institution);
                                    }
                                  } catch {
                                    return formatValue(person.institution);
                                  }
                                }
                              })() : ''}
                            </td>
                            <td>
                              {(() => {
                                if (typeof person.institution === 'object' && person.institution && person.institution.type) {
                                  return person.institution.type;
                                } else {
                                  try {
                                    const inst = typeof person.institution === 'string' && person.institution.startsWith('{') 
                                      ? JSON.parse(person.institution) 
                                      : person.institution;
                                    return formatValue(inst && inst.type);
                                  } catch {
                                    return '';
                                  }
                                }
                              })()}
                            </td>
                            <td>
                              {person.reviewer_stats ? (
                                <div>
                                  <strong>{person.reviewer_stats.review_count || 0}</strong>
                                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                                    reviews
                                  </div>
                                </div>
                              ) : (
                                <div style={{ color: 'var(--color-muted)' }}>-</div>
                              )}
                            </td>
                            <td>
                              <div>
                                <strong>{person.authored_papers_count || 0}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                                  papers
                                </div>
                              </div>
                            </td>
                            <td>
                              {person.reviewer_stats?.avg_rating ? (
                                <div>
                                  <strong>{fmt(person.reviewer_stats.avg_rating, 1)}</strong>
                                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                                    /10
                                  </div>
                                </div>
                              ) : (
                                <div style={{ color: 'var(--color-muted)' }}>-</div>
                              )}
                            </td>
                            <td>
                              <div>
                                <strong>{person.reviewed_by_count || 0}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                                  reviewers
                                </div>
                              </div>
                            </td>
                            <td>
                              <div>
                                <strong>{person.reviewed_others_count || 0}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                                  authors
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Expanded Details Sections */}
                  {searchResults.results?.map((person, idx) => (
                    <div key={`expanded-${idx}`}>
                      {/* 被谁审过 - Reviewed By Details */}
                      {person.reviewed_by_others && person.reviewed_by_others.length > 0 && (
                        <div style={{ 
                          margin: '20px 16px',
                          background: 'var(--color-surface)',
                          borderRadius: '8px',
                          border: '2px solid var(--color-accent)',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            background: 'var(--color-accent)',
                            color: 'white',
                            padding: '12px 16px',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            🔍 {person.name} {lang === 'zh' ? '被谁审过' : 'Reviewed by'} {person.reviewed_by_others.length} {lang === 'zh' ? '位审稿人' : 'reviewers'}
                          </div>
                          <div className="list-scroll">
                            <table className="table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>📄 Paper</th>
                                  <th>👨‍🔬 Reviewer</th>
                                  <th>🌍 Country</th>
                                  <th>🏫 Institution</th>
                                  <th>🏢 Type</th>
                                  <th>⭐ Rating</th>
                                  <th>🎯 Confidence</th>
                                </tr>
                              </thead>
                              <tbody>
                                {person.reviewed_by_others.map((review, reviewIdx) => (
                                  <tr key={reviewIdx}>
                                    <td>{reviewIdx + 1}</td>
                                    <td>
                                      <a 
                                        href={review.openreview_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ 
                                          color: 'var(--color-primary)', 
                                          textDecoration: 'none',
                                          fontWeight: '500'
                                        }}
                                      >
                                        #{review.submission_number}
                                      </a>
                                    </td>
                                    <td className="wide">
                                      <a 
                                        href={`https://openreview.net/profile?id=${review.reviewer_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ 
                                          color: 'var(--color-primary)', 
                                          textDecoration: 'none',
                                          fontWeight: '500'
                                        }}
                                      >
                                        {review.reviewer_name}
                                      </a>
                                    </td>
                                    <td>
                                      {(() => {
                                        if (review.reviewer_institution && typeof review.reviewer_institution === 'string' && review.reviewer_institution.startsWith('{')) {
                                          try {
                                            const inst = JSON.parse(review.reviewer_institution);
                                            return formatValue((inst && inst.country) || review.reviewer_nationality);
                                          } catch {
                                            return formatValue(review.reviewer_nationality);
                                          }
                                        } else {
                                          return formatValue(review.reviewer_nationality);
                                        }
                                      })()}
                                    </td>
                                    <td className="wide">
                                      {(() => {
                                        if (review.reviewer_institution && typeof review.reviewer_institution === 'string' && review.reviewer_institution.startsWith('{')) {
                                          try {
                                            const inst = JSON.parse(review.reviewer_institution);
                                            return formatValue(inst && inst.name);
                                          } catch {
                                            return formatValue(review.reviewer_institution);
                                          }
                                        } else {
                                          return formatValue(review.reviewer_institution);
                                        }
                                      })()}
                                    </td>
                                    <td>
                                      {(() => {
                                        if (review.reviewer_institution && typeof review.reviewer_institution === 'string' && review.reviewer_institution.startsWith('{')) {
                                          try {
                                            const inst = JSON.parse(review.reviewer_institution);
                                            return formatValue(inst && inst.type);
                                          } catch {
                                            return '';
                                          }
                                        } else {
                                          return '';
                                        }
                                      })()}
                                    </td>
                                    <td>
                                      {review.rating ? (
                                        <strong style={{ color: 'var(--color-accent)' }}>
                                          {review.rating}/10
                                        </strong>
                                      ) : '-'}
                                    </td>
                                    <td>
                                      {review.confidence ? (
                                        <strong style={{ color: 'var(--color-primary)' }}>
                                          {review.confidence}/5
                                        </strong>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 审过谁 - Reviewed Others Details */}
                      {person.reviewed_others_details && person.reviewed_others_details.length > 0 && (
                        <div style={{ 
                          margin: '20px 16px',
                          background: 'var(--color-surface)',
                          borderRadius: '8px',
                          border: '2px solid var(--color-primary)',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            background: 'var(--color-primary)',
                            color: 'white',
                            padding: '12px 16px',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            📋 {person.name} {lang === 'zh' ? '审过谁' : 'Reviewed'} {person.reviewed_others_details.length} {lang === 'zh' ? '篇论文' : 'papers by others'}
                          </div>
                          <div className="list-scroll">
                            <table className="table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>📄 Paper</th>
                                  <th>✍️ Author</th>
                                  <th>🌍 Country</th>
                                  <th>🏫 Institution</th>
                                  <th>🏢 Type</th>
                                  <th>⭐ Rating Given</th>
                                  <th>🎯 Confidence</th>
                                </tr>
                              </thead>
                              <tbody>
                                {person.reviewed_others_details.map((review, reviewIdx) => (
                                  <tr key={reviewIdx}>
                                    <td>{reviewIdx + 1}</td>
                                    <td>
                                      <a 
                                        href={review.openreview_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ 
                                          color: 'var(--color-primary)', 
                                          textDecoration: 'none',
                                          fontWeight: '500'
                                        }}
                                      >
                                        #{review.submission_number}
                                      </a>
                                    </td>
                                    <td className="wide">
                                      <a 
                                        href={`https://openreview.net/profile?id=${review.author_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ 
                                          color: 'var(--color-primary)', 
                                          textDecoration: 'none',
                                          fontWeight: '500'
                                        }}
                                      >
                                        {review.author_name}
                                      </a>
                                    </td>
                                    <td>
                                      {(() => {
                                        if (review.author_institution && typeof review.author_institution === 'string' && review.author_institution.startsWith('{')) {
                                          try {
                                            const inst = JSON.parse(review.author_institution);
                                            return formatValue((inst && inst.country) || review.author_nationality);
                                          } catch {
                                            return formatValue(review.author_nationality);
                                          }
                                        } else {
                                          return formatValue(review.author_nationality);
                                        }
                                      })()}
                                    </td>
                                    <td className="wide">
                                      {(() => {
                                        if (review.author_institution && typeof review.author_institution === 'string' && review.author_institution.startsWith('{')) {
                                          try {
                                            const inst = JSON.parse(review.author_institution);
                                            return formatValue(inst && inst.name);
                                          } catch {
                                            return formatValue(review.author_institution);
                                          }
                                        } else {
                                          return formatValue(review.author_institution);
                                        }
                                      })()}
                                    </td>
                                    <td>
                                      {(() => {
                                        if (review.author_institution && typeof review.author_institution === 'string' && review.author_institution.startsWith('{')) {
                                          try {
                                            const inst = JSON.parse(review.author_institution);
                                            return formatValue(inst && inst.type);
                                          } catch {
                                            return '';
                                          }
                                        } else {
                                          return '';
                                        }
                                      })()}
                                    </td>
                                    <td>
                                      {review.rating ? (
                                        <strong style={{ color: 'var(--color-accent)' }}>
                                          {review.rating}/10
                                        </strong>
                                      ) : '-'}
                                    </td>
                                    <td>
                                      {review.confidence ? (
                                        <strong style={{ color: 'var(--color-primary)' }}>
                                          {review.confidence}/5
                                        </strong>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div style={{ 
                    padding: '16px', 
                    background: 'var(--color-bg)', 
                    borderTop: '1px solid var(--color-secondary)',
                    fontSize: '14px',
                    color: 'var(--color-muted)',
                    textAlign: 'center'
                  }}>
                    💡 {lang === 'zh' 
                      ? '点击姓名访问OpenReview个人资料 • 详细的审稿关系在有数据时自动显示在下方' 
                      : 'Click names to visit OpenReview profiles • Detailed review relationships are automatically displayed below when available'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>
    </>
  );
}
