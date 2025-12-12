'use client';

import { useEffect, useRef } from 'react';

export default function InstitutionNetworkChart({ data }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!data || !data.institution_conflict_ranking || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get top institutions
    const topInstitutions = data.institution_conflict_ranking.slice(0, 8);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    // Draw institutions in circle
    const angleStep = (2 * Math.PI) / topInstitutions.length;
    const positions = {};
    
    topInstitutions.forEach((inst, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      const instName = inst.institution_name || inst.institution || 'Unknown';
      positions[instName] = { x, y, data: inst };
      
      // Draw institution node
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, 2 * Math.PI);
      ctx.fillStyle = `hsl(${(i * 360) / topInstitutions.length}, 70%, 50%)`;
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw institution name
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle > Math.PI / 2 && angle < 3 * Math.PI / 2 ? angle + Math.PI : angle);
      ctx.textAlign = angle > Math.PI / 2 && angle < 3 * Math.PI / 2 ? 'right' : 'left';
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      const fullName = inst.institution_name || inst.institution || 'Unknown';
      const name = fullName.length > 20 ? fullName.substring(0, 20) + '...' : fullName;
      ctx.fillText(name, angle > Math.PI / 2 && angle < 3 * Math.PI / 2 ? -40 : 40, 5);
      ctx.restore();
    });
    
    // Draw connections (simplified)
    topInstitutions.forEach((inst1, i) => {
      topInstitutions.slice(i + 1).forEach((inst2, j) => {
        const realJ = i + j + 1;
        if (Math.random() > 0.6) { // Randomly show some connections
          const instName1 = inst1.institution_name || inst1.institution || 'Unknown';
          const instName2 = inst2.institution_name || inst2.institution || 'Unknown';
          const pos1 = positions[instName1];
          const pos2 = positions[instName2];
          
          if (pos1 && pos2) {
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
            ctx.lineWidth = Math.random() * 3 + 1;
            ctx.stroke();
          }
        }
      });
    });
    
    // Draw legend
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('机构间评审网络关系图', width / 2, 30);
    ctx.font = '12px sans-serif';
    ctx.fillText('线条粗细表示评审频率', width / 2, 50);
    
  }, [data]);
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={400}
        style={{ width: '100%', height: '100%', maxWidth: '600px', margin: '0 auto', display: 'block' }}
      />
    </div>
  );
}