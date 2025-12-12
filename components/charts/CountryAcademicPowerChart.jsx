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

export default function CountryAcademicPowerChart({ data }) {
  const topCountries = data?.slice(0, 6) || [];
  
  const chartData = {
    labels: [
      'Total Reviews',
      'Avg Rating Given', 
      'Research Quality',
      'International Collaboration',
      'Institution Diversity',
      'Academic Influence'
    ],
    datasets: topCountries.map((country, index) => ({
      label: country.country,
      data: [
        Math.min((country.total_reviews || 0) / 1000, 100), // Normalized
        (country.avg_rating_given || 0) * 20, // Scale 0-5 to 0-100
        (country.research_quality_score || country.avg_rating_given || 0) * 20,
        (country.international_collaboration || 50) / 100 * 100, // Assume 0-100 scale
        (country.institution_diversity || 20) / 50 * 100, // Assume 0-50 scale  
        (country.academic_influence || country.total_reviews / 100 || 10) // Relative influence
      ],
      backgroundColor: [
        'rgba(255, 99, 132, 0.2)',
        'rgba(54, 162, 235, 0.2)', 
        'rgba(255, 205, 86, 0.2)',
        'rgba(75, 192, 192, 0.2)',
        'rgba(153, 102, 255, 0.2)',
        'rgba(255, 159, 64, 0.2)'
      ][index],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 205, 86, 1)', 
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
      ][index],
      borderWidth: 2,
    }))
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
          display: false
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
        labels: {
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'Country Academic Power Comparison',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.r.toFixed(1)}%`;
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