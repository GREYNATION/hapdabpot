import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
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
  Plus,
  Download,
  FileText,
  Terminal,
  Cpu,
  Zap,
  Activity
} from 'lucide-react';
import ZipHeatmap from './ZipHeatmap';
import AgenticConsole from './components/AgenticConsole';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

function App() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [deals, setDeals] = useState([]);
  const [stats, setStats] = useState({ totalDeals: 0, contracts: 0, totalProfit: 0, avgArv: 0 });
  const [analytics, setAnalytics] = useState({ funnel: { lead: 0, offerSent: 0, contract: 0, closed: 0 }, totalRevenue: 0, winRate: 0, avgDaysToClose: 0, monthlyRevenue: [] });
  const [heatmapData, setHeatmapData] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [dealsRes, statsRes, buyersRes, analyticsRes, heatmapRes] = await Promise.all([
        axios.get(`${API_BASE}/deals`),
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/buyers`),
        axios.get(`${API_BASE}/analytics`),
        axios.get(`${API_BASE}/analytics/zip-heatmap`)
      ]);
      setDeals(dealsRes.data);
      setStats(statsRes.data);
      setBuyers(buyersRes.data);
      setAnalytics(analyticsRes.data);
      setHeatmapData(heatmapRes.data);
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
      case 'pipeline': return <PipelineTab stats={stats} deals={deals} analytics={analytics} heatmapData={heatmapData} />;
      case 'leads': return <LeadsTab deals={deals} />;
      case 'offers': return <OffersTab />;
      case 'contracts': return <ContractsTab deals={deals.filter(d => d.status === 'contract')} />;
      case 'buyers': return <BuyersTab buyers={buyers} />;
      case 'console': return <AgenticConsole />;
      default: return <PipelineTab stats={stats} deals={deals} analytics={analytics} heatmapData={heatmapData} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-secondary/80 backdrop-blur-2xl border-r border-muted flex flex-col p-8 space-y-10 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-accent/10 rounded-full blur-[100px]"></div>
        
        <div className="flex items-center space-x-4 mb-4 relative z-10">
          <motion.div 
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.5 }}
            className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-background shadow-[0_0_20px_rgba(57,255,20,0.3)] neon-glow"
          >
            <TrendingUp size={28} />
          </motion.div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter neon-text uppercase italic text-accent leading-none">WholesaleOS</span>
            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-black mt-1">Spirit Brain v3.0</span>
          </div>
        </div>

        <nav className="flex-1 space-y-3 relative z-10">
          <TabButton icon={<LayoutDashboard size={20} />} label="Pipeline" active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} />
          <TabButton icon={<Terminal size={20} />} label="Agentic Console" active={activeTab === 'console'} onClick={() => setActiveTab('console')} />
          <TabButton icon={<Briefcase size={20} />} label="Leads" active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
          <TabButton icon={<Calculator size={20} />} label="Offers" active={activeTab === 'offers'} onClick={() => setActiveTab('offers')} />
          <TabButton icon={<CheckCircle size={20} />} label="Contracts" active={activeTab === 'contracts'} onClick={() => setActiveTab('contracts')} />
          <TabButton icon={<Users size={20} />} label="Buyers" active={activeTab === 'buyers'} onClick={() => setActiveTab('buyers')} />
        </nav>

        <div className="mt-auto p-6 bg-muted/50 rounded-3xl border border-secondary backdrop-blur-sm relative z-10">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center space-x-2 text-[10px] text-stone-500 font-black uppercase tracking-widest">
                <Activity size={12} className="text-accent animate-pulse" />
                <span>Neural Bridge</span>
             </div>
             <span className="text-[10px] font-mono text-accent">99% SYNC</span>
          </div>
          <div className="h-1.5 bg-stone-900 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: '99%' }}
               transition={{ duration: 1.5, ease: "easeOut" }}
               className="h-full bg-accent neon-glow shadow-[0_0_10px_#39FF14]"
             />
          </div>
          <div className="mt-4 flex items-center justify-between">
             <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-[9px] text-stone-400 font-bold uppercase">Production Active</span>
             </div>
             <Clock size={12} className="text-stone-600" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-[#050505] p-10 overflow-y-auto relative custom-scrollbar">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none"></div>

        <header className="flex justify-between items-center mb-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-black capitalize tracking-tighter italic">
              {activeTab === 'console' ? 'Spirit Console' : activeTab}
            </h1>
            <p className="text-stone-500 text-sm mt-1">Real-time Command Center • Local Intelligence</p>
          </motion.div>
          <div className="flex items-center space-x-6">
            <div className="flex flex-col items-end">
                <span className="text-stone-500 text-[9px] uppercase tracking-widest font-black">Connected Instance</span>
                <span className="text-xs font-mono text-stone-300 tracking-tighter">GRAVITY_CLAW_CORE_01</span>
            </div>
            <div className="w-12 h-12 bg-secondary border border-muted rounded-2xl flex items-center justify-center text-accent shadow-xl">
                <Activity size={20} />
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-96 flex flex-col items-center justify-center space-y-6"
            >
              <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin neon-glow"></div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-accent animate-pulse">Syncing Spirit Brain...</p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "circOut" }}
            >
              {renderTab()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <motion.button 
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all duration-300 border-none outline-none focus:outline-none relative group ${
        active 
          ? 'bg-accent text-background shadow-[0_10px_20px_rgba(57,255,20,0.2)]' 
          : 'bg-transparent text-stone-500 hover:bg-muted hover:text-stone-200'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className={`font-black uppercase tracking-widest text-[11px] ${active ? '' : 'italic'}`}>{label}</span>
      {active && (
        <motion.div 
          layoutId="tab-active"
          className="absolute right-4 w-1.5 h-1.5 bg-background rounded-full"
        />
      )}
    </motion.button>
  );
}

function PipelineTab({ stats, deals, analytics, heatmapData }) {
  return (
    <div className="space-y-12 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Activity className="text-sky-400" />} label="Total Revenue" value={`$${analytics.totalRevenue.toLocaleString()}`} delta="+12.5%" />
        <StatCard icon={<CheckCircle className="text-accent" />} label="Avg Days Close" value={analytics.avgDaysToClose} delta="-2d" />
        <StatCard icon={<DollarSign className="text-yellow-400" />} label="Win Rate" value={`${analytics.winRate}%`} delta="+5%" />
        <StatCard icon={<TrendingUp className="text-purple-400" />} label="Average ARV" value={`$${Math.round(stats.avgArv).toLocaleString()}`} delta="Market Avg" />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Funnel */}
        <div className="col-span-12 lg:col-span-4 bg-secondary/50 backdrop-blur-xl rounded-[2.5rem] border border-muted p-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-accent/5 rounded-full blur-[60px] group-hover:bg-accent/10 transition-colors duration-500"></div>
          <h2 className="text-xs font-black mb-8 uppercase tracking-[0.3em] text-stone-500 italic flex items-center gap-3">
            <Layers size={14} className="text-accent" /> Core Conversion Funnel
          </h2>
          <div className="space-y-4">
            <FunnelStep label="Total Leads" count={analytics.funnel.lead + analytics.funnel.offerSent + analytics.funnel.contract + analytics.funnel.closed} active percent={100} />
            <FunnelStep label="Offers Sent" count={analytics.funnel.offerSent + analytics.funnel.contract + analytics.funnel.closed} active={analytics.funnel.offerSent > 0} percent={75} />
            <FunnelStep label="Under Contract" count={analytics.funnel.contract + analytics.funnel.closed} active={analytics.funnel.contract > 0} percent={45} />
            <FunnelStep label="Closed Deals" count={analytics.funnel.closed} active={analytics.funnel.closed > 0} percent={20} />
          </div>
        </div>

        {/* Heatmap (ZIP) */}
        <div className="col-span-12 lg:col-span-8 bg-secondary/50 backdrop-blur-xl rounded-[2.5rem] border border-muted p-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-blue-500/5 rounded-full blur-[60px] group-hover:bg-blue-500/10 transition-colors duration-500"></div>
          <h2 className="text-xs font-black mb-8 uppercase tracking-[0.3em] text-stone-500 italic flex items-center gap-3">
            <Activity size={14} className="text-sky-400" /> Market Intelligence Matrix
          </h2>
          <div className="space-y-8">
            <div className="h-[250px] w-full bg-background/50 rounded-3xl border border-stone-800/50 flex items-center justify-center relative overflow-hidden">
                <ZipHeatmap data={heatmapData} />
                <div className="absolute top-4 right-4 bg-accent/10 backdrop-blur-md border border-accent/20 px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-accent uppercase tracking-tighter">Live Geo-Layer</span>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {heatmapData.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-stone-700 italic text-[10px] uppercase tracking-widest">Awaiting geographic market data...</div>
              ) : heatmapData.map((h, idx) => (
                <motion.div 
                  key={idx} 
                  whileHover={{ y: -5, borderColor: '#39FF14' }}
                  className="bg-muted/30 p-6 rounded-3xl border border-stone-800/50 flex justify-between items-center transition-all group/zip"
                >
                  <div>
                    <span className="text-[10px] font-black text-stone-600 uppercase block mb-1">ZIP {h.zip}</span>
                    <span className="text-2xl font-black text-stone-200 font-mono tracking-tighter group-hover/zip:text-accent transition-colors">{h.count}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-accent/50 uppercase block mb-1">Avg Profit</span>
                    <span className="text-lg font-bold text-accent neon-text">${Math.round(h.avgProfit || 0).toLocaleString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-10">
            <h2 className="text-3xl font-black flex items-center gap-4 uppercase tracking-tighter italic">
                <Activity size={32} className="text-accent" />
                Active Deal Flow
            </h2>
            <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest bg-muted px-4 py-2 rounded-full border border-stone-800">
                Sorted by Acquisition Score
            </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {deals.length === 0 ? (
            <div className="col-span-2 p-24 border-2 border-dashed border-muted rounded-[3rem] flex flex-col items-center justify-center text-stone-700 italic space-y-4">
               <Cpu size={48} className="opacity-10 animate-pulse" />
               <p className="uppercase tracking-[0.3em] font-black text-[10px]">Awaiting signals from the Spirit Network...</p>
            </div>
          ) : deals.slice(0, 4).map((deal, idx) => (
            <DealCard key={idx} deal={deal} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, delta }) {
  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      className="bg-secondary/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-muted hover:border-accent transition-all duration-500 group relative overflow-hidden shadow-2xl"
    >
      <div className="absolute -right-6 -top-6 opacity-5 group-hover:opacity-10 group-hover:scale-125 transition-all duration-700 text-accent">
        {React.cloneElement(icon, { size: 140 })}
      </div>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-accent group-hover:text-background transition-colors duration-500 shadow-inner">
            {React.cloneElement(icon, { size: 22 })}
        </div>
        {delta && (
          <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
            delta.startsWith('+') ? 'bg-accent/10 border-accent/30 text-accent' : 
            delta.startsWith('-') ? 'bg-red-500/10 border-red-500/30 text-red-500' : 
            'bg-muted border-stone-800 text-stone-500'
          }`}>
            {delta}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] block mb-2">{label}</span>
        <div className="text-4xl font-black tracking-tighter group-hover:text-foreground transition-all duration-500">{value}</div>
      </div>
    </motion.div>
  );
}

