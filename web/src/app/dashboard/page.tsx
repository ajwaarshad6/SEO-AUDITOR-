'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useInView, Variants, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Globe, Loader2, Trophy, Clock, Gauge, TrendingUp, 
  Folder, FileText, Trash2, ChevronDown, ChevronRight, ArrowUpRight, History, Sparkles, Lightbulb
} from 'lucide-react';

// --- 1. ANIMATED NUMBER COMPONENT ---
function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 2000, bounce: 0 });
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (isInView) motionValue.set(value);
  }, [motionValue, value, isInView]);

  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    return springValue.on("change", (latest) => setDisplayValue(Math.round(latest)));
  }, [springValue]);

  return <span ref={ref}>{displayValue.toLocaleString()}</span>;
}

// --- 2. ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 15 } }
};

export default function DashboardHome() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'history'>('overview');
  const [historySubTab, setHistorySubTab] = useState<'keywords' | 'audits'>('keywords');
  
  // Metrics State
  const [domain, setDomain] = useState(''); 
  const [trafficMetrics, setTrafficMetrics] = useState({ traffic: 0, keywords: 0 });
  const [authority, setAuthority] = useState<number | null>(null);
  const [googlePerf, setGooglePerf] = useState(0);
  
  // Loading States
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);
  
  // AI & Database State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // --- 3. DATA LOADING ---
  useEffect(() => {
    loadGlobalState();
    loadUserData();
  }, []);

  async function loadUserData() {
      try {
          const res = await fetch('/api/dashboard/user-data');
          const data = await res.json();
          setProjects(data.projects || []);
          setHistory(data.history || []);
          setAuditHistory(data.auditHistory || []);
      } catch(e) { console.error("Database Fetch Error", e); }
  }

  async function loadGlobalState() {
        try {
            const auditRes = await fetch('/api/audit/latest');
            const auditData = await auditRes.json();
            
            if (auditData.results && auditData.results.length > 0) {
                setDomain(auditData.domain);
                if (auditData.date) setLastScanDate(new Date(auditData.date).toLocaleDateString());
                const totalScore = auditData.results.reduce((acc: number, curr: any) => acc + (curr.scores?.overall || 0), 0);
                setHealthScore(Math.round(totalScore / auditData.results.length));
                fetchCardMetrics(auditData.domain);
            } else {
                setDomain('blackzero.org');
                fetchCardMetrics('blackzero.org');
            }
        } catch (e) { 
            setDomain('blackzero.org'); 
            fetchCardMetrics('blackzero.org');
        }
  }

  // --- FETCH METRICS VIA AI ---
  async function fetchCardMetrics(targetDomain: string) {
      const cleanDomain = targetDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      
      setIsMetricsLoading(true);
      fetchAiInsights(cleanDomain); // Keep the detailed breakdown call

      try {
        // Call the new Consolidated AI Metrics Endpoint
        const res = await fetch('/api/dashboard/ai-metrics', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: cleanDomain }) 
        });
        
        const data = await res.json();
        
        // Update all 3 cards at once
        setTrafficMetrics({ traffic: data.traffic || 0, keywords: 0 }); // AI estimates traffic
        setAuthority(data.authority || 0);
        setGooglePerf(data.speed || 0);

      } catch(e) { 
          console.error("Metric Fetch Error", e); 
      } finally { 
          setIsMetricsLoading(false); 
      }
  }

  async function fetchAiInsights(domainName: string) {
      setIsAiLoading(true);
      try {
          const res = await fetch('/api/backlink-auditor', { method: 'POST', body: JSON.stringify({ domain: domainName }) });
          const data = await res.json();
          setAiAnalysis(data);
      } catch (e) { console.error("AI Error", e); }
      finally { setIsAiLoading(false); }
  }

  const deleteItem = async (type: 'history' | 'project', id: string) => {
      if(!confirm("Permanently delete this?")) return;
      try {
          await fetch('/api/dashboard/delete', { method: 'POST', body: JSON.stringify({ type, id }) });
          loadUserData();
      } catch(e) { console.error(e); }
  };

  return (
    <div className="bg-slate-50/50 min-h-screen text-slate-900 font-sans -m-8 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER SECTION */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200/60 pb-6">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide">Command Center</span>
                    <span className="text-slate-400 text-xs flex items-center gap-1"><Clock size={10} /> Last scan: {lastScanDate || 'Never'}</span>
                </div>
                <h1 className="text-4xl font-extrabold text-slate-900 flex items-center gap-3 transition-colors tracking-tight">
                    {domain || 'Loading...'} <Globe size={28} className="text-slate-200" />
                </h1>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                {(['overview', 'projects', 'history'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{tab}</button>
                ))}
            </div>
        </motion.div>

        <AnimatePresence mode='wait'>
            
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div key="overview" variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-8 space-y-6">
                            {/* SCORE CARD */}
                            <motion.div variants={cardVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-8">
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Audit Score</h3>
                                    <ShieldCheck size={28} className="text-emerald-500" />
                                </div>
                                <div className="flex items-end gap-4 mb-8">
                                    <span className="text-7xl font-black text-slate-900">{healthScore !== null ? <AnimatedNumber value={healthScore} /> : '--'}</span>
                                    <span className="text-xl text-slate-400 font-medium mb-3">/ 100</span>
                                </div>
                                <div className="relative h-4 bg-slate-100 rounded-full w-full overflow-hidden shadow-inner">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${healthScore || 0}%` }} className={`h-full rounded-full ${healthScore && healthScore >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                </div>
                            </motion.div>

                            {/* AI STRATEGIC INTELLIGENCE */}
                            <motion.div variants={cardVariants} className="bg-white rounded-2xl border border-indigo-100 shadow-xl p-8 relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Lightbulb size={20}/></div>
                                    <h3 className="font-bold text-slate-800">AI Strategic Intelligence</h3>
                                    {isAiLoading && <Loader2 className="animate-spin text-indigo-600 ml-2" size={16}/>}
                                </div>
                                {aiAnalysis ? (
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="p-4 bg-slate-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Toxic Link Score</p>
                                                <p className={`text-2xl font-black text-emerald-500`}>{aiAnalysis.toxicScore}%</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-xl">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Top Anchor</p>
                                                <p className="text-sm font-bold text-indigo-600 truncate">{aiAnalysis.anchorText?.[0]?.text || "N/A"}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">AI Recommendations</p>
                                            <ul className="text-xs space-y-2 text-slate-600 font-medium">
                                                <li>✅ Improve high DA backlinks</li>
                                                <li>✅ Optimize H1 tags</li>
                                                <li>✅ Reduce layout shifts</li>
                                            </ul>
                                        </div>
                                    </div>
                                ) : <p className="text-slate-400 italic text-sm py-10 text-center">Loading AI context...</p>}
                            </motion.div>
                        </div>

                        {/* LIVE CARDS (NOW POWERED BY AI) */}
                        <div className="md:col-span-4 space-y-6">
                            
                            {/* Traffic Card */}
                            <motion.div variants={cardVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative h-[140px] flex flex-col justify-between">
                                {isMetricsLoading && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>}
                                <h3 className="text-slate-400 text-xs font-bold uppercase">Traffic</h3>
                                <div>
                                    <div className="text-3xl font-black"><AnimatedNumber value={trafficMetrics.traffic} /></div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">EST. MONTHLY VISITS</p>
                                </div>
                            </motion.div>
                            
                            {/* Authority Card */}
                            <motion.div variants={cardVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative h-[140px] flex flex-col justify-between">
                                {isMetricsLoading && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-purple-600"/></div>}
                                <h3 className="text-slate-400 text-xs font-bold uppercase">Authority</h3>
                                <div>
                                    <div className="text-3xl font-black">{authority !== null ? <AnimatedNumber value={authority} /> : 0}</div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">DA SCORE (0-100)</p>
                                </div>
                            </motion.div>
                            
                            {/* Speed Card */}
                            <motion.div variants={cardVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative h-[140px] flex flex-col justify-between">
                                {isMetricsLoading && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500"/></div>}
                                <h3 className="text-slate-400 text-xs font-bold uppercase">Speed</h3>
                                <div>
                                    <div className="text-3xl font-black"><AnimatedNumber value={googlePerf} /></div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Mobile Performance</p>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* 2. PROJECTS TAB */}
            {activeTab === 'projects' && (
                <motion.div key="projects" variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                    {projects.map((project) => {
                        const isKeywordFolder = project.name === "Keyword Opportunities" || project.name === "Keyword Research";
                        const isWebsite = !isKeywordFolder && (project.name.startsWith('http') || project.name.includes('.'));
                        return (
                            <motion.div key={project.id} variants={cardVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div 
                                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" 
                                    onClick={() => isKeywordFolder && setExpandedProject(expandedProject === project.id ? null : project.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${isWebsite ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {isWebsite ? <FileText size={24} /> : <Folder size={24} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-900 text-lg">{project.name}</h3>
                                                {isWebsite && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">Site Audit</span>}
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {isWebsite ? "Full Technical SEO Report" : `${project.items?.length || 0} Saved Keywords`} 
                                                {" • " + new Date(project.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={(e) => { e.stopPropagation(); deleteItem('project', project.id); }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                                        {isKeywordFolder ? (
                                            expandedProject === project.id ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />
                                        ) : (
                                            <Link href={`/issues?id=${project.id}`} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600">
                                                <ArrowUpRight size={18}/>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                                <AnimatePresence>
                                    {expandedProject === project.id && isKeywordFolder && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-slate-100 bg-slate-50/50 overflow-hidden">
                                            <div className="p-4">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                        <tr><th className="pb-2 pl-4">Keyword</th><th className="pb-2">Vol</th><th className="pb-2">KD</th><th className="pb-2">CPC</th></tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {project.items?.map((item: any) => (
                                                            <tr key={item.id} className="hover:bg-white transition-colors">
                                                                <td className="py-3 pl-4 font-semibold text-slate-700">{item.keyword}</td>
                                                                <td className="py-3">{item.volume?.toLocaleString()}</td>
                                                                <td className="py-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold text-[10px]">{item.difficulty}</span></td>
                                                                <td className="py-3">${item.cpc}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                    {projects.length === 0 && <p className="text-center py-20 text-slate-400 italic">No permanent projects found.</p>}
                </motion.div>
            )}

            {/* 3. HISTORY TAB */}
            {activeTab === 'history' && (
                <motion.div key="history" variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                    <div className="flex gap-4 border-b border-slate-200">
                        <button onClick={() => setHistorySubTab('keywords')} className={`pb-3 text-sm font-bold transition-all ${historySubTab === 'keywords' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}>Keyword History</button>
                        <button onClick={() => setHistorySubTab('audits')} className={`pb-3 text-sm font-bold transition-all ${historySubTab === 'audits' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}>Audit History</button>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <tbody className="divide-y divide-slate-100">
                                {historySubTab === 'keywords' ? history.map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold">{h.keyword}</td>
                                        <td className="p-4 text-slate-500 font-mono text-xs uppercase">{h.database}</td>
                                        <td className="p-4 text-right"><button onClick={() => deleteItem('history', h.id)}><Trash2 size={16} className="text-slate-300 hover:text-red-500"/></button></td>
                                    </tr>
                                )) : auditHistory.map(scan => (
                                    <tr key={scan.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-blue-600 truncate max-w-[200px]">{scan.domain}</td>
                                        <td className="p-4 font-bold text-emerald-600">{scan.score}%</td>
                                        <td className="p-4 text-right">
                                            {/* --- CRITICAL LINK FIX --- */}
                                            <Link href={`/issues?id=${scan.id}`}>
                                                <ArrowUpRight size={18} className="text-slate-400 hover:text-blue-600"/>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}