'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function CountryAcademicComparisonChart({ data, lang = 'en' }) {
  const topCountries = data?.slice(0, 10) || [];
  
  const chartData = {
    labels: topCountries.map(country => country.country),
    datasets: [
      {
        label: lang === 'zh' ? '学术成员总数' : 'Total Academic Members',
        data: topCountries.map(country => parseInt(country.total_academic_members)),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        label: lang === 'zh' ? '机构数量' : 'Institution Count',
        data: topCountries.map(country => parseInt(country.institution_count)),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
      },
      {
        label: lang === 'zh' ? '学术实力指数' : 'Academic Power Score',
        data: topCountries.map(country => country.academic_power_score),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: lang === 'zh' ? '学术成员总数' : 'Total Academic Members'
        },
        ticks: {
          callback: function(value) {
            return value.toLocaleString();
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: lang === 'zh' ? '机构数量 / 学术实力指数' : 'Institutions / Academic Power'
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: function(value) {
            return value.toLocaleString();
          }
        }
      },
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: lang === 'zh' ? '国家学术实力综合对比' : 'Country Academic Power Comparison',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += context.parsed.y.toLocaleString();
            
            // Add additional info for each country
            const countryData = topCountries[context.dataIndex];
            if (context.datasetIndex === 0) {
              const authorLabel = lang === 'zh' ? '作者' : 'Authors';
              const reviewerLabel = lang === 'zh' ? '审稿' : 'Reviewers';
              label += ` (${authorLabel}: ${parseInt(countryData.total_authors).toLocaleString()}, ${reviewerLabel}: ${parseInt(countryData.total_reviewers).toLocaleString()})`;
            } else if (context.datasetIndex === 1) {
              const univLabel = lang === 'zh' ? '大学' : 'Universities';
              const compLabel = lang === 'zh' ? '公司' : 'Companies';
              label += ` (${univLabel}: ${parseInt(countryData.university_count).toLocaleString()}, ${compLabel}: ${parseInt(countryData.company_count).toLocaleString()})`;
            }
            
            return label;
          }
        }
      }
    },
  };

  return (
    <div style={{ height: '400px', position: 'relative' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}