function FunnelStep({ label, count, active, percent }) {
  return (
    <div className={`p-6 rounded-[2rem] border transition-all duration-500 relative overflow-hidden ${active ? 'bg-muted/30 border-stone-800' : 'bg-transparent border-stone-900/50 opacity-30 grayscale'}`}>
      {active && (
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="absolute bottom-0 left-0 h-[2px] bg-accent/20"
        />
      )}
      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-accent shadow-[0_0_10px_#39FF14]' : 'bg-stone-800'}`}></div>
            <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">{label}</span>
        </div>
        <span className={`font-mono text-xl ${active ? 'text-accent font-black italic' : 'text-stone-700'}`}>{count}</span>
      </div>
    </div>
  );
}

function DealCard({ deal, index }) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -10 }}
            className="bg-secondary/60 backdrop-blur-2xl rounded-[3rem] border border-muted p-10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] hover:border-accent transition-all duration-500 group overflow-hidden relative"
        >
          {/* Status Badge */}
          <div className="absolute top-0 right-0 p-8 flex flex-col items-end gap-3">
             <div className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${
               deal.status === 'contract' 
               ? 'bg-accent/10 border-accent/50 text-accent neon-glow shadow-[0_0_15px_rgba(57,255,20,0.2)]' 
               : 'bg-stone-900/80 border-stone-800 text-stone-500 shadow-inner'
             }`}>
               {deal.status}
             </div>
             {deal.acquisition_score > 0 && (
                <div className="px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/40 text-yellow-500 rounded-xl text-[9px] font-black uppercase tracking-tighter flex items-center gap-2">
                   <Activity size={10} /> SCORE: {deal.acquisition_score}
                </div>
             )}
          </div>

          <div className="mb-10">
            <h3 className="text-3xl font-black tracking-tighter mb-2 uppercase group-hover:text-accent transition-all leading-none">{deal.address}</h3>
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-stone-500 font-mono tracking-widest bg-muted/50 px-3 py-1 rounded-lg border border-stone-800/50">
                    {new Date(deal.created_at || Date.now()).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-stone-500 font-mono tracking-widest uppercase">
                    {deal.zip_code || 'GEO_UNKNOWN'}
                </span>
            </div>
          </div>

          {deal.summary_why_it_matters && (
            <div className="mb-10 p-6 bg-background/40 rounded-[2rem] border border-muted/50 text-[12px] leading-relaxed text-stone-400 italic shadow-inner relative group/why">
               <span className="absolute -top-3 left-6 px-3 py-1 bg-accent text-background text-[9px] font-black not-italic uppercase tracking-widest rounded-lg">Spirit Insight</span>
               <p className="pt-2">{deal.summary_why_it_matters}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="bg-muted/30 p-6 rounded-3xl border border-stone-800/50 group-hover:bg-muted/50 transition-all">
              <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest block mb-2">After Repair Value</span>
              <span className="text-2xl font-black text-stone-200 font-mono tracking-tighter">${deal.arv.toLocaleString()}</span>
            </div>
            <div className="bg-muted/30 p-6 rounded-3xl border border-stone-800/50 group-hover:bg-muted/50 transition-all">
              <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest block mb-2">Repairs Est.</span>
              <span className="text-2xl font-black text-red-500/80 font-mono tracking-tighter">${deal.repair_estimate.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-8 bg-accent/5 rounded-[2.5rem] border border-accent/20 group-hover:bg-accent/10 transition-all">
            <div>
               <span className="text-[10px] font-black text-accent/70 uppercase tracking-[0.3em] block mb-2">MAX ALLOWABLE OFFER</span>
               <span className="text-4xl font-black text-accent neon-text italic tracking-tighter shadow-accent/20 shadow-sm">${deal.max_offer.toLocaleString()}</span>
            </div>
            <div className="text-right">
               <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-2">Potential Spread</span>
               <span className="text-2xl font-bold text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.2)]">${deal.profit.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>
    );
}

function LeadsTab({ deals }) {
  const [selectedDeal, setSelectedDeal] = useState(null);

  const handleGenerateOfferPack = (dealId) => {
    window.open(`${API_BASE}/deals/${dealId}/generate-offer-pack`, '_blank');
  };

  const handleDownloadPDF = (dealId) => {
    window.open(`${API_BASE}/deals/${dealId}/generate-offer-pack-pdf`, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="bg-secondary/40 backdrop-blur-xl rounded-[2.5rem] border border-muted overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        <table className="w-full text-left">
          <thead className="bg-muted/50 border-b border-secondary">
            <tr className="text-[10px] font-black uppercase text-stone-500 tracking-[0.3em]">
              <th className="px-10 py-6">Property Address</th>
              <th className="px-10 py-6 text-center">Score</th>
              <th className="px-10 py-6 text-center">MAO</th>
              <th className="px-10 py-6 text-center">Status</th>
              <th className="px-10 py-6 text-right">Potential Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted/30">
            {deals.map((deal, idx) => (
              <tr 
                key={idx} 
                className="hover:bg-accent/[0.03] transition-all group cursor-pointer"
                onClick={() => setSelectedDeal(deal)}
              >
                <td className="px-10 py-8 border-l-4 border-transparent group-hover:border-accent">
                  <div className="font-bold text-lg tracking-tighter group-hover:text-foreground transition-colors">{deal.address}</div>
                  <div className="text-[10px] text-stone-600 font-mono italic mt-1">{deal.zip_code || 'ZIP_MISSING'} â€¢ {new Date(deal.created_at).toLocaleDateString()}</div>
                </td>
                <td className="px-10 py-8 text-center">
                   {deal.acquisition_score > 0 ? (
                     <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-tighter ${deal.acquisition_score > 80 ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                        {deal.acquisition_score}
                     </span>
                   ) : <span className="text-stone-700 font-mono">--</span>}
                </td>
                <td className="px-10 py-8 text-center font-black text-accent text-xl neon-text italic tracking-tighter">${deal.max_offer.toLocaleString()}</td>
                <td className="px-10 py-8 text-center">
                  <span className="px-4 py-1.5 bg-stone-900 border border-stone-800 text-stone-500 rounded-full text-[10px] font-black uppercase tracking-widest shadow-inner">
                    {deal.status}
                  </span>
                </td>
                <td className="px-10 py-8 text-right font-black text-yellow-500 text-lg tracking-tighter">
                  ${deal.profit.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedDeal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 50 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-10 bg-background/80 backdrop-blur-md"
          >
            <div className="bg-secondary rounded-[3rem] border-2 border-accent/30 p-12 max-w-6xl w-full max-h-[90vh] overflow-y-auto relative shadow-[0_50px_100px_rgba(0,0,0,0.8)] custom-scrollbar">
                <button 
                onClick={() => setSelectedDeal(null)}
                className="absolute top-8 right-8 text-stone-600 hover:text-white transition-colors"
                >
                <Plus size={32} className="rotate-45" />
                </button>
                
                <div className="flex items-center gap-6 mb-12">
                    <div className="w-20 h-20 bg-accent rounded-[2rem] flex items-center justify-center text-background shadow-accent/20 shadow-2xl">
                        <TrendingUp size={40} />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black tracking-tighter uppercase text-accent neon-text leading-none mb-2">{selectedDeal.address}</h2>
                        <div className="flex gap-4">
                            <span className="text-stone-500 uppercase font-black text-[10px] tracking-widest">Property ID: {selectedDeal.id}</span>
                            <span className="text-stone-500 font-black text-[10px]">â€¢</span>
                            <span className="text-stone-500 uppercase font-black text-[10px] tracking-widest">Neural Score: {selectedDeal.acquisition_score}</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-12 gap-12">
                    <div className="col-span-12 lg:col-span-8 space-y-12">
                        <SummarySection label="Strategic Importance" content={selectedDeal.summary_why_it_matters} icon={<Activity size={16} />} />
                        <SummarySection label="Opportunity Analysis" content={selectedDeal.summary_opportunity} icon={<Zap size={16} />} />
                        <SummarySection label="Market Signals" content={selectedDeal.summary_market_signals} icon={<LineChart size={16} />} />
                        <SummarySection label="Execution Strategy" content={selectedDeal.summary_strategy} icon={<Terminal size={16} />} />
                    </div>
                    <div className="col-span-12 lg:col-span-4 space-y-8">
                        <div className="bg-muted/30 p-8 rounded-[2rem] border border-stone-800 shadow-inner">
                            <span className="text-[10px] font-black text-stone-600 uppercase tracking-[0.3em] block mb-6">Market Risk Level</span>
                            <div className={`text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 ${
                            selectedDeal.summary_risk_level?.toLowerCase().includes('low') ? 'text-accent' : 
                            selectedDeal.summary_risk_level?.toLowerCase().includes('high') ? 'text-red-500' : 'text-yellow-500'
                            }`}>
                            {selectedDeal.summary_risk_level?.toLowerCase().includes('low') ? <CheckCircle size={28} /> : 
                             selectedDeal.summary_risk_level?.toLowerCase().includes('high') ? <AlertCircle size={28} /> : <Clock size={28} />}
                            {selectedDeal.summary_risk_level || 'NOT_RATED'}
                            </div>
                        </div>
                        <div className="bg-accent/5 p-8 rounded-[2rem] border border-accent/20">
                            <span className="text-[10px] font-black text-accent/50 uppercase tracking-[0.3em] block mb-6">Neural Confidence</span>
                            <div className="text-7xl font-black text-accent neon-text italic tracking-tighter leading-none">{selectedDeal.acquisition_score || '??'}</div>
                        </div>
                        <div className="flex flex-col gap-4 pt-6">
                            <motion.button 
                            whileHover={{ scale: 1.02, backgroundColor: '#262626' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleGenerateOfferPack(selectedDeal.id)}
                            className="w-full py-5 bg-muted/50 text-stone-300 border border-stone-800 font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 group"
                            >
                            <Download size={20} className="group-hover:text-accent transition-colors" />
                            Offer Pack (MD)
                            </motion.button>
                            <motion.button 
                            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(57,255,20,0.3)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleDownloadPDF(selectedDeal.id)}
                            className="w-full py-5 bg-accent text-background font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 neon-glow shadow-xl"
                            >
                            <FileText size={20} />
                            Download PDF Pack
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummarySection({ label, content, icon }) {
  return (
    <div className="group">
      <h3 className="text-[11px] font-black text-stone-600 uppercase tracking-[0.4em] mb-4 flex items-center gap-3 group-hover:text-accent transition-colors">
        {icon} {label}
      </h3>
      <div className="p-8 bg-muted/20 rounded-[2rem] border border-stone-900/50 group-hover:border-stone-800 transition-all">
        <p className="text-base text-stone-400 leading-relaxed font-medium">
            {content || <span className="italic text-stone-700 animate-pulse">Initializing neural synthesis...</span>}
        </p>
      </div>
    </div>
  );
}

function OffersTab() {
  const [calc, setCalc] = useState({ arv: 0, repairs: 0, percentage: 70 });
  const mao = (calc.arv * (calc.percentage / 100)) - calc.repairs;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in slide-in-from-bottom duration-500">
      <div className="bg-secondary/40 backdrop-blur-xl p-10 rounded-[3rem] border border-muted shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-40 h-40 bg-accent/5 rounded-full blur-[60px] group-hover:bg-accent/10 transition-colors duration-500"></div>
        <h2 className="text-2xl font-black mb-10 border-b border-muted/50 pb-6 flex items-center gap-4 italic uppercase tracking-tighter text-accent">
          <Calculator size={28} />
          MAO Calculator <span className="text-stone-500 font-normal not-italic text-sm ml-2">Proprietary Formula</span>
        </h2>
        
        <div className="space-y-10">
          <InputGroup label="Property After Repair Value" icon={<DollarSign size={20} />} value={calc.arv} onChange={(v) => setCalc({ ...calc, arv: v })} />
          <InputGroup label="Renovation & Holding Costs" icon={<Plus size={20} />} value={calc.repairs} onChange={(v) => setCalc({ ...calc, repairs: v })} />
          
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-[0.4em] mb-5">Risk Tolerance Matrix (%)</label>
            <div className="grid grid-cols-4 gap-4">
              {[65, 70, 75, 80].map(p => (
                <motion.button 
                  key={p} 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCalc({ ...calc, percentage: p })}
                  className={`py-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest text-[12px] ${calc.percentage === p ? 'bg-accent text-background border-accent shadow-[0_0_20px_rgba(57,255,20,0.3)]' : 'bg-muted/30 border-stone-800 text-stone-600 hover:text-stone-300'}`}
                >
                  {p}%
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-accent/[0.03] rounded-[3rem] border-4 border-accent/20 border-dashed p-12 flex flex-col items-center justify-center text-center space-y-8 shadow-inner relative group/mao">
        <div className="absolute inset-0 bg-accent/[0.02] group-hover:bg-accent/[0.05] transition-colors duration-500 rounded-[3rem]"></div>
        <div className="flex flex-col items-center relative z-10">
            <span className="text-stone-600 uppercase tracking-[0.5em] text-[11px] font-black mb-4">Neural Acquisition Limit</span>
            <motion.div 
                key={mao}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-8xl font-black neon-text text-accent tracking-tighter shadow-accent/10 drop-shadow-2xl"
            >
                ${Math.round(mao).toLocaleString()}
            </motion.div>
        </div>
        <div className="bg-background/60 backdrop-blur-md p-10 rounded-[2.5rem] border border-accent/10 w-full shadow-2xl relative z-10">
           <p className="text-stone-500 text-[10px] mb-6 uppercase tracking-[0.3em] font-black">Strategic Breakdown</p>
           <div className="flex justify-center items-center gap-8 text-sm font-mono text-stone-400">
              <div className="bg-muted/50 px-6 py-3 rounded-2xl border border-stone-800 flex flex-col items-center">
                  <span className="text-[9px] uppercase text-stone-600 mb-1">Risk Adjusted</span>
                  <span>${Math.round(calc.arv * (calc.percentage / 100)).toLocaleString()}</span>
              </div>
              <div className="text-accent font-black text-2xl">-</div>
              <div className="bg-muted/50 px-6 py-3 rounded-2xl border border-stone-800 flex flex-col items-center">
                  <span className="text-[9px] uppercase text-stone-600 mb-1">Repairs</span>
                  <span className="text-red-500/80">${calc.repairs.toLocaleString()}</span>
              </div>
           </div>
        </div>
        <motion.button 
            whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(57,255,20,0.4)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-6 bg-accent text-background font-black uppercase tracking-[0.3em] rounded-[2rem] neon-glow shadow-2xl text-lg relative z-10"
        >
            Deploy Purchase Agreement
        </motion.button>
      </div>
    </div>
  );
}

function ContractsTab({ deals }) {
  if (deals.length === 0) return (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-96 border-4 border-dashed border-stone-900 rounded-[4rem] flex flex-col items-center justify-center text-stone-700 space-y-6"
    >
       <CheckCircle size={80} className="opacity-10" />
       <div className="text-center">
            <p className="font-black uppercase tracking-[0.4em] text-xs mb-2">Assets Optimized</p>
            <p className="text-[10px] uppercase tracking-widest text-stone-800 italic">No active assets in neural flight</p>
       </div>
    </motion.div>
  );
  return <LeadsTab deals={deals} />;
}

function BuyersTab({ buyers }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in slide-in-from-right duration-500">
      {buyers.map((buyer, idx) => (
        <motion.div 
            key={idx} 
            whileHover={{ y: -10 }}
            className="bg-secondary/50 backdrop-blur-xl p-10 rounded-[2.5rem] border border-muted hover:border-accent group transition-all duration-500 relative overflow-hidden shadow-2xl"
        >
           <div className="absolute top-0 right-0 p-6">
             <span className="text-[9px] font-black bg-accent/10 text-accent px-4 py-1.5 rounded-full border border-accent/30 tracking-widest uppercase">VIP CAPITAL</span>
           </div>
           <div className="flex items-center justify-between mb-8">
              <div className="w-16 h-16 bg-muted rounded-[1.5rem] flex items-center justify-center text-stone-500 group-hover:bg-accent group-hover:text-background transition-all duration-500 shadow-inner">
                <Users size={32} />
              </div>
           </div>
           <h3 className="text-2xl font-black tracking-tighter mb-2 uppercase group-hover:text-accent transition-all leading-none">{buyer.name}</h3>
           <p className="text-[11px] text-stone-600 mb-8 font-mono tracking-widest">{buyer.phone || 'NO_CONTACT_DATA'}</p>
           <div className="p-6 bg-background/50 rounded-3xl text-[11px] text-stone-400 border border-stone-800/50 leading-relaxed italic group-hover:border-accent/30 transition-all shadow-inner">
             <span className="text-accent uppercase font-black not-italic mr-2 tracking-[0.2em] text-[9px]">CRITERIA//</span> {buyer.criteria || 'Standard wholesale criteria (Distressed assets 70% rule).'}
           </div>
        </motion.div>
      ))}
      <motion.button 
        whileHover={{ scale: 1.02, borderColor: '#39FF14' }}
        whileTap={{ scale: 0.98 }}
        className="h-full border-4 border-dashed border-stone-900 rounded-[2.5rem] flex flex-col items-center justify-center text-stone-800 hover:text-accent transition-all min-h-[280px] group bg-background/20"
      >
        <div className="p-5 rounded-full bg-stone-900 mb-4 group-hover:bg-accent group-hover:text-background transition-all shadow-xl">
          <Plus size={32} />
        </div>
        <span className="font-black uppercase tracking-[0.3em] text-[10px]">Onboard New Capital</span>
      </motion.button>
    </div>
  );
}

function InputGroup({ label, icon, value, onChange }) {
  return (
    <div className="space-y-4">
      <label className="block text-[11px] font-black text-stone-600 uppercase tracking-[0.4em]">{label}</label>
      <div className="relative group">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-700 group-focus-within:text-accent transition-colors duration-300">
          {icon}
        </div>
        <input 
          type="text" 
          className="w-full pl-16 pr-8 py-6 rounded-3xl bg-muted/40 border-2 border-stone-800 focus:border-accent font-mono text-2xl transition-all shadow-inner outline-none text-stone-200 placeholder-stone-800" 
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
