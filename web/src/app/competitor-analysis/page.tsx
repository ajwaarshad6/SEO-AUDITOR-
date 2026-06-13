"use client";

import { useState } from "react";
import { 
  Zap, Loader2, Globe, Target, BarChart3, 
  Plus, X, AlertTriangle, Layers, FileText, Link as LinkIcon,
  Trophy, TrendingUp, Sparkles, ArrowRight, CheckCircle2, XCircle, Activity
} from "lucide-react";

export default function CompetitorAnalysisPage() {
  const [targetDomain, setTargetDomain] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const handleCompetitorChange = (index: number, value: string) => {
    const newList = [...competitors];
    newList[index] = value;
    setCompetitors(newList);
  };

  const addCompetitorSlot = () => { if (competitors.length < 5) setCompetitors([...competitors, ""]); };
  const removeCompetitorSlot = (index: number) => {
    const newList = competitors.filter((_, i) => i !== index);
    setCompetitors(newList.length ? newList : [""]);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDomain) return;
    setLoading(true); 
    setError(""); 
    setData(null); 
    setStatusMessage("Starting enterprise scan...");

    try {
      const startRes = await fetch("/api/competitor-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: targetDomain, competitors: competitors.filter(c => c.trim()) })
      });
      const startData = await startRes.json();
      if (startData.error) throw new Error(startData.error);
      
      const jobId = startData.id || startData.jobId;
      if (!jobId) throw new Error("Could not retrieve Job ID from database.");
      
      const pollInterval = setInterval(async () => {
        try {
            const jobRes = await fetch(`/api/competitor-analysis?jobId=${jobId}&t=${Date.now()}`, { cache: "no-store" });
            const jobData = await jobRes.json();

            if (jobData.error) {
                clearInterval(pollInterval);
                setError(`API Error: ${jobData.error}`);
                setLoading(false);
                return;
            }
            
            if (jobData.status === "FAILED") {
                clearInterval(pollInterval);
                setError(jobData.errorMessage || "The Python worker encountered an error.");
                setLoading(false);
            } else if (jobData.status === "COMPLETED") {
                clearInterval(pollInterval);
                if (jobData.resultData) {
                    setData(jobData.resultData);
                } else if (jobData.resultUrl) {
                    const reportRes = await fetch(jobData.resultUrl);
                    const reportData = await reportRes.json();
                    setData(reportData);
                } else {
                    setError("Report data is missing from the database.");
                }
                setLoading(false);
            } else {
                setStatusMessage("Scanning and analyzing data...");
            }
        } catch (pollError: any) {
             clearInterval(pollInterval);
             setError("Lost connection to database.");
             setLoading(false);
        }
      }, 5000);

    } catch (err: any) {
      setError(err.message || "Failed to start job");
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500 shadow-emerald-200";
    if (score >= 50) return "bg-amber-500 shadow-amber-200";
    return "bg-rose-500 shadow-rose-200";
  };

  const getTextColor = (score: number) => {
     if (score >= 80) return "text-emerald-600";
     if (score >= 50) return "text-amber-600";
     return "text-rose-600";
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8] font-sans pb-20 text-slate-900">
      <div className="relative pt-24 pb-32 overflow-hidden border-b border-stone-200 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-600 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
                <Sparkles size={14} className="text-amber-500" /> Enterprise Intelligence
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 mb-6">
                Outsmart Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">Competition</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed">
                Analyze content gaps, technical stacks, and full domain authority.
            </p>

            <form onSubmit={handleAnalyze} className="bg-white p-2 rounded-3xl border border-stone-200 shadow-2xl shadow-stone-200/50 max-w-2xl mx-auto transition-all focus-within:ring-4 focus-within:ring-stone-100">
                <div className="flex flex-col gap-3 p-4">
                     <div className="relative group">
                        <div className="absolute left-4 top-4 text-stone-400 group-focus-within:text-slate-800 transition-colors"><Target size={20} /></div>
                        <input type="text" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="Your Website URL" className="w-full bg-stone-50 text-slate-900 placeholder:text-stone-400 pl-12 pr-4 py-4 rounded-2xl border border-transparent focus:bg-white focus:border-stone-300 outline-none transition-all font-semibold" />
                     </div>
                     {competitors.map((comp, idx) => (
                        <div key={idx} className="relative flex items-center group">
                            <div className="absolute left-4 text-stone-400 group-focus-within:text-slate-800 transition-colors"><Globe size={18} /></div>
                            <input type="text" value={comp} onChange={(e) => handleCompetitorChange(idx, e.target.value)} placeholder={`Competitor ${idx + 1} URL`} className="w-full bg-white text-slate-700 placeholder:text-stone-300 pl-12 pr-12 py-3 rounded-xl border border-stone-200 focus:border-stone-400 outline-none transition-all text-sm font-medium hover:bg-stone-50 focus:bg-white" />
                            {competitors.length > 1 && ( <button type="button" onClick={() => removeCompetitorSlot(idx)} className="absolute right-3 text-stone-400 hover:text-rose-500 transition-colors"><X size={16} /></button> )}
                        </div>
                     ))}
                     <div className="flex gap-3 mt-2">
                        <button type="button" onClick={addCompetitorSlot} className="px-5 py-3 rounded-xl bg-white text-stone-500 hover:text-stone-800 hover:bg-stone-50 text-xs font-bold uppercase transition-all flex items-center gap-2 border border-stone-200 shadow-sm"><Plus size={14}/> Add Rival</button>
                        <button disabled={loading || !targetDomain} className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} /> 
                                    <span className="text-sm font-medium">{statusMessage}</span>
                                </>
                            ) : (
                                <>Run Analysis <ArrowRight size={18}/></>
                            )}
                        </button>
                     </div>
                </div>
            </form>
            {error && (<div className="mt-8 flex items-center gap-2 justify-center text-rose-600 font-bold text-sm bg-rose-50 py-3 px-6 rounded-full border border-rose-100 shadow-sm"><AlertTriangle size={18} /> {error}</div>)}
        </div>
      </div>

      {data && (
        <div className="max-w-[1400px] mx-auto px-6 -mt-20 relative z-20 space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-10 duration-700">
            
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl shadow-stone-200/40">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-stone-100 rounded-2xl text-stone-600"><Layers size={24} /></div>
                    <div><div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Market Niche</div><div className="text-xl font-black text-slate-900">{data.niche}</div></div>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl shadow-stone-200/40">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-amber-50 rounded-2xl text-amber-500"><Trophy size={24} /></div>
                    <div className="overflow-hidden"><div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Market Leader</div><div className="text-xl font-black text-slate-900 truncate">{data.marketLeader}</div></div>
                 </div>
              </div>
               <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl shadow-stone-200/40">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><TrendingUp size={24} /></div>
                        <div><div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Your Growth</div><div className="text-xl font-black text-emerald-600">Tracking...</div></div>
                    </div>
                 </div>
              </div>
           </div>

           <div>
              <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3"><BarChart3 className="text-stone-400"/> Competitor Matrix</h3>
              <div className="overflow-x-auto pb-8 custom-scrollbar">
                <div className="flex gap-6 min-w-max">
                  {data.competitors?.map((comp: any, idx: number) => (
                    <div key={idx} className={`relative w-[400px] bg-white rounded-3xl border p-7 flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group ${comp.isTarget ? "border-amber-500 ring-4 ring-amber-50 shadow-amber-100 z-10" : "border-stone-200 shadow-sm"}`}>
                       <div className="flex justify-between items-start mb-5">
                           {comp.isTarget ? (<span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm shadow-amber-200">You</span>) : (<span className="bg-stone-100 text-stone-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Rival</span>)}
                           <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${comp.classification === "Dominant" ? "bg-purple-50 text-purple-600 border-purple-100" : comp.classification === "Strong" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-stone-50 text-stone-500 border-stone-100"}`}>{comp.classification}</span>
                       </div>
                       
                       <div className="mb-6">
                           <h4 className="font-bold text-xl text-slate-900 truncate mb-2" title={comp.domain}>{comp.domain}</h4>
                           <div className="flex flex-wrap gap-2 mb-4">
                               <span className="px-2 py-1 rounded-md bg-stone-50 border border-stone-100 text-[10px] font-bold text-stone-500 uppercase">{comp.intent}</span>
                               <span className="px-2 py-1 rounded-md border text-[10px] font-bold uppercase bg-stone-50 text-stone-600">Pages: {comp.total_pages}</span>
                               <span className="px-2 py-1 rounded-md bg-stone-50 border border-stone-100 text-[10px] font-bold text-stone-500 uppercase">{comp.niche}</span>
                           </div>
                       </div>

                       {comp.scores && (
                           <div className="mb-6 space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                               <div className="flex justify-between items-center mb-2 pb-2 border-b border-stone-200">
                                  <span className="text-xs font-black uppercase text-slate-800">Overall Score</span>
                                  <span className={`text-sm font-black ${getTextColor(comp.scores.overall)}`}>{comp.scores.overall}/100</span>
                               </div>
                               {[
                                 { label: "Authority", val: comp.scores.authority },
                                 { label: "Content Strength", val: comp.scores.content },
                                 { label: "Technical SEO", val: comp.scores.technical },
                                 { label: "Struct. SEO", val: comp.scores.seo },
                                 { label: "Market Power", val: comp.scores.market }
                               ].map((s, i) => (
                                 <div key={i}>
                                    <div className="flex justify-between text-[10px] font-bold text-stone-500 mb-1">
                                        <span>{s.label}</span>
                                        <span>{s.val}</span>
                                    </div>
                                    <div className="h-1.5 bg-white rounded-full overflow-hidden border border-stone-200">
                                        <div className={`h-full rounded-full ${getScoreColor(s.val)}`} style={{width: `${s.val}%`}}></div>
                                    </div>
                                 </div>
                               ))}
                           </div>
                       )}

                       <div className="grid grid-cols-2 gap-2 mb-6">
                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm"><div className="text-stone-400 text-[10px] font-bold uppercase mb-1">Word Count (Avg)</div><div className="font-bold text-slate-800 text-sm">{(comp.wordCount || 0).toLocaleString()}</div></div>
                          
                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm"><div className="text-stone-400 text-[10px] font-bold uppercase mb-1">Backlink Score</div><div className="font-bold text-slate-800 text-sm">{comp.backlinkScore || 0}/10</div></div>

                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm col-span-2">
                             <div className="text-stone-400 text-[10px] font-bold uppercase mb-1">Headings (Avg)</div>
                             <div className="flex gap-2 items-center">
                                 <span className="font-bold text-slate-800 text-sm">{comp.h1Count || 0} <span className="text-[10px] font-normal text-stone-500">H1</span></span>
                                 <span className="text-stone-300">|</span>
                                 <span className="font-bold text-slate-800 text-sm">{comp.h2Count || 0} <span className="text-[10px] font-normal text-stone-500">H2</span></span>
                                 <span className="text-stone-300">|</span>
                                 <span className="font-bold text-slate-800 text-sm">{comp.h3Count || 0} <span className="text-[10px] font-normal text-stone-500">H3</span></span>
                             </div>
                          </div>
                          
                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm"><div className="text-stone-400 text-[10px] font-bold uppercase mb-1">Int. Links (Avg)</div><div className="font-bold text-slate-800 text-sm">{comp.internalLinks || 0}</div></div>
                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm"><div className="text-stone-400 text-[10px] font-bold uppercase mb-1">Ext. Links (Avg)</div><div className="font-bold text-slate-800 text-sm">{comp.externalLinks || 0}</div></div>
                       </div>
                       
                       <div className="space-y-4 mt-auto pt-4 border-t border-stone-100">
                           {comp.keyStrengths?.length > 0 && (
                               <div>
                                   <div className="text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1"><CheckCircle2 size={12}/> Strengths</div>
                                   <ul className="text-xs text-stone-600 space-y-1">
                                       {comp.keyStrengths.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                                   </ul>
                               </div>
                           )}
                           {comp.keyWeaknesses?.length > 0 && (
                               <div>
                                   <div className="text-[10px] font-bold text-rose-500 uppercase mb-2 flex items-center gap-1"><XCircle size={12}/> Weaknesses</div>
                                   <ul className="text-xs text-stone-600 space-y-1">
                                       {comp.keyWeaknesses.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                                   </ul>
                               </div>
                           )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
           </div>

           {data.gapAnalysis && (
               <div className="bg-white rounded-3xl border border-stone-200 shadow-lg p-8">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3"><Activity className="text-blue-500"/> Competitive Gap Analysis</h3>
                   
                   <p className="text-sm text-stone-500 mb-8">
                       Difference between your domain and {data.gapAnalysis.target_is_leader ? "your closest rival" : "the Market Leader"} 
                       <span className="font-bold text-slate-800"> ({data.gapAnalysis.benchmark_domain})</span>. Negative numbers mean you are trailing.
                   </p>
                   
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                       {[
                           { label: "Content Depth (Words)", val: data.gapAnalysis.content_depth_gap },
                           { label: "Coverage (Pages)", val: data.gapAnalysis.content_coverage_gap },
                           { label: "Authority Score", val: data.gapAnalysis.authority_gap },
                           { label: "Technical Score", val: data.gapAnalysis.technical_structure_gap },
                           { label: "Internal Links", val: data.gapAnalysis.internal_linking_gap }
                       ].map((gap, i) => (
                           <div key={i} className={`p-4 rounded-xl border ${gap.val >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                               <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500 mb-2">{gap.label}</div>
                               <div className={`text-xl font-black ${gap.val >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                   {gap.val >= 0 ? `+${gap.val}` : gap.val}
                               </div>
                           </div>
                       ))}
                   </div>
                   
                   {data.gapAnalysis.topic_coverage_missing?.length > 0 && (
                       <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                           <div className="text-xs font-bold uppercase text-stone-500 mb-3">Missing Topic Coverage</div>
                           <div className="flex flex-wrap gap-2">
                               {data.gapAnalysis.topic_coverage_missing.map((topic: string, i: number) => (
                                   <span key={i} className="px-3 py-1 bg-white border border-rose-200 text-rose-600 text-xs font-bold rounded-lg capitalize">
                                       {topic}
                                   </span>
                               ))}
                           </div>
                       </div>
                   )}
               </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2rem] border border-stone-200 shadow-xl shadow-stone-200/50 hover:shadow-2xl transition-shadow group relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                 <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-3 relative z-10"><span className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-lg shadow-sm">⚡</span>Actionable Tactics</h3>
                 <ul className="space-y-4 relative z-10">
                    {data.recommendations?.shortTerm?.map((s: string, i: number) => (<li key={i} className="flex gap-4 items-start text-stone-600 text-sm font-medium"><div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0 shadow-sm">✓</div>{s}</li>))}
                 </ul>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl shadow-slate-900/20 hover:shadow-2xl transition-shadow group relative overflow-hidden text-white">
                 <div className="absolute top-0 right-0 w-40 h-40 bg-slate-800 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
                 <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-3 relative z-10"><span className="w-10 h-10 bg-slate-800 text-slate-300 rounded-xl flex items-center justify-center text-lg shadow-sm border border-slate-700">🚀</span>Long Term Strategy</h3>
                 <ul className="space-y-4 relative z-10">
                    {data.recommendations?.longTerm?.map((s: string, i: number) => (<li key={i} className="flex gap-4 items-start text-slate-300 text-sm font-medium"><div className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 border border-slate-600 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">★</div>{s}</li>))}
                 </ul>
              </div>
           </div>

        </div>
      )}
    </div>
  );
}