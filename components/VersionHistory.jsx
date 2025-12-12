"use client";
import { useState } from "react";

const versionData = [
  {
    version: "v0.03",
    date: "2025-11-29",
    time: "18:00",
    changes: {
      en: [
        "🤖 Data Analysis Enhancement: Using GPT-5-nano for intelligent data analysis",
        "• Country and institution type (University/Company) classification",
        "• Gender and nationality inference for reviewers",
        "• Deep insights and relationship analysis",
        "🔍 Enhanced Search Capabilities:",
        "• Search by submission number to view all reviewers",
        "• Search by person name to see papers authored and reviewed",
        "• Complete profile information with gender, nationality, and institution",
        "📊 Visual Analytics: New interactive charts for data visualization",
        "• Global reviewer distribution",
        "• Institution influence analysis",
        "• Review controversy heatmap"
      ],
      zh: [
        "🤖 数据分析增强：使用 GPT-5-nano 对数据进行智能分析",
        "• 为机构推测国家和类型（大学/公司）",
        "• 为人员推测国家和性别信息",
        "• 深层次的关系分析和洞察",
        "🔍 搜索功能升级：",
        "• 根据论文编号搜索，查看所有审稿人详细信息",
        "• 根据人员姓名搜索，查看此人投稿和审稿的论文",
        "• 完整的个人信息展示，包括性别、国籍和机构",
        "📊 可视化分析：新增交互式图表",
        "• 全球审稿人分布图",
        "• 机构影响力分析",
        "• 评审争议度热力图"
      ]
    },
    type: "major"
  },
  {
    version: "v0.02",
    date: "2025-11-29",
    time: "01:10",
    changes: {
      en: [
        "Improved search speed and query response time",
        "The author and reviewer affiliation information has been processed, and a new conflict analysis is underway.",
        "Note: Despite potential ICLR review score rollbacks, this data remains valuable for niche research and identifying potential conflicts"
      ],
      zh: [
        "优化查询速度，提升搜索响应时间", 
        "已经处理好了作者和审稿人的工作单位资料，正在做新的冲突分析",
        "注：虽然ICLR可能会回滚评分，但此数据仍有价值，可助你发现小领域资料及潜在的别有用心者"
      ]
    },
    type: "minor"
  },
  {
    version: "v0.01",
    date: "2025-11-28", 
    time: "12:00",
    changes: {
      en: [
        "Initial platform launch with core functionality",
        "Basic data visualization and statistics display",
        "User authentication and login system",
        "Search specific papers to view reviewer information after login",
        "Community posting and discussion features"
      ],
      zh: [
        "平台正式上线，核心功能就位",
        "基础数据展示和统计功能",
        "用户登录认证系统",
        "登录后可查询指定论文的审稿人信息",
        "社区发帖和讨论功能"
      ]
    },
    type: "major"
  }
];

export default function VersionHistory({ isOpen, onClose, lang = "en" }) {
  const [expandedVersions, setExpandedVersions] = useState(new Set([versionData[0].version]));

  if (!isOpen) return null;

  const toggleVersion = (version) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  const getVersionTypeColor = (type) => {
    switch (type) {
      case 'major': return '#d4af37';
      case 'minor': return '#e5e5e5';
      case 'patch': return '#525252';
      default: return '#e5e5e5';
    }
  };

  const getVersionTypeLabel = (type) => {
    const labels = {
      en: {
        major: 'Major Update',
        minor: 'Feature Update',
        patch: 'Bug Fix'
      },
      zh: {
        major: '重大更新',
        minor: '功能更新',
        patch: '修复补丁'
      }
    };
    return labels[lang]?.[type] || labels.en[type] || 'Update';
  };

  return (
    <div className="version-history-overlay" onClick={onClose}>
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="version-header">
          <h2>{lang === 'zh' ? '版本更新历史' : 'Version History'}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        
        <div className="version-content">
          {versionData.map((version) => (
            <div key={version.version} className="version-item">
              <div 
                className="version-header-info"
                onClick={() => toggleVersion(version.version)}
              >
                <div className="version-left">
                  <span className="version-number">{version.version}</span>
                  <span 
                    className="version-badge"
                    style={{ backgroundColor: getVersionTypeColor(version.type) }}
                  >
                    {getVersionTypeLabel(version.type)}
                  </span>
                </div>
                <div className="version-right">
                  <span className="version-date">
                    {version.date}
                    {version.time && <span className="version-time"> {version.time}</span>}
                  </span>
                  <svg 
                    className={`expand-icon ${expandedVersions.has(version.version) ? 'expanded' : ''}`}
                    width="16" 
                    height="16" 
                    viewBox="0 0 16 16" 
                    fill="none" 
                    stroke="currentColor"
                  >
                    <path d="M4 6l4 4 4-4" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              
              {expandedVersions.has(version.version) && (
                <div className="version-changes">
                  <ul>
                    {version.changes[lang]?.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    )) || version.changes.en.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="version-footer">
          <p>{lang === 'zh' ? '当前版本' : 'Current Version'}: v{versionData[0].version}</p>
        </div>
      </div>

      <style jsx>{`
        .version-history-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .version-history-modal {
          background: var(--color-surface);
          border: var(--border-width) solid var(--color-secondary);
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow);
        }

        .version-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid var(--color-secondary);
        }

        .version-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--color-primary);
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--color-text);
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .version-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .version-item {
          margin-bottom: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .version-item:hover {
          border-color: var(--color-primary);
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.1);
        }

        .version-header-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          cursor: pointer;
          user-select: none;
        }

        .version-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .version-number {
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text);
        }

        .version-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: #0a0a0a;
        }

        .version-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .version-date {
          color: var(--color-muted);
          font-size: 14px;
        }

        .version-time {
          opacity: 0.8;
          font-size: 12px;
        }

        .expand-icon {
          transition: transform 0.3s ease;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .version-changes {
          padding: 0 20px 16px;
          animation: slideDown 0.3s ease;
        }

        .version-changes ul {
          margin: 0;
          padding-left: 20px;
        }

        .version-changes li {
          margin-bottom: 8px;
          color: var(--color-text);
          opacity: 0.9;
          font-size: 14px;
          line-height: 1.6;
        }

        .version-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--color-secondary);
          text-align: center;
        }

        .version-footer p {
          margin: 0;
          color: var(--color-muted);
          font-size: 14px;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .version-history-modal {
            max-height: 90vh;
          }
          
          .version-header h2 {
            font-size: 20px;
          }
          
          .version-number {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}