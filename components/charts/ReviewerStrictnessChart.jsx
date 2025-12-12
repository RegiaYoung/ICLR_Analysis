'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ReviewerStrictnessChart({ data, lang = 'en' }) {
  // Create distribution data for reviewer ratings
  const createDistribution = () => {
    if (!data || !data.top_quality_reviewers) return null;
    
    // Use top quality reviewers data
    const allReviewers = data.top_quality_reviewers || [];
    
    // Create rating buckets
    const buckets = Array.from({length: 10}, (_, i) => i + 1);
    const distribution = buckets.map(rating => {
      const count = allReviewers.filter(r => 
        Math.floor(r.avg_rating) === rating
      ).length;
      return count;
    });
    
    return { buckets, distribution };
  };
  
  const distData = createDistribution();
  if (!distData) return <div>No data available</div>;
  
  const chartData = {
    labels: distData.buckets.map(b => `${b}-${b+1}`),
    datasets: [
      {
        label: lang === 'zh' ? '审稿人数量分布' : 'Reviewer Count Distribution',
        data: distData.distribution,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
        fill: true,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: lang === 'zh' ? '平均评分区间' : 'Average Rating Range'
        }
      },
      y: {
        title: {
          display: true,
          text: lang === 'zh' ? '审稿人数量' : 'Reviewer Count'
        },
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: lang === 'zh' ? '审稿人评分倾向分布 - 识别严格与宽松审稿人' : 'Reviewer Rating Tendency Distribution - Identifying Strict and Lenient Reviewers',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const rating = context.dataIndex + 1;
            if (rating <= 3) return lang === 'zh' ? '🔴 非常严格' : '🔴 Very Strict';
            if (rating <= 5) return lang === 'zh' ? '🟡 较为严格' : '🟡 Somewhat Strict';
            if (rating <= 7) return lang === 'zh' ? '🟢 正常水平' : '🟢 Normal Level';
            return lang === 'zh' ? '💚 较为宽松' : '💚 Somewhat Lenient';
          }
        }
      }
    },
  };

  return (
    <div style={{ height: '300px', position: 'relative' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}