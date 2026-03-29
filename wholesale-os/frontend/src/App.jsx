import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  Clock,
  ExternalLink,
  Plus
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

function App() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [deals, setDeals] = useState([]);
  const [stats, setStats] = useState({ totalDeals: 0, contracts: 0, totalProfit: 0, avgArv: 0 });
  const [analytics, setAnalytics] = useState({ funnel: { lead: 0, offerSent: 0, contract: 0, closed: 0 }, totalRevenue: 0, winRate: 0, avgDaysToClose: 0, monthlyRevenue: [] });
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [dealsRes, statsRes, buyersRes, analyticsRes] = await Promise.all([
        axios.get(`${API_BASE}/deals`),
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/buyers`),
        axios.get(`${API_BASE}/analytics`)
      ]);
      setDeals(dealsRes.data);
      setStats(statsRes.data);
      setBuyers(buyersRes.data);
      setAnalytics(analyticsRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const renderTab = () => {
    switch(activeTab) {
      case 'pipeline': return <PipelineTab stats={stats} deals={deals} analytics={analytics} />;
      case 'leads': return <LeadsTab deals={deals} />;
      case 'offers': return <OffersTab />;
      case 'contracts': return <ContractsTab deals={deals.filter(d => d.status === 'contract')} />;
      case 'buyers': return <BuyersTab buyers={buyers} />;
      default: return <PipelineTab stats={stats} deals={deals} analytics={analytics} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-secondary border-r border-muted flex flex-col p-6 space-y-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-background shadow-lg neon-glow text-accent">
            <TrendingUp size={24} className="text-background" />
          </div>
          <span className="text-xl font-black tracking-tighter neon-text uppercase italic text-accent">WholesaleOS</span>
        </div>

        <nav className="flex-1 space-y-2">
          <TabButton icon={<LayoutDashboard size={20} />} label="Pipeline" active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} />
          <TabButton icon={<Briefcase size={20} />} label="Leads" active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
          <TabButton icon={<Calculator size={20} />} label="Offers" active={activeTab === 'offers'} onClick={() => setActiveTab('offers')} />
          <TabButton icon={<CheckCircle size={20} />} label="Contracts" active={activeTab === 'contracts'} onClick={() => setActiveTab('contracts')} />
          <TabButton icon={<Users size={20} />} label="Buyers" active={activeTab === 'buyers'} onClick={() => setActiveTab('buyers')} />
        </nav>

        <div className="mt-auto p-4 bg-muted rounded-xl border border-secondary">
          <div className="flex items-center space-x-2 text-xs text-stone-500 mb-2">
            <Clock size={12} />
            <span>Next sync in ~30s</span>
          </div>
          <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
             <div className="h-full bg-accent neon-glow transition-all duration-[30s]" style={{ width: '100%' }}></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-background p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black capitalize tracking-tight">{activeTab}</h1>
            <p className="text-stone-500 text-sm">Real-time Command Center • Local Intelligence</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-stone-500 text-xs uppercase tracking-widest font-bold">CONNECTED TO GRAVITY CLAW DB</span>
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse neon-glow"></div>
          </div>
        </header>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent neon-glow"></div>
          </div>
        ) : renderTab()}
      </main>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 border-none outline-none focus:outline-none ${
        active 
          ? 'bg-accent text-background scale-105 shadow-xl font-bold' 
          : 'bg-transparent text-stone-400 hover:bg-muted hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function PipelineTab({ stats, deals, analytics }) {
  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-4 gap-6">
        <StatCard icon={<Briefcase className="text-sky-400" />} label="Total Revenue" value={`$${analytics.totalRevenue.toLocaleString()}`} />
        <StatCard icon={<CheckCircle className="text-accent" />} label="Avg Days Close" value={analytics.avgDaysToClose} />
        <StatCard icon={<DollarSign className="text-yellow-400" />} label="Win Rate" value={`${analytics.winRate}%`} />
        <StatCard icon={<TrendingUp className="text-purple-400" />} label="Average ARV" value={`$${Math.round(stats.avgArv).toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Funnel */}
        <div className="col-span-1 bg-secondary rounded-[2rem] border border-muted p-8 shadow-sm">
          <h2 className="text-xs font-black mb-6 uppercase tracking-[0.2em] text-stone-500 italic">Core Conversion Funnel</h2>
          <div className="space-y-4">
            <FunnelStep label="Total Leads" count={analytics.funnel.lead + analytics.funnel.offerSent + analytics.funnel.contract + analytics.funnel.closed} active />
            <FunnelStep label="Offers Sent" count={analytics.funnel.offerSent + analytics.funnel.contract + analytics.funnel.closed} active={analytics.funnel.offerSent > 0} />
            <FunnelStep label="Under Contract" count={analytics.funnel.contract + analytics.funnel.closed} active={analytics.funnel.contract > 0} />
            <FunnelStep label="Closed Deals" count={analytics.funnel.closed} active={analytics.funnel.closed > 0} />
          </div>
        </div>

        {/* Chart (CSS) */}
        <div className="col-span-2 bg-secondary rounded-[2rem] border border-muted p-8 shadow-sm">
          <h2 className="text-xs font-black mb-6 uppercase tracking-[0.2em] text-stone-500 italic">Profit Performance (6M)</h2>
          <div className="h-48 flex items-end justify-between space-x-2 px-4">
            {analytics.monthlyRevenue.length === 0 ? (
               <div className="m-auto text-stone-700 italic text-[10px]">Insufficient closed data...</div>
            ) : analytics.monthlyRevenue.map((m, idx) => (
              <div key={idx} className="flex-1 group relative flex flex-col items-center">
                <div 
                  className="w-full bg-accent/20 border-t-2 border-accent neon-glow rounded-t hover:bg-accent/40 transition-all cursor-pointer" 
                  style={{ height: `${Math.max(10, (m.profit / Math.max(...analytics.monthlyRevenue.map(p => p.profit || 1))) * 100)}%` }}
                ></div>
                <span className="text-[8px] mt-2 text-stone-600 font-mono tracking-tighter">{m.month}</span>
                <div className="absolute bottom-full mb-2 bg-stone-900 text-accent font-mono text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-accent/20">
                  ${m.profit.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
          <TrendingUp size={22} className="text-accent" />
          Active Deal Flow <span className="text-stone-500 font-normal not-italic ml-2">(Current Opportunities)</span>
        </h2>
        
        <div className="grid grid-cols-2 gap-8">
          {deals.length === 0 ? (
            <div className="col-span-2 p-12 border-2 border-dashed border-muted rounded-3xl text-center text-stone-600 italic">
               Waiting for leads to sync from Telegram...
            </div>
          ) : deals.slice(0, 4).map((deal, idx) => (
            <div key={idx} className="bg-secondary rounded-[2.5rem] border border-muted p-8 shadow-2xl hover:border-accent transition-all duration-300 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 flex flex-col items-end gap-2">
                 <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                   deal.status === 'contract' 
                   ? 'bg-accent/10 border-accent text-accent neon-glow' 
                   : 'bg-stone-900 border-stone-800 text-stone-500'
                 }`}>
                   {deal.status}
                 </div>
                 {deal.suggestedBuyer && (
                    <div className="px-3 py-1 bg-sky-500/10 border border-sky-500/50 text-sky-400 rounded-lg text-[8px] font-black uppercase tracking-tighter flex items-center gap-1">
                       <Users size={10} />
                       MATCH: {deal.suggestedBuyer}
                    </div>
                 )}
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-black tracking-tighter mb-1 uppercase group-hover:neon-text transition-all leading-tight">{deal.address}</h3>
                <p className="text-[10px] text-stone-500 font-mono tracking-widest">{new Date(deal.created_at || Date.now()).toLocaleDateString()} • BOT ANALYZED</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-muted p-4 rounded-2xl border border-stone-800/50">
                  <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest block mb-1">After Repair Value</span>
                  <span className="text-lg font-bold text-stone-300 font-mono">${deal.arv.toLocaleString()}</span>
                </div>
                <div className="bg-muted p-4 rounded-2xl border border-stone-800/50">
                  <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest block mb-1">Repairs Est.</span>
                  <span className="text-lg font-bold text-red-500/80 font-mono">${deal.repair_estimate.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-accent/5 rounded-3xl border border-accent/20">
                <div>
                   <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] block mb-1">MAX ALLOWABLE OFFER</span>
                   <span className="text-2xl font-black text-accent neon-text italic tracking-tighter">${deal.max_offer.toLocaleString()}</span>
                </div>
                <div className="text-right">
                   <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">Potential Spread</span>
                   <span className="text-xl font-bold text-yellow-500">${deal.profit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FunnelStep({ label, count, active }) {
  return (
    <div className={`p-4 rounded-xl border flex justify-between items-center transition-all ${active ? 'bg-muted border-stone-800' : 'bg-transparent border-stone-900 opacity-40 grayscale'}`}>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      <span className={`font-mono text-sm ${active ? 'text-accent font-black' : 'text-stone-700'}`}>{count}</span>
    </div>
  );
}

function LeadsTab({ deals }) {
  return (
    <div className="bg-secondary rounded-2xl border border-muted overflow-hidden shadow-sm animate-in zoom-in-95 duration-300">
      <table className="w-full text-left">
        <thead className="bg-muted border-b border-secondary">
          <tr className="text-[10px] font-black uppercase text-stone-500 tracking-[0.2em]">
            <th className="px-6 py-4">Property Address</th>
            <th className="px-6 py-4 text-center">ARV</th>
            <th className="px-6 py-4 text-center">MAO</th>
            <th className="px-6 py-4 text-center">Status</th>
            <th className="px-6 py-4 text-right">Potential Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {deals.map((deal, idx) => (
            <tr key={idx} className="hover:bg-muted/50 transition-colors group">
              <td className="px-6 py-4 border-l-4 border-transparent group-hover:border-accent">
                <div className="font-bold text-sm tracking-tight">{deal.address}</div>
                <div className="text-[10px] text-stone-500 font-mono italic">{new Date(deal.created_at).toLocaleDateString()}</div>
              </td>
              <td className="px-6 py-4 text-center font-mono text-stone-400 text-sm">${deal.arv.toLocaleString()}</td>
              <td className="px-6 py-4 text-center font-black text-accent text-sm neon-text italic italic">${deal.max_offer.toLocaleString()}</td>
              <td className="px-6 py-4 text-center">
                <span className="px-3 py-1 bg-stone-900 border border-stone-800 text-stone-500 rounded-full text-[9px] font-black uppercase tracking-tighter">
                  {deal.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right font-black text-yellow-500 text-sm">
                ${deal.profit.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OffersTab() {
  const [calc, setCalc] = useState({ arv: 0, repairs: 0, percentage: 70 });
  const mao = (calc.arv * (calc.percentage / 100)) - calc.repairs;

  return (
    <div className="grid grid-cols-2 gap-10 animate-in slide-in-from-bottom duration-500">
      <div className="bg-secondary p-8 rounded-3xl border border-muted shadow-2xl">
        <h2 className="text-xl font-black mb-8 border-b border-muted pb-4 flex items-center gap-3 italic uppercase tracking-tighter text-accent">
          <Calculator />
          MAO Calculator (70% Rule)
        </h2>
        
        <div className="space-y-6">
          <InputGroup label="Property ARV" icon={<DollarSign size={14} />} value={calc.arv} onChange={(v) => setCalc({ ...calc, arv: v })} />
          <InputGroup label="Renovation Estimate" icon={<Plus size={14} />} value={calc.repairs} onChange={(v) => setCalc({ ...calc, repairs: v })} />
          
          <div>
            <label className="block text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] mb-3">Formula Variable (%)</label>
            <div className="flex space-x-2">
              {[65, 70, 75, 80].map(p => (
                <button 
                  key={p} 
                  onClick={() => setCalc({ ...calc, percentage: p })}
                  className={`flex-1 text-[10px] font-black py-2 rounded-lg border transition-all uppercase tracking-widest ${calc.percentage === p ? 'bg-accent text-background border-accent neon-glow' : 'bg-muted border-stone-800 text-stone-500 hover:text-white'}`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-accent/5.0 rounded-[2.5rem] border-4 border-accent/20 border-dashed p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-inner">
        <span className="text-stone-500 uppercase tracking-[0.4em] text-[10px] font-black">Wholesale Offer Bound</span>
        <div className="text-7xl font-black neon-text text-accent tracking-tighter">
          ${Math.round(mao).toLocaleString()}
        </div>
        <div className="bg-stone-900/80 p-6 rounded-2xl border border-accent/10 w-full shadow-lg">
           <p className="text-stone-400 text-xs mb-4 uppercase tracking-widest font-bold">Standard Formula Breakdown</p>
           <div className="flex justify-around items-center text-xs font-mono text-stone-600">
              <div className="bg-muted px-3 py-1 rounded-lg border border-stone-800">({calc.percentage}% × ${calc.arv.toLocaleString()})</div>
              <div className="text-accent font-black">-</div>
              <div className="bg-muted px-3 py-1 rounded-lg border border-stone-800">${calc.repairs.toLocaleString()}</div>
           </div>
        </div>
        <button className="w-full mt-4 neon-glow font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform">Create Purchase Contract</button>
      </div>
    </div>
  );
}

function ContractsTab({ deals }) {
  if (deals.length === 0) return (
    <div className="h-96 border-4 border-dashed border-stone-900 rounded-[3rem] flex flex-col items-center justify-center text-stone-700 italic space-y-4 animate-in fade-in duration-1000">
       <CheckCircle size={64} className="opacity-10" />
       <p className="font-black uppercase tracking-widest text-xs">No active assets in flight</p>
    </div>
  );
  return <LeadsTab deals={deals} />;
}

function BuyersTab({ buyers }) {
  return (
    <div className="grid grid-cols-3 gap-6 animate-in slide-in-from-right duration-500">
      {buyers.map((buyer, idx) => (
        <div key={idx} className="bg-secondary p-8 rounded-[2rem] border border-muted hover:border-accent group transition-all duration-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4">
             <span className="text-[10px] font-black bg-accent/10 text-accent px-2 py-1 rounded border border-accent/20">VIP CASH</span>
           </div>
           <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-stone-500 group-hover:bg-accent group-hover:text-background transition-colors duration-300">
                <Users size={24} />
              </div>
           </div>
           <h3 className="text-xl font-black tracking-tighter mb-1 uppercase group-hover:neon-text transition-all">{buyer.name}</h3>
           <p className="text-xs text-stone-600 mb-6 font-mono">{buyer.phone || 'NO_CONTACT_DATA'}</p>
           <div className="p-4 bg-muted/50 rounded-2xl text-[10px] text-stone-400 border border-stone-800/50 leading-relaxed italic">
             <span className="text-accent uppercase font-black not-italic mr-1 tracking-tighter">CRITERIA//</span> {buyer.criteria || 'Standard wholesale criteria (Distressed assets 70% rule).'}
           </div>
        </div>
      ))}
      <button className="h-full border-4 border-dashed border-stone-900 rounded-[2rem] flex flex-col items-center justify-center text-stone-700 hover:border-accent hover:text-accent transition-all min-h-[220px] group">
        <div className="p-3 rounded-full bg-stone-900 mb-2 group-hover:bg-accent group-hover:text-background transition-all">
          <Plus size={24} />
        </div>
        <span className="font-black uppercase tracking-widest text-[10px]">Onboard New Buyer</span>
      </button>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-secondary p-8 rounded-[2rem] border border-muted hover:border-accent transition-all duration-500 group relative overflow-hidden shadow-lg">
      <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
        {React.cloneElement(icon, { size: 100 })}
      </div>
      <div className="flex items-center space-x-3 mb-6 relative z-10">
        {React.cloneElement(icon, { size: 18 })}
        <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-3xl font-black tracking-tighter relative z-10 group-hover:neon-text transition-all">{value}</div>
    </div>
  );
}

function InputGroup({ label, icon, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] mb-4">{label}</label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-accent transition-colors">
          {icon}
        </div>
        <input 
          type="text" 
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted border-2 border-stone-800 focus:border-accent font-mono text-lg transition-all shadow-inner" 
          placeholder="0.00" 
          value={value === 0 ? '' : value}
          onChange={(e) => {
            const val = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
            onChange(isNaN(val) ? 0 : val);
          }}
        />
      </div>
    </div>
  );
}

export default App;
