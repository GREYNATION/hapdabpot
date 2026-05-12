import { Building, Phone, CheckCircle, DollarSign, Target, Play, FileText, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Deal {
  id: number;
  address: string;
  price: number;
  mao?: number;
  status: string;
  last_call_status?: string;
  created_at: string;
}

interface Stats {
  totalLeads: number;
  surplusDeals: number;
  callsMade: number;
  interestedLeads: number;
  estimatedProfit: number;
}

export default function WholesalePanel() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    surplusDeals: 0,
    callsMade: 0,
    interestedLeads: 0,
    estimatedProfit: 0
  });
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchDeals();
    const interval = setInterval(() => {
      fetchStats();
      fetchDeals();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const r = await fetch('/api/dashboard/stats');
      const d = await r.json();
      setStats(d);
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  const fetchDeals = async () => {
    try {
      const r = await fetch('/api/dashboard/deals');
      const d = await r.json();
      setDeals(d);
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch deals", e);
    }
  };

  const triggerCall = async (dealId: number) => {
    try {
      await fetch('/api/dashboard/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId })
      });
      alert("Call sequence initiated, sir.");
    } catch (e) {
      alert("Comms interference detected.");
    }
  };

  const sendContract = async (dealId: number) => {
    try {
      await fetch('/api/dashboard/send-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId })
      });
      alert("Contract dispatched via SMS.");
    } catch (e) {
      alert("Contract delivery failed.");
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4">
        <div>
          <div className="text-xs font-mono text-cyan-400 font-bold">WHOLESALE OS ENGINE</div>
          <div className="text-[9px] font-mono text-gray-500 mt-1">Autonomous property scanning & AI-driven outreach.</div>
        </div>
        <div className="flex gap-2">
           <button className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-mono px-3 py-1.5 rounded hover:bg-cyan-500/20 transition-all flex items-center gap-2">
             <Play className="w-3 h-3" /> SCAN LEADS
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'TOTAL LEADS', value: stats.totalLeads, icon: Target, color: 'text-blue-400' },
          { label: 'SURPLUS DEALS', value: stats.surplusDeals, icon: Building, color: 'text-purple-400' },
          { label: 'CALLS MADE', value: stats.callsMade, icon: Phone, color: 'text-cyan-400' },
          { label: 'EST. PROFIT', value: `$${(stats.estimatedProfit / 1000).toFixed(1)}k`, icon: DollarSign, color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="bg-black/40 border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">{s.label}</div>
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
            </div>
            <div className={`text-xl font-orbitron font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Deals List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
           <div className="text-[10px] font-mono text-cyan-400/70 font-bold uppercase tracking-wider">ACTIVE PROPERTY QUEUE</div>
           <div className="text-[8px] font-mono text-gray-600">{deals.length} properties detected</div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="text-cyan-500/50 animate-pulse font-mono text-xs">Accessing neural bridge...</div>
          </div>
        ) : (
          <div className="grid gap-3">
            {deals.map(deal => (
              <div key={deal.id} className="bg-black/40 border border-cyan-500/10 rounded-xl p-4 hover:border-cyan-500/30 transition-all group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Building className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-cyan-100 font-bold">{deal.address}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="text-[10px] font-mono text-gray-500">Value: <span className="text-emerald-400">${deal.price.toLocaleString()}</span></div>
                        {deal.mao && <div className="text-[10px] font-mono text-gray-500">MAO: <span className="text-yellow-400">${deal.mao.toLocaleString()}</span></div>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`text-[8px] font-mono px-2 py-1 rounded border ${
                      deal.status === 'interested' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      deal.status === 'not_interested' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {deal.status.toUpperCase()}
                    </div>
                    <div className="text-[8px] font-mono text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/10">
                      {deal.last_call_status || 'NOT CALLED'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => triggerCall(deal.id)}
                      className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                      title="Trigger AI Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => sendContract(deal.id)}
                      className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      title="Send Contract"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
