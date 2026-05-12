import { useEffect, useRef } from 'react';

interface Props {
  isTalking: boolean;
  isThinking: boolean;
  b64Image: string;
}

export default function HapdaAvatar({ isTalking, isThinking, b64Image }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = 300; canvas.height = 300;
    let frame = 0;
    let raf: number;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, 300, 300);
      for (let i = 0; i < 20; i++) {
        const x = 150 + Math.cos(frame * 0.02 + i * 0.5) * (80 + i * 4);
        const y = 150 + Math.sin(frame * 0.02 + i * 0.5) * (80 + i * 4);
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,238,${0.08 + Math.sin(frame * 0.05 + i) * 0.04})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40" />
      <div className="absolute rounded-full animate-orbit-1" style={{ inset: -10, border: '1px solid rgba(0,255,238,0.15)' }} />
      <div className="absolute rounded-full animate-orbit-2" style={{ inset: -25, border: '1px solid rgba(26,143,255,0.12)' }} />
      <div className="absolute rounded-full animate-orbit-3" style={{ inset: -40, border: '1px solid rgba(167,139,250,0.08)' }} />
      <div className="absolute rounded-full animate-glow" style={{
        inset: -20,
        background: 'radial-gradient(circle, rgba(0,200,255,.18) 0%, rgba(0,100,255,.07) 40%, transparent 70%)'
      }} />
      <div
        className={`relative z-10 ${isTalking ? 'animate-talk' : 'animate-breathe'}`}
        style={{ width: 200, height: 200 }}
      >
        {b64Image ? (
          <img src={`data:image/png;base64,${b64Image}`} alt="HAPDA_BOT" className="w-full h-full object-contain"
            style={{ filter: `drop-shadow(0 0 ${isTalking ? 28 : 18}px rgba(0,${isTalking ? 220 : 180},255,${isTalking ? .9 : .5}))` }} />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(0,255,238,0.2), rgba(0,100,200,0.1))', border: '2px solid rgba(0,255,238,0.3)', boxShadow: '0 0 40px rgba(0,255,238,0.3)' }}>
            <span style={{ fontSize: 80 }}>🤖</span>
          </div>
        )}
      </div>
      {isThinking && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              style={{ animation: `pulse 0.8s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
        </div>
      )}
    </div>
  );
}
