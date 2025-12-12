'use client';

import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function InstitutionTypeComparisonChart({ data, lang = 'en' }) {
  if (!data || !data.institution_type_analysis) return <div>Loading...</div>;
  
  const typeAnalysis = data.institution_type_analysis;
  
  // Get university and company data from object structure
  const universityData = typeAnalysis.University || {};
  const companyData = typeAnalysis.Company || {};
  
  const chartData = {
    labels: [
      lang === 'zh' ? '评审数量' : 'Reviewers', 
      lang === 'zh' ? '成员规模' : 'Total Members',
      lang === 'zh' ? '机构数量' : 'Institution Count',
      lang === 'zh' ? '国际化程度' : 'International Reach',
      lang === 'zh' ? '人均参与度' : 'Per-Institution Density',
      lang === 'zh' ? '活跃比例' : 'Activity Ratio'
    ],
    datasets: [
      {
        label: lang === 'zh' ? '大学' : 'Universities',
        data: [
          Math.min((parseInt(universityData.reviewer_count) || 0) / 50, 100), // Normalize reviewer count
          Math.min((parseInt(universityData.total_members) || 0) / 100, 100), // Normalize members
          Math.min((parseInt(universityData.institution_count) || 0) / 10, 100), // Institution count
          (universityData.countries && universityData.countries.length ? Math.min(universityData.countries.length * 5, 100) : 50), // International reach
          parseInt(universityData.avg_members_per_institution) * 2 || 50, // Member density per institution
          Math.min(((parseInt(universityData.reviewer_count) || 0) / (parseInt(universityData.total_members) || 1)) * 100, 100) // Activity ratio
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
      },
      {
        label: lang === 'zh' ? '公司' : 'Companies',
        data: [
          Math.min((parseInt(companyData.reviewer_count) || 0) / 50, 100), // Normalize reviewer count
          Math.min((parseInt(companyData.total_members) || 0) / 100, 100), // Normalize members
          Math.min((parseInt(companyData.institution_count) || 0) / 10, 100), // Institution count
          (companyData.countries && companyData.countries.length ? Math.min(companyData.countries.length * 5, 100) : 50), // International reach
          parseInt(companyData.avg_members_per_institution) * 2 || 50, // Member density per institution
          Math.min(((parseInt(companyData.reviewer_count) || 0) / (parseInt(companyData.total_members) || 1)) * 100, 100) // Activity ratio
        ],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          display: true
        },
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
        },
        pointLabels: {
          font: {
            size: 12
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: lang === 'zh' ? '大学 vs 公司：学术参与特征对比' : 'Universities vs Companies: Academic Participation Comparison',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.r.toFixed(1);
            return `${label}: ${value}%`;
          }
        }
      }
    }
  };

  return (
    <div style={{ height: '400px', position: 'relative' }}>
      <Radar data={chartData} options={options} />
    </div>
  );
}