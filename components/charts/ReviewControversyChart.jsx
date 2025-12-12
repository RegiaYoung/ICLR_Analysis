'use client';

import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function ReviewControversyChart({ data, lang = 'en' }) {
  // Generate controversy data based on rating variance
  const generateControversyData = () => {
    if (!data || !data.paper_quality_analysis) return [];
    
    return data.paper_quality_analysis
      .filter(paper => paper.review_count >= 3) // Only papers with 3+ reviews
      .map(paper => ({
        x: paper.avg_rating || 0,
        y: paper.rating_variance || 0,
        label: `Paper #${paper.submission_number}`,
        reviewCount: paper.review_count
      }))
      .slice(0, 200); // Limit to top 200 for performance
  };
  
  const controversyData = generateControversyData();
  
  const chartData = {
    datasets: [
      {
        label: lang === 'zh' ? '低争议论文' : 'Low Controversy Papers',
        data: controversyData.filter(d => d.y < 2),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        pointRadius: 5,
      },
      {
        label: lang === 'zh' ? '中等争议论文' : 'Medium Controversy Papers', 
        data: controversyData.filter(d => d.y >= 2 && d.y < 4),
        backgroundColor: 'rgba(255, 205, 86, 0.6)',
        borderColor: 'rgba(255, 205, 86, 1)',
        borderWidth: 1,
        pointRadius: 6,
      },
      {
        label: lang === 'zh' ? '高争议论文' : 'High Controversy Papers',
        data: controversyData.filter(d => d.y >= 4),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        pointRadius: 7,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: lang === 'zh' ? '平均评分' : 'Average Rating'
        },
        min: 0,
        max: 10
      },
      y: {
        title: {
          display: true,
          text: lang === 'zh' ? '评分方差 (争议度)' : 'Rating Variance (Controversy)'
        },
        min: 0,
        max: 10
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: lang === 'zh' ? '论文评审争议度分析 - 识别分歧较大的论文' : 'Paper Review Controversy Analysis - Identifying Papers with High Disagreement',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const point = context.parsed;
            const raw = context.raw;
            return [
              `${raw.label}`,
              `${lang === 'zh' ? '平均评分' : 'Average Rating'}: ${point.x.toFixed(2)}`,
              `${lang === 'zh' ? '争议度' : 'Controversy'}: ${point.y.toFixed(2)}`,
              `${lang === 'zh' ? '评审数' : 'Review Count'}: ${raw.reviewCount}`
            ];
          }
        }
      }
    }
  };

  return (
    <div style={{ height: '400px', position: 'relative' }}>
      <Scatter data={chartData} options={options} />
    </div>
  );
}