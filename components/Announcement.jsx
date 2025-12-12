'use client';
import { useState } from 'react';

export default function Announcement({ lang: initialLang = 'en', onClose }) {
  const [lang, setLang] = useState(initialLang);
  const content = {
    en: {
      title: '🎉 v0.03 Update Released!',
      features: [
        '🤖 Data Analysis Enhancement: Using GPT-5-nano for intelligent data analysis, including:',
        '   • Country and institution type (University/Company) classification',
        '   • Gender and nationality inference for reviewers',
        '   • Deep insights and relationship analysis',
        '🔍 Enhanced Search Capabilities:',
        '   • Search by submission number to view all reviewers and their details',
        '   • Search by person name to see papers they authored and reviewed',
        '   • Complete profile information with gender, nationality, and institution',
        '📊 Visual Analytics: New interactive charts showing reviewer distribution, institution comparisons, and review controversies'
      ],
      nextUpdate: '📢 Coming in v0.04: Data sanitization and open-source release on GitHub for community contributions and further analysis!',
      closeBtn: 'Got it!'
    },
    zh: {
      title: '🎉 v0.03 版本更新发布！',
      features: [
        '🤖 数据分析增强：使用 GPT-5-nano 对数据进行智能分析，包括：',
        '   • 为机构推测国家和类型（大学/公司）',
        '   • 为人员推测国家和性别信息',
        '   • 深层次的关系分析和洞察',
        '🔍 搜索功能升级：',
        '   • 根据论文编号搜索，查看所有审稿人及其详细信息',
        '   • 根据人员姓名搜索，查看此人投稿和审稿的论文',
        '   • 完整的个人信息展示，包括性别、国籍和机构',
        '📊 可视化分析：新增交互式图表，展示审稿人分布、机构对比和评审争议度'
      ],
      nextUpdate: '📢 v0.04 预告：将整理数据，脱敏处理后开源在 GitHub，让社区可以公开修改和做进一步数据分析！',
      closeBtn: '知道了！'
    }
  };

  const t = content[lang] || content.en;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px',
          borderRadius: '16px 16px 0 0',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>{t.title}</h2>
          <button
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            {lang === 'en' ? '中文' : 'English'}
          </button>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            {t.features.map((feature, idx) => (
              <div key={idx} style={{ 
                marginBottom: '12px',
                fontSize: '15px',
                lineHeight: '1.6',
                color: 'var(--color-text)'
              }}>
                {feature}
              </div>
            ))}
          </div>
          
          <div style={{
            background: 'var(--color-bg)',
            border: '2px solid var(--color-accent)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--color-primary)' }}>
              {t.nextUpdate}
            </div>
          </div>
          
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px 24px',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}