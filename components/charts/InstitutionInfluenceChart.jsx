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

export default function InstitutionInfluenceChart({ data, lang = 'en' }) {
  const topInstitutions = data?.institution_influence?.slice(0, 15) || [];
  
  const chartData = {
    labels: topInstitutions.map(inst => {
      // Shorten long institution names
      const name = inst.institution_name || inst.name || 'Unknown';
      return name.length > 25 ? name.substring(0, 25) + '...' : name;
    }),
    datasets: [
      {
        label: lang === 'zh' ? '总成员数' : 'Total Members',
        data: topInstitutions.map(inst => inst.total_members || 0),
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: lang === 'zh' ? '活跃审稿人' : 'Active Reviewers',
        data: topInstitutions.map(inst => inst.as_reviewer || 0),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: lang === 'zh' ? '参与作者' : 'Research Participation',
        data: topInstitutions.map(inst => inst.as_author || 0),
        backgroundColor: 'rgba(255, 99, 132, 0.7)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
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
          minRotation: 45,
          font: {
            size: 10
          }
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: lang === 'zh' ? '人员数量' : 'Number of People'
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
        text: lang === 'zh' ? '顶级机构学术参与度排行' : 'Top Institutions by Academic Participation'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += context.parsed.y.toLocaleString();
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