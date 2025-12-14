'use client';

export default function StatsCards({ stats, lang = 'en' }) {
  // Calculate total people from top countries data
  const totalPeople = stats?.top_countries?.reduce((sum, country) => sum + (country.total_academic_members || 0), 0) || stats?.total_reviewers || 0;
  const translations = {
    en: {
      totalReviews: 'Total Reviews',
      totalPeople: 'Total Reviewers',
      institutions: 'Institutions',
      submissions: 'Submissions',
      avgRating: 'Avg Rating',
      avgConfidence: 'Avg Confidence'
    },
    zh: {
      totalReviews: '总评审数',
      totalPeople: '总审稿人数',
      institutions: '机构数',
      submissions: '投稿数',
      avgRating: '平均评分',
      avgConfidence: '平均置信度'
    }
  };
  
  const t = translations[lang] || translations.en;
  
  const cards = [
    {
      title: t.totalReviews,
      value: stats?.total_reviews?.toLocaleString() || '0',
      icon: '📝',
      color: '#FF6384'
    },
    {
      title: t.totalPeople,
      value: totalPeople?.toLocaleString() || '0', 
      icon: '👥',
      color: '#36A2EB'
    },
    {
      title: t.institutions,
      value: stats?.institutions_count?.toLocaleString() || '0',
      icon: '🏫',
      color: '#FFCE56'
    },
    {
      title: t.submissions,
      value: stats?.total_submissions?.toLocaleString() || '0',
      icon: '📄',
      color: '#4BC0C0'
    },
    {
      title: t.avgRating,
      value: stats?.avg_rating?.toFixed(2) || '0.00',
      icon: '⭐',
      color: '#9966FF'
    },
    {
      title: t.avgConfidence,
      value: stats?.avg_confidence?.toFixed(2) || '0.00',
      icon: '🎯',
      color: '#FF9F40'
    }
  ];

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
      gap: '16px',
      marginBottom: '24px'
    }}
    className="stats-cards-grid">
      {cards.map((card, index) => (
        <div key={index} style={{
          background: 'var(--color-surface)',
          border: '2px solid var(--color-secondary)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{card.icon}</div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: card.color,
            marginBottom: '4px'
          }}>
            {card.value}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: 'var(--color-muted)',
            fontWeight: '500'
          }}>
            {card.title}
          </div>
        </div>
      ))}
    </div>
  );
}