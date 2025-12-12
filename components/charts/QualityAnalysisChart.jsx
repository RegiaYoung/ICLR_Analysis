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

export default function QualityAnalysisChart({ data }) {
  const paperData = data?.paper_quality_analysis?.slice(0, 200) || [];
  
  const chartData = {
    datasets: [
      {
        label: 'High Quality Papers',
        data: paperData.filter(paper => (paper.avg_rating || 0) >= 6).map(paper => ({
          x: paper.review_count || 0,
          y: paper.avg_rating || 0,
          label: `Paper ${paper.submission_number}`,
          confidence: paper.avg_confidence || 0
        })),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      },
      {
        label: 'Medium Quality Papers', 
        data: paperData.filter(paper => (paper.avg_rating || 0) >= 4 && (paper.avg_rating || 0) < 6).map(paper => ({
          x: paper.review_count || 0,
          y: paper.avg_rating || 0,
          label: `Paper ${paper.submission_number}`,
          confidence: paper.avg_confidence || 0
        })),
        backgroundColor: 'rgba(255, 205, 86, 0.6)',
        borderColor: 'rgba(255, 205, 86, 1)', 
        borderWidth: 1
      },
      {
        label: 'Low Quality Papers',
        data: paperData.filter(paper => (paper.avg_rating || 0) < 4).map(paper => ({
          x: paper.review_count || 0,
          y: paper.avg_rating || 0,
          label: `Paper ${paper.submission_number}`,
          confidence: paper.avg_confidence || 0
        })),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
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
          text: 'Number of Reviews'
        },
        min: 0,
        max: 10
      },
      y: {
        title: {
          display: true,
          text: 'Average Rating'
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
        text: 'Paper Quality Distribution (Reviews vs Rating)',
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
              `Reviews: ${point.x}`,
              `Rating: ${point.y.toFixed(2)}`,
              `Confidence: ${raw.confidence?.toFixed(2) || 'N/A'}`
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