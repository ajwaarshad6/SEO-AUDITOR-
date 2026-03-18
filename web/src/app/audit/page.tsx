'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Play, Activity, Globe, CheckCircle, XCircle, FileText, Loader2, 
  AlertTriangle, Clock, Layers, Eye, X, Zap, Search, ExternalLink,
  BookOpen, Share2, Link as LinkIcon, RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// --- 1. DEFINE SUB-COMPONENTS AT THE TOP ---
function MetricItem({ label, value, good, unit = '' }: { label: string, value: string | number, good: boolean, unit?: string }) {
    return (
        <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs font-semibold text-slate-500">{label}</span>
            <div className={`text-lg font-bold flex items-center gap-1.5 ${good ? 'text-emerald-600' : 'text-rose-500'}`}>
                {good ? <CheckCircle size={14}/> : <AlertTriangle size={14}/>}
                {value}<span className="text-xs font-medium opacity-70">{unit}</span>
            </div>
        </div>
    );
}

// --- 2. TYPES ---
interface AuditIssue {
  severity: "critical" | "high" | "medium" | "low";
  message: string;
}

interface WebVitals {
  lcp: number;
  fcp: number;
  cls: string;
  tbt: number;
  speedIndex: number;
}

interface AuditResult {
  url: string;
  status: number;
  health_label: string; 
  audit_score: number;
  audit_issues: AuditIssue[];
  mobile: WebVitals;
  
  // New Fields
  readability_score?: number;
  is_orphan?: boolean;
  broken_external_links?: string[];
  redirect_chain?: string[];
  
  data: { 
      title: string; 
      desc: string; 
      h1Count: number;
      canonical: string; 
      ogUrl?: string;
      internal_links?: number;
      external_links?: number;
  };
}

interface ProgressStats {
  pages_scanned: number;
  pages_queued: number;
  total_discovered: number;
  elapsed_seconds: number;
  is_running: boolean;
  sitemap_status: string;
  sitemap_found: boolean;
  sitemap_count: number;
}

// --- 3. MAIN COMPONENT ---
export default function AuditPage() {
  const [startUrl, setStartUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPages, setScannedPages] = useState<AuditResult[]>([]);
  const [statusMsg, setStatusMsg] = useState(''); 
  const [selectedPage, setSelectedPage] = useState<AuditResult | null>(null);
  
  const [progress, setProgress] = useState<ProgressStats>({ 
     pages_scanned: 0, 
     total_discovered: 0, 
     elapsed_seconds: 0, 
     pages_queued: 0, 
     is_running: false,
     sitemap_status: "Pending", 
     sitemap_found: false, 
     sitemap_count: 0 
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // --- DATA MAPPING & DEDUPLICATION ---
  const formatPythonData = (rawData: any[]): AuditResult[] => {
    if (!Array.isArray(rawData)) return [];
    
    // 1. Enforce Deduplication on Frontend (keeps the latest strict score)
    const uniqueDataMap = new Map();
    rawData.forEach(item => {
        if (item && item.url && item.url.startsWith('http')) {
            uniqueDataMap.set(item.url, item);
        }
    });
    
    const uniqueData = Array.from(uniqueDataMap.values());

    return uniqueData.map(item => {
        const safeScore = typeof item.audit_score === 'number' ? item.audit_score : 0;
        const safeLabel = item.health_label || (safeScore > 0 ? (safeScore >= 90 ? "Excellent" : "Average") : "Calculating...");
        const safeMobile = item.mobile || { lcp: 0, fcp: 0, cls: "0", tbt: 0, speedIndex: 0 };

        return {
            url: item.url,
            status: item.status || 0,
            health_label: safeLabel,
            audit_score: safeScore,
            audit_issues: Array.isArray(item.audit_issues) ? item.audit_issues : [],
            mobile: safeMobile,
            
            // FIX: Ensure readability defaults to a number, handle 0 correctly
            readability_score: typeof item.readability_score === 'number' ? item.readability_score : 0,
            is_orphan: item.is_orphan || false,
            broken_external_links: item.broken_external_links || [],
            redirect_chain: item.redirect_chain || [],

            data: {
                title: item.title || "No Title",
                desc: item.meta_desc || "", 
                h1Count: item.h1_count || 0,
                canonical: item.canonical || "",
                ogUrl: item.og_url || "",
                internal_links: (item.links_internal || []).length,
                external_links: (item.links_external || []).length
            }
        };
    });
  };

  // --- SCAN LOGIC ---
  const startScan = async () => {
    if (!startUrl) return;

    let targetUrl = startUrl.trim();
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    setScannedPages([]); 
    setSelectedPage(null);
    setProgress({ 
        pages_scanned: 0, total_discovered: 0, elapsed_seconds: 0, pages_queued: 0, 
        is_running: true, sitemap_status: "Pending", sitemap_found: false, sitemap_count: 0 
    });
    setIsScanning(true); 
    
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await fetch(`http://127.0.0.1:8000/start_deep_crawl?url=${encodeURIComponent(targetUrl)}`, { method: 'POST' });
      
      intervalRef.current = setInterval(async () => {
        await fetchUpdates(); 
      }, 1000); 

    } catch (e: any) {
      console.error(e);
      setStatusMsg(`Error: ${e.message}`);
      setIsScanning(false);
    }
  };

  const fetchUpdates = async () => {
      try {
          const progRes = await fetch('http://127.0.0.1:8000/get_progress', { cache: 'no-store' });
          if (progRes.ok) {
              const stats: ProgressStats = await progRes.json();
              
              setProgress(stats);

              if (stats.is_running === false && stats.pages_scanned > 0) {
                    setIsScanning(false);
                    setStatusMsg('Audit Complete.');
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    
                    setProgress(prev => ({ ...prev, pages_scanned: prev.total_discovered }));
                    
                    // THE FIX: Pass 'true' to signal that the scan is finished and it is safe to save to DB
                    await fetchResults(true); 
                    return;
              }
          }
          // THE FIX: Pass 'false' during the scan. It will update the UI but WON'T spam the database.
          await fetchResults(false);

      } catch (e) { console.warn("Polling...", e); }
  };

  const fetchResults = async (isFinalSave = false) => {
      try {
          const resRes = await fetch(`http://127.0.0.1:8000/get_results`, { cache: `no-store` });
          if (resRes.ok) {
              const responseJson = await resRes.json();
              const rawData = responseJson.results || []; 
              const cleanData = formatPythonData(rawData);
              
              if (cleanData.length > 0) {
                  setScannedPages(cleanData);
                  localStorage.setItem(`latestAudit`, JSON.stringify(cleanData));

                  // THE FIX: ONLY execute the Supabase backup if this is the very last fetch at 100%
                  if (isFinalSave) {
                      try {
                          const domainName = new URL(startUrl.startsWith(`http`) ? startUrl : `https://${startUrl}`).hostname;
                          
                          const saveRes = await fetch(`/api/audit/save`, {
                              method: `POST`,
                              headers: { [`Content-Type`]: `application/json` },
                              body: JSON.stringify({
                                  domain: domainName,
                                  results: cleanData
                              })
                          });
                          
                          if (saveRes.ok) {
                              console.log(`Audit successfully backed up to Supabase!`);
                          }
                      } catch (saveErr) {
                          console.error(`Supabase backup failed:`, saveErr);
                      }
                  }
              }
          }
      } catch (e) { 
          console.error(`Error fetching results`, e); 
      }
  };

  // --- HELPERS ---
  const getMetricColor = (value: number | string, type: 'lcp' | 'cls' | 'tbt' | 'score' | 'readability') => {
    if (type === 'score') return (value as number) >= 90 ? 'text-emerald-500' : (value as number) >= 50 ? 'text-amber-500' : 'text-rose-500';
    if (type === 'readability') return (value as number) >= 60 ? 'text-emerald-600' : (value as number) >= 40 ? 'text-amber-600' : 'text-rose-600';
    if (type === 'lcp') return (value as number) <= 2500 ? 'text-emerald-600' : (value as number) <= 4000 ? 'text-amber-600' : 'text-rose-600';
    if (type === 'tbt') return (value as number) <= 200 ? 'text-emerald-600' : (value as number) <= 600 ? 'text-amber-600' : 'text-rose-600';
    if (type === 'cls') return parseFloat(value as string) <= 0.1 ? 'text-emerald-600' : parseFloat(value as string) <= 0.25 ? 'text-amber-600' : 'text-rose-600';
    return 'text-slate-500';
  };

  const getHealthBadge = (label: string) => {
      if (label === 'Excellent') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      if (label === 'Average') return 'bg-amber-100 text-amber-800 border-amber-200';
      return 'bg-rose-100 text-rose-800 border-rose-200';
  };

  // --- PDF EXPORT ---
  const generatePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const today = format(new Date(), 'PPP');
    const domain = startUrl ? new URL(startUrl.startsWith('http') ? startUrl : `https://${startUrl}`).hostname : 'Unknown Domain';

    // 1. Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text("Comprehensive SEO Audit Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Analyzed Website: ${domain}`, 14, 28);
    doc.text(`Date of Audit: ${today}`, 14, 33);

    // 2. Summary
    const totalPages = scannedPages.length;
    const avgScore = Math.round(scannedPages.reduce((acc, p) => acc + p.audit_score, 0) / (totalPages || 1));
    const criticalIssues = scannedPages.reduce((acc, p) => acc + p.audit_issues.filter(i => i.severity === 'critical').length, 0);
    const orphanPages = scannedPages.filter(p => p.is_orphan).length;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Executive Summary", 14, 45);

    const summaryData = [
      ['Total Pages Scanned', totalPages.toString()],
      ['Average Audit Score', `${avgScore} / 100`],
      ['Critical Issues Found', criticalIssues.toString()],
      ['Orphan Pages Detected', orphanPages.toString()],
    ];

    autoTable(doc, {
      startY: 50,
      head: [],
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [71, 85, 105] },
        1: { textColor: [30, 41, 59] } 
      }
    });

    // 3. Table
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    // @ts-ignore
    doc.text("Detailed Page Analysis", 14, doc.lastAutoTable.finalY + 15);

    autoTable(doc, {
      // @ts-ignore
      startY: doc.lastAutoTable.finalY + 20,
      head: [['URL', 'Score', 'Readability', 'Broken Links', 'LCP (ms)', 'Total Issues']],
      body: scannedPages.map(p => [
        p.url, 
        p.audit_score, 
        // FIX: Use ?? to render 0 correctly instead of falling back to 'N/A'
        p.readability_score ?? 'N/A', 
        p.broken_external_links?.length || 0,
        p.mobile.lcp, 
        p.audit_issues.length
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249], 
        textColor: [71, 85, 105], 
        fontStyle: 'bold',
        lineWidth: 0
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [51, 65, 85], 
        lineWidth: 0
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 120 }, 
        1: { fontStyle: 'bold' } 
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); 
        const footerText = `Page ${doc.getNumberOfPages()}`;
        // @ts-ignore
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(footerText, data.settings.margin.left, pageHeight - 10);
      }
    });

    doc.save(`${domain.replace(/\./g, '-')}-audit-report.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 relative overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8 relative z-10 mt-4">
        
        {/* INPUT */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-2 transform hover:scale-[1.01] transition-transform duration-500">
            <div className="flex flex-col md:flex-row gap-2 p-2">
                <div className="flex-1 relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                        <Search size={22}/>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Enter domain URL (e.g. blackzero.org)" 
                        value={startUrl} 
                        onChange={e => setStartUrl(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && startScan()}
                        className="w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-100 rounded-2xl outline-none font-medium text-lg"
                        disabled={isScanning} 
                    />
                </div>
                <button onClick={startScan} disabled={isScanning || !startUrl} className="bg-slate-900 hover:bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center gap-3 transition-all duration-300">
                    {isScanning ? <Loader2 className="animate-spin"/> : <Play fill="currentColor"/>} 
                    {isScanning ? 'Scanning...' : 'Start Audit'}
                </button>
            </div>
            
            {/* PROGRESS BAR */}
            {isScanning && (
                <div className="px-4 pb-4 pt-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase">
                        <span>Progress</span>
                        <span>{Math.round((progress.pages_scanned / Math.max(progress.total_discovered, 1)) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 w-full overflow-hidden rounded-full">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse rounded-full transition-all duration-500"
                             style={{ width: `${Math.min(100, (progress.pages_scanned / Math.max(progress.total_discovered, 1)) * 100)}%` }} />
                    </div>
                </div>
            )}
        </div>

        {/* METRICS DASHBOARD */}
        {(isScanning || scannedPages.length > 0) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-lg overflow-hidden">
                    <Clock size={80} className="absolute top-0 right-0 p-4 opacity-10 -translate-y-2"/>
                    <div className="relative z-10">
                        <div className="text-blue-100 font-medium text-xs uppercase tracking-widest mb-1">Duration</div>
                        <div className="text-4xl font-bold">{Math.floor(progress.elapsed_seconds / 60)}m {progress.elapsed_seconds % 60}s</div>
                    </div>
                </div>
                <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg overflow-hidden">
                    <Layers size={80} className="absolute top-0 right-0 p-4 opacity-10 -translate-y-2"/>
                    <div className="relative z-10">
                        <div className="text-emerald-100 font-medium text-xs uppercase tracking-widest mb-1">Pages Scanned</div>
                        <div className="text-4xl font-bold">{progress.pages_scanned} <span className="text-lg opacity-60">/ {progress.total_discovered}</span></div>
                    </div>
                </div>
                <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-6 rounded-3xl text-white shadow-lg overflow-hidden">
                    <Loader2 size={80} className={`absolute top-0 right-0 p-4 opacity-10 -translate-y-2 ${isScanning ? 'animate-spin-slow' : ''}`}/>
                    <div className="relative z-10">
                        <div className="text-amber-100 font-medium text-xs uppercase tracking-widest mb-1">In Queue</div>
                        <div className="text-4xl font-bold">{progress.pages_queued}</div>
                    </div>
                </div>
                <div className={`relative bg-gradient-to-br p-6 rounded-3xl text-white shadow-lg overflow-hidden ${progress.sitemap_found ? 'from-emerald-500 to-teal-600' : 'from-rose-500 to-pink-600'}`}>
                    <Globe size={80} className="absolute top-0 right-0 p-4 opacity-10 -translate-y-2"/>
                    <div className="relative z-10">
                        <div className="font-medium text-xs uppercase tracking-widest mb-1">Sitemap</div>
                        <div className="text-2xl font-bold">{progress.sitemap_found ? `Found (${progress.sitemap_count})` : "Using Discovery"}</div>
                    </div>
                </div>
            </div>
        )}

        {/* RESULTS TABLE */}
        {scannedPages.length > 0 && (
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Audit Results <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-xs font-bold">{scannedPages.length}</span>
                    </h2>
                    <button onClick={generatePDF} className="group hover:bg-slate-900 bg-white border border-slate-200 hover:border-slate-900 text-slate-700 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold flex gap-2 items-center transition-all duration-300">
                        <FileText size={16} className="group-hover:scale-110 transition-transform"/> Export Report
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-xs tracking-wider border-b border-slate-100 backdrop-blur">
                            <tr>
                                <th className="px-8 py-5 pl-10">URL</th>
                                <th className="px-8 py-5">Health</th>
                                <th className="px-8 py-5">Content</th>
                                <th className="px-8 py-5">Performance (LCP)</th>
                                <th className="px-8 py-5">CLS</th>
                                <th className="px-8 py-5 text-right pr-10">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {scannedPages.map((p, i) => (
                                <tr key={i} className="group hover:bg-indigo-50/30 transition-colors duration-200">
                                    <td className="px-8 py-5 pl-10 max-w-[350px]">
                                        <div className="truncate font-medium text-slate-700">
                                            <a href={p.url} target="_blank" rel="noopener" className="hover:text-indigo-600 flex items-center gap-2">
                                                {p.url} <ExternalLink size={12} className="opacity-50"/>
                                            </a>
                                        </div>
                                        {p.is_orphan && <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">ORPHAN PAGE</span>}
                                        {(p.broken_external_links?.length || 0) > 0 && <span className="inline-block mt-1 ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">{p.broken_external_links?.length} BROKEN LINKS</span>}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-bold ${getMetricColor(p.audit_score, 'score')}`}>{p.audit_score}</span>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${getHealthBadge(p.health_label)}`}>{p.health_label}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className={`flex items-center gap-2 text-xs font-bold ${getMetricColor(p.readability_score || 0, 'readability')}`}>
                                            <BookOpen size={14} className="opacity-70"/> 
                                            {/* FIX: Use ?? to render 0 correctly */}
                                            Readability: {p.readability_score ?? 'N/A'}
                                        </div>
                                    </td>
                                    <td className={`px-8 py-5 font-mono font-bold ${getMetricColor(p.mobile?.lcp, 'lcp')}`}>{p.mobile?.lcp}ms</td>
                                    <td className={`px-8 py-5 font-mono font-bold ${getMetricColor(p.mobile?.cls, 'cls')}`}>{p.mobile?.cls}</td>
                                    <td className="px-8 py-5 text-right pr-10">
                                        <button onClick={() => setSelectedPage(p)} className="text-slate-400 hover:text-indigo-600 p-2.5 rounded-xl hover:bg-indigo-100"><Eye size={18}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedPage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex justify-between bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2 mb-1"><Activity size={20} className="text-indigo-600"/><h2 className="text-2xl font-bold">Deep Audit Report</h2></div>
                        <p className="text-sm font-mono text-slate-500">{selectedPage.url}</p>
                    </div>
                    <button onClick={() => setSelectedPage(null)}><X size={28} className="text-slate-400 hover:text-rose-500"/></button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 flex-1 grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* COL 1: Stats */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex gap-2"><Zap size={14}/> Core Vitals</h3>
                            <div className="space-y-4">
                                <MetricItem label="LCP" value={selectedPage.mobile.lcp} unit="ms" good={selectedPage.mobile.lcp <= 2500}/>
                                <MetricItem label="CLS" value={selectedPage.mobile.cls} good={parseFloat(selectedPage.mobile.cls) <= 0.1}/>
                                <MetricItem label="TBT" value={selectedPage.mobile.tbt} unit="ms" good={selectedPage.mobile.tbt <= 200}/>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex gap-2"><BookOpen size={14}/> Content Quality</h3>
                            <div className="space-y-4">
                                <MetricItem label="Readability Score" value={selectedPage.readability_score || 0} good={(selectedPage.readability_score || 0) >= 60} unit="/100"/>
                                <MetricItem label="Internal Links" value={selectedPage.data.internal_links || 0} good={(selectedPage.data.internal_links || 0) > 0}/>
                                <MetricItem label="External Links" value={selectedPage.data.external_links || 0} good={true}/>
                            </div>
                        </div>
                    </div>

                    {/* COL 2 & 3: Issues */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-50 flex justify-between">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex gap-2"><AlertTriangle size={14}/> Issues Found</h3>
                                <span className="bg-slate-100 px-2 rounded text-xs font-bold">{selectedPage.audit_issues.length}</span>
                            </div>
                            <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {selectedPage.audit_issues.length === 0 ? <div className="p-8 text-center text-emerald-600 font-bold">No Issues Found!</div> : 
                                 selectedPage.audit_issues.map((issue, idx) => (
                                    <div key={idx} className="p-4 hover:bg-slate-50 rounded-xl flex gap-4 mb-1">
                                        <div className={`mt-1 p-2 rounded-lg ${issue.severity === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {issue.severity === 'critical' ? <XCircle size={18}/> : <AlertTriangle size={18}/>}
                                        </div>
                                        <div>
                                            <div className={`text-[10px] font-bold uppercase mb-1 ${issue.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>{issue.severity} Priority</div>
                                            <div className="text-sm font-medium text-slate-700">{issue.message}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {(selectedPage.broken_external_links?.length || 0) > 0 && (
                             <div className="bg-rose-50 rounded-3xl shadow-sm border border-rose-100 overflow-hidden p-6">
                                 <h3 className="text-xs font-bold text-rose-800 uppercase tracking-widest mb-4 flex gap-2"><LinkIcon size={14}/> Broken External Links</h3>
                                 <ul className="space-y-2">
                                     {selectedPage.broken_external_links?.map((link, i) => (
                                         <li key={i} className="text-sm text-rose-600 flex items-center gap-2"><XCircle size={12}/> {link}</li>
                                     ))}
                                 </ul>
                             </div>
                        )}

                        {(selectedPage.redirect_chain?.length || 0) > 1 && (
                             <div className="bg-orange-50 rounded-3xl shadow-sm border border-orange-100 overflow-hidden p-6">
                                 <h3 className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-4 flex gap-2"><RefreshCw size={14}/> Redirect Chain Detected</h3>
                                 <div className="flex flex-col gap-2">
                                     {selectedPage.redirect_chain?.map((url, i) => (
                                         <div key={i} className="flex items-center gap-2 text-sm text-orange-700">
                                            <span className="font-mono opacity-50">{i+1}.</span> {url}
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}