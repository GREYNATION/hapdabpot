import { useEffect, useRef } from 'react';
import { KNOWLEDGE_NODES } from '../data/greynation';

export default function KnowledgeGraphPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let raf: number;

    const draw = () => {
      frame++;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,3,8,0.95)';
      ctx.fillRect(0, 0, W, H);

      // Draw connections
      KNOWLEDGE_NODES.forEach(node => {
        node.connections.forEach(connId => {
          const conn = KNOWLEDGE_NODES.find(n => n.id === connId);
          if (!conn) return;
          const x1 = (node.x / 100) * W, y1 = (node.y / 100) * H;
          const x2 = (conn.x / 100) * W, y2 = (conn.y / 100) * H;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(0,255,238,${0.08 + Math.sin(frame * 0.02) * 0.03})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();

          // Animated particle on edge
          const t = ((frame * 0.01) % 1);
          const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = node.color + '99';
          ctx.fill();
        });
      });

      // Draw nodes
      KNOWLEDGE_NODES.forEach(node => {
        const x = (node.x / 100) * W, y = (node.y / 100) * H;
        const pulse = Math.sin(frame * 0.05 + node.x * 0.1) * 2;

        // Glow
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 20 + pulse);
        grd.addColorStop(0, node.color + '33');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, 20 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Node
        ctx.beginPath();
        ctx.arc(x, y, 5 + pulse * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(200,240,255,0.7)';
        ctx.font = '8px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, x, y + 16);
      });

      raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="relative rounded-xl overflow-hidden border border-cyan-500/10 bg-black/60" style={{ height: 400 }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-3 left-3 text-[9px] font-mono text-cyan-500/60 uppercase tracking-wider">
        GREYNATION NEURAL TOPOLOGY
      </div>
    </div>
  );
}
