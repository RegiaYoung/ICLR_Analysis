'use client';

import { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function GlobalDistributionChart({ data, lang = 'en' }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const chartData = {
    labels: data?.slice(0, 8).map(item => item.country) || [],
    datasets: [
      {
        data: data?.slice(0, 8).map(item => parseFloat(item.reviewer_count)) || [],
        backgroundColor: [
          '#FF6384',
          '#36A2EB', 
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
        borderColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56', 
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isMobile ? 'bottom' : 'right',
        labels: {
          padding: isMobile ? 10 : 20,
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const country = context.label;
            const count = context.parsed;
            const percentage = data ? (count / data.reduce((sum, item) => sum + parseFloat(item.reviewer_count), 0) * 100).toFixed(1) : 0;
            const label = lang === 'zh' ? `${country}: ${count.toLocaleString()} 人 (${percentage}%)` : `${country}: ${count.toLocaleString()} (${percentage}%)`;
            return label;
          }
        }
      }
    }
  };

  return (
    <div style={{ height: isMobile ? '250px' : '300px', position: 'relative' }} className="chart-container">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}