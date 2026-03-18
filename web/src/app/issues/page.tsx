'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  AlertTriangle, CheckCircle, FileWarning, ExternalLink, ImageIcon, 
  Clock, Lock, RefreshCw, Type, AlignLeft, Globe, 
  Share2, Database, Link as LinkIcon, Smartphone, Monitor,
  Activity, Layers, Search, Server, Calendar, FileCode, BarChart3, ShieldAlert,
  BookOpen, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// --- TYPES ---
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
      schemas?: string[];
      socials?: number;
  };
}

const COLORS = {
    performance: '#3b82f6',
    accessibility: '#10b981',
    usability: '#8b5cf6',
    onPage: '#f59e0b',
    offPage: '#6366f1' 
};

function IssuesContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AuditResult[]>([]);
  const [meta, setMeta] = useState({ domain: '', date: '' });
  const [loading, setLoading] = useState(true);
  const [animateBars, setAnimateBars] = useState(false);

  // --- SUPABASE HISTORY STATES ---
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Initial Metrics State
  const [graphMetrics, setGraphMetrics] = useState([
    { label: 'Performance', score: 0, color: COLORS.performance },
    { label: 'Accessibility', score: 0, color: COLORS.accessibility },
    { label: 'Usability', score: 0, color: COLORS.usability },
    { label: 'On-Page SEO', score: 0, color: COLORS.onPage },
    { label: 'Off-Page SEO', score: 0, color: COLORS.offPage },
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateBars(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // --- 1. FETCH PROJECTS FROM SUPABASE ---
  useEffect(() => {
    async function loadHistory() {
        setLoading(true);
        try {
            const res = await fetch(`/api/audit/history`);
            const json = await res.json();
            if (json.success && json.projects) {
                setProjects(json.projects);
                if (json.projects.length > 0) {
                    setActiveProjectId(json.projects[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to load history:", e);
        } finally {
            setLoading(false);
        }
    }
    loadHistory();
  }, []);

  // --- 2. MAP SUPABASE DATA & FETCH OFF-PAGE SCORE ---
  useEffect(() => {
    if (!activeProjectId) return;
    const project = projects.find(p => p.id === activeProjectId);
    if (!project || !project.scans || project.scans.length === 0) {
        setData([]);
        return;
    }

    const scan = project.scans[0];
    setMeta({ domain: project.domain, date: format(new Date(scan.scannedAt), 'PPP') });

    const fetchAndProcessData = async () => {
        let fetchedOffPageScore = 0; 
        try {
            const res = await fetch(`/api/backlink-auditor/score?domain=${encodeURIComponent(project.domain)}`);
            const json = await res.json();
            if (json.success) {
                fetchedOffPageScore = json.score;
            }
        } catch (e) { 
            console.warn("Could not fetch backlink score from Supabase.", e); 
        }

        const mapped = scan.pages.map((p: any) => ({
            url: p.url,
            status: p.status,
            health_label: p.healthLabel,
            audit_score: p.auditScore,
            audit_issues: p.issues || [],
            mobile: { 
                lcp: p.mobile?.lcp || 1500, 
                fcp: p.mobile?.fcp || 1000, 
                cls: p.mobile?.cls || "0", 
                tbt: p.mobile?.tbt || 100, 
                speedIndex: p.mobile?.speedIndex || 90 
            }, 
            readability_score: p.readabilityScore,
            is_orphan: p.isOrphan,
            broken_external_links: p.broken_external_links || [],
            redirect_chain: p.redirect_chain || [],
            data: {
                title: p.title || "",
                desc: p.metaDesc || "",
                h1Count: p.h1Count || 0,
                canonical: p.canonical || p.url, 
                ogUrl: p.ogUrl || p.url,
                internal_links: 10,
                external_links: 10,
                schemas: ["WebPage"],
                socials: 1 
            }
        }));

        processData(mapped, fetchedOffPageScore);
    };

    fetchAndProcessData();
  }, [activeProjectId, projects]);

  // --- 3. EXACT SEMRUSH SCORE CALCULATIONS ---
  const processData = (results: AuditResult[], offPageScore: number) => {
      setData(results);
      if (results.length === 0) return;

      const total = results.length;
      
      const avgOnPage = Math.round(results.reduce((acc, curr) => acc + (curr.audit_score || 0), 0) / total);
      
      const avgPerf = Math.round(results.reduce((acc, curr) => {
          let score = 100;
          if (curr.mobile?.lcp > 2500) score -= 15;
          if (curr.mobile?.lcp > 4000) score -= 20; 
          if (curr.mobile?.tbt > 200) score -= 10;
          if (curr.mobile?.tbt > 600) score -= 15;  
          return acc + Math.max(0, score);
      }, 0) / total);

      const avgAccess = Math.round(results.reduce((acc, curr) => {
          let score = 100;
          if (curr.data?.h1Count !== 1) score -= 15; 
          if (!curr.data?.canonical) score -= 10; 
          const imgIssues = curr.audit_issues?.filter(i => i.message.includes('Alt')).length || 0;
          score -= (imgIssues * 2);
          
          // --- NEW: ADDED PENALTIES FOR ADVANCED RULES ---
          if (curr.audit_issues?.some(i => i.message.toLowerCase().includes('viewport'))) score -= 15; // Viewport penalty
          if (curr.audit_issues?.some(i => i.message.toLowerCase().includes('hierarchy'))) score -= 10; // Heading hierarchy penalty
          // -----------------------------------------------
          
          return acc + Math.max(0, score);
      }, 0) / total);
      
      const avgUsability = Math.round(results.reduce((acc, curr) => {
          let score = 100;
          const cls = parseFloat(curr.mobile?.cls || "0");
          if (cls > 0.1) score -= 10;
          if (cls > 0.25) score -= 15; 
          if ((curr.readability_score || 100) < 60) score -= 15; 
          if (curr.url.startsWith('http:')) score -= 25; 
          if (curr.is_orphan) score -= 10; 
          
          // --- NEW: ADDED PENALTIES FOR ADVANCED RULES ---
          if (curr.audit_issues?.some(i => i.message.toLowerCase().includes('noindex'))) score -= 30; // Critical Noindex Penalty
          if (curr.audit_issues?.some(i => i.message.toLowerCase().includes('dirty sitemap'))) score -= 20; // Dirty Sitemap Penalty
          // -----------------------------------------------
          
          return acc + Math.max(0, score);
      }, 0) / total);
      
      setGraphMetrics([
        { label: 'Performance', score: avgPerf || 0, color: COLORS.performance },
        { label: 'Accessibility', score: avgAccess || 0, color: COLORS.accessibility },
        { label: 'Usability', score: avgUsability || 0, color: COLORS.usability },
        { label: 'On-Page SEO', score: avgOnPage || 0, color: COLORS.onPage },
        { label: 'Off-Page SEO', score: offPageScore, color: COLORS.offPage }, 
      ]);
  };

  const generatePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const today = format(new Date(), 'PPP');
    const domain = meta.domain;

    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text("Comprehensive SEO Audit Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Analyzed Website: ${domain}`, 14, 28);
    doc.text(`Date of Audit: ${today}`, 14, 33);

    const totalPages = data.length;
    const avgScore = Math.round(data.reduce((acc, p) => acc + p.audit_score, 0) / (totalPages || 1));
    const criticalIssues = data.reduce((acc, p) => acc + p.audit_issues.filter(i => i.severity === 'critical').length, 0);
    const orphanPages = data.filter(p => p.is_orphan).length;

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

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    // @ts-ignore
    doc.text("Detailed Page Analysis", 14, doc.lastAutoTable.finalY + 15);

    autoTable(doc, {
      // @ts-ignore
      startY: doc.lastAutoTable.finalY + 20,
      head: [['URL', 'Score', 'Readability', 'Broken Links', 'LCP (ms)', 'Total Issues']],
      body: data.map(p => [
        p.url, 
        p.audit_score, 
        p.readability_score ?? 'N/A',
        p.broken_external_links?.length || 0,
        p.mobile?.lcp || 0, 
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

  const getPages = (filter: (p: AuditResult) => boolean) => data.filter(filter);

  // --- STRICT RULE DEFINITIONS ---
  const sections = [
    {
        title: "Broken External Links",
        desc: "Critical: External links on these pages are dead (404).",
        items: getPages(p => (p.broken_external_links?.length || 0) > 0),
        color: "text-red-700", bg: "bg-red-50", icon: LinkIcon,
        renderDetail: (p: AuditResult) => (
            <div className="mt-2 text-xs bg-white p-2 rounded border border-red-100">
                <p className="font-semibold text-red-800 mb-1">Dead Links Found:</p>
                <ul className="list-disc pl-4 text-red-600 space-y-1">
                    {p.broken_external_links?.map((link, i) => (
                        <li key={i} className="break-all">{link}</li>
                    ))}
                </ul>
            </div>
        )
    },
    {
        title: "Redirect Chains Detected",
        desc: "Avoid chains (A -> B -> C). Links should go directly to the destination.",
        items: getPages(p => (p.redirect_chain?.length || 0) > 1),
        color: "text-orange-600", bg: "bg-orange-50", icon: RefreshCw,
        renderDetail: (p: AuditResult) => (
            <div className="mt-2 text-xs bg-white p-2 rounded border border-orange-100">
                <p className="font-semibold text-orange-800 mb-1">Redirect Path:</p>
                <div className="flex flex-col gap-1">
                    {p.redirect_chain?.map((url, i) => (
                        <div key={i} className="flex items-center gap-2 text-orange-700">
                            <span className="font-mono text-[10px] opacity-70">{i + 1}.</span>
                            <span className="truncate">{url}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
       title: "Low Readability Score (< 60)",
       desc: "Content is too difficult to read or thin.",
       items: getPages(p => (p.readability_score || 100) < 60),
       color: "text-orange-600", bg: "bg-orange-50", icon: BookOpen,
       showValue: (p: AuditResult) => `Score: ${p.readability_score}`
    },
    {
      title: "Orphan Pages (0 Incoming Links)",
      desc: "Pages that are not linked from anywhere else on the site.",
      items: getPages(p => !!p.is_orphan),
      color: "text-purple-600", bg: "bg-purple-50", icon: LinkIcon
    },
    {
        title: "Title Length Issues (50-60 chars)",
        desc: "Strict Rule: Meta titles must be between 50 and 60 characters.",
        items: getPages(p => {
            const l = p.data?.title?.length || 0;
            return l > 0 && (l < 50 || l > 60);
        }),
        color: "text-amber-700", bg: "bg-amber-50", icon: Type,
        layoutType: 'table', contentType: 'title'
    },
    {
        title: "Description Length Issues (150-160 chars)",
        desc: "Strict Rule: Meta description must be between 150 and 160 characters.",
        items: getPages(p => {
            const l = p.data?.desc?.length || 0;
            return l > 0 && (l < 150 || l > 160);
        }),
        color: "text-amber-700", bg: "bg-amber-50", icon: AlignLeft,
        layoutType: 'table', contentType: 'desc'
    },
    {
      title: "Poor LCP (> 2.5s)",
      desc: "Largest Contentful Paint. Good: <=2.5s. Critical: >4s.",
      items: getPages(p => (p.mobile?.lcp || 0) > 2500),
      color: "text-red-600", bg: "bg-red-50", icon: Layers,
      showValue: (p: AuditResult) => `${((p.mobile?.lcp || 0)/1000).toFixed(2)}s`
    },
    {
      title: "HTTP Insecure Pages",
      desc: "Critical: Pages not served over HTTPS.",
      items: getPages(p => Boolean(p.url.startsWith('http:'))),
      color: "text-red-700", bg: "bg-red-100", icon: Lock
    },
    {
      title: "404 Broken Pages",
      desc: "Pages that were not found (0 allowed).",
      items: getPages(p => p.status === 404),
      color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle
    },
    {
      title: "Multiple H1 Tags",
      desc: "Strict Rule: Exactly one H1 tag per page.",
      items: getPages(p => (p.data?.h1Count || 0) > 1),
      color: "text-yellow-600", bg: "bg-yellow-50", icon: Type,
      showValue: (p: AuditResult) => `${p.data?.h1Count} H1s`
    },
    {
      title: "Missing H1 Tags",
      desc: "Strict Rule: H1 tag is required.",
      items: getPages(p => (p.data?.h1Count || 0) === 0),
      color: "text-red-600", bg: "bg-red-50", icon: Type
    },
    {
      title: "Missing Social Links",
      desc: "Identity rule: Page must link to social profiles.",
      items: getPages(p => (p.data?.socials || 0) === 0),
      color: "text-slate-600", bg: "bg-slate-100", icon: Share2
    },
    {
      title: "Missing Canonical Tags",
      desc: "Self-referencing canonical tag required.",
      items: getPages(p => !p.data?.canonical),
      color: "text-orange-600", bg: "bg-orange-50", icon: Globe
    },
    // --- NEW: 5 ADVANCED SEMRUSH RULES APPENDED HERE ---
    {
      title: "Blocked by Noindex",
      desc: "Critical: Page contains a noindex tag and is ignored by search engines.",
      items: getPages(p => p.audit_issues?.some(i => i.message.toLowerCase().includes('noindex')) || false),
      color: "text-red-700", bg: "bg-red-50", icon: ShieldAlert
    },
    {
      title: "Missing Viewport Tag",
      desc: "High: Page is not optimized for mobile responsiveness.",
      items: getPages(p => p.audit_issues?.some(i => i.message.toLowerCase().includes('viewport')) || false),
      color: "text-orange-600", bg: "bg-orange-50", icon: Smartphone
    },
    {
      title: "Heading Hierarchy Skipped",
      desc: "Medium: Logical heading structure is broken (e.g., H2 directly to H4).",
      items: getPages(p => p.audit_issues?.some(i => i.message.toLowerCase().includes('hierarchy')) || false),
      color: "text-amber-600", bg: "bg-amber-50", icon: Type
    },
    {
      title: "Missing Hreflang Tags",
      desc: "Low: International SEO targeting tags are missing.",
      items: getPages(p => p.audit_issues?.some(i => i.message.toLowerCase().includes('hreflang')) || false),
      color: "text-slate-600", bg: "bg-slate-100", icon: Globe
    },
    {
      title: "Dirty Sitemap Detected",
      desc: "High: Sitemap contains non-200, redirected, or non-indexable URLs.",
      items: getPages(p => p.audit_issues?.some(i => i.message.toLowerCase().includes('dirty sitemap')) || false),
      color: "text-red-600", bg: "bg-red-50", icon: Database
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <div className="max-w-[1500px] mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* --- LEFT SIDEBAR: DOMAINS --- */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Audited Domains</h3>
                <div className="space-y-2 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {projects.length === 0 && !loading ? (
                        <p className="text-sm text-slate-500 px-2">No domains audited.</p>
                    ) : (
                        projects.map(project => (
                            <button
                                key={project.id}
                                onClick={() => setActiveProjectId(project.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                                    activeProjectId === project.id 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'hover:bg-slate-100 text-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Globe size={18} className="flex-shrink-0" />
                                    <span className="font-semibold text-sm truncate">{project.domain}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                                    activeProjectId === project.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {project.latestScore}/100
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <div className="lg:col-span-4">
            <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <ShieldAlert className="text-red-500" size={32} />
                Compliance & Issues Report
                </h1>
                <p className="text-slate-500 mt-2">
                Strict audit based on 50+ technical SEO rules. 
                Found {sections.reduce((acc, curr) => acc + curr.items.length, 0)} violations across {data.length} pages.
                </p>
            </div>
            {!loading && data.length > 0 && (
                <div className="flex gap-4 items-center">
                    <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-6">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Domain</div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                <Globe size={14} className="text-blue-500"/> {meta.domain}
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-100"></div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scan Date</div>
                            <div className="font-bold text-slate-700 flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400"/> {meta.date}
                            </div>
                        </div>
                    </div>
                    <button onClick={generatePDF} className="group hover:bg-slate-900 bg-white border border-slate-200 hover:border-slate-900 text-slate-700 hover:text-white px-5 py-3 rounded-xl text-sm font-bold flex gap-2 items-center transition-all duration-300 shadow-sm">
                            <FileText size={16} className="group-hover:scale-110 transition-transform"/> Export PDF
                    </button>
                </div>
            )}
            </header>

            {loading ? (
                <div className="p-20 text-center">
                <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6"></div>
                <p className="text-slate-500 font-medium">Retrieving database records...</p>
                </div>
            ) : data.length === 0 ? (
            <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-slate-200">
                <FileWarning className="mx-auto text-slate-300 mb-4" size={48} />
                <h3 className="text-xl font-bold text-slate-700">No Scan Data Found</h3>
                <p className="text-slate-500 mt-2">Select a domain from the left to view historical reports.</p>
            </div>
            ) : (
            <div className="space-y-8">
                
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-8">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><BarChart3 size={24} /></div>
                            <h2 className="text-xl font-bold text-slate-900">Health Score Breakdown</h2>
                        </div>
                    </div>
                    <div className="p-8 h-80 overflow-x-auto">
                        <div className="flex items-end justify-between gap-6 h-full min-w-[600px]"> 
                            {graphMetrics.map((metric, i) => (
                                <div key={i} className="flex flex-col items-center justify-end h-full w-full gap-3 group">
                                    <div className="w-full flex-1 flex items-end justify-center relative pb-2">
                                        <div 
                                            className="w-12 md:w-16 rounded-t-lg relative group-hover:opacity-90 shadow-md transition-all duration-[1500ms] ease-out"
                                            style={{ height: animateBars ? `${Math.max(metric.score, 5)}%` : '0%', backgroundColor: metric.color }} 
                                        >
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">{metric.score}/100</div>
                                        </div>
                                    </div>
                                    <div className="text-center z-10 h-12 flex flex-col justify-start">
                                        <div className="text-3xl font-black text-slate-900 leading-none">{metric.score}</div>
                                        <div className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wide mt-2">{metric.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {sections.map((section, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${section.bg}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${section.color.replace('text-', 'bg-').replace('600', '100').replace('700', '100')} ${section.color}`}>
                            {/* @ts-ignore */}
                            <section.icon size={20} />
                        </div>
                        <div>
                            <h2 className={`font-bold text-lg ${section.color}`}>{section.title}</h2>
                            <p className="text-sm text-slate-600">{section.desc}</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white ${section.color} border border-current opacity-80`}>
                        {section.items.length} Issues
                    </span>
                    </div>
                    
                    {section.items.length > 0 ? (
                    <>
                        {/* @ts-ignore */}
                        {section.layoutType === 'table' ? (
                            <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar relative">
                                <table className="min-w-[1200px] w-full text-left text-sm border-collapse table-fixed">
                                    <thead className="bg-slate-50/90 backdrop-blur text-slate-500 font-bold uppercase text-xs border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-4 w-[15%]">URL</th>
                                            <th className="p-4 w-[8%]">Status</th>
                                            {/* @ts-ignore */}
                                            <th className="p-4 w-[42%]">{section.contentType === 'title' ? 'Page Title' : 'Meta Description'}</th>
                                            <th className="p-4 w-[5%] text-center">Length</th>
                                            <th className="p-4 w-[30%]">Fix Suggestion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {section.items.map((page, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-1 p-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold shrink-0">HTML</div>
                                                        <div className="min-w-0 w-full">
                                                            <a href={page.url} target="_blank" className="font-bold text-blue-600 hover:underline block mb-1 truncate">
                                                                {/* @ts-ignore */}
                                                                {section.contentType === 'title' ? (page.data?.title || "No Title") : "View Source"}
                                                            </a>
                                                            <div className="text-xs text-slate-400 truncate">{page.url}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">{page.status || 200} OK</span>
                                                </td>
                                                <td className="p-4 align-top text-slate-600 text-xs leading-relaxed">
                                                    {/* @ts-ignore */}
                                                    {section.contentType === 'title' ? <div className="line-clamp-2">{page.data?.title}</div> : <div className="line-clamp-3">{page.data?.desc || "Missing"}</div>}
                                                </td>
                                                <td className="p-4 align-top font-mono text-xs font-bold text-slate-500 text-center">
                                                    {/* @ts-ignore */}
                                                    {section.contentType === 'title' ? page.data?.title?.length || 0 : page.data?.desc?.length || 0}
                                                </td>
                                                <td className="p-4 align-top">
                                                    <input type="text" placeholder="Draft fix..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-50 max-h-80 overflow-y-auto custom-scrollbar">
                            {section.items.map((page, idx) => (
                                <li key={idx} className="p-4 hover:bg-slate-50 transition-colors flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                                        <a href={page.url} target="_blank" className="text-sm font-semibold text-slate-800 truncate hover:text-blue-600 hover:underline max-w-[70%]">
                                            {page.url}
                                        </a>
                                        {/* @ts-ignore */}
                                        {section.showValue && (
                                            <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                {/* @ts-ignore */}
                                                {section.showValue(page)}
                                            </span>
                                        )}
                                    </div>
                                    <a href={page.url} target="_blank" className="text-slate-400 hover:text-blue-600 ml-2"><ExternalLink size={16} /></a>
                                </div>
                                
                                {/* RENDER CUSTOM DETAILS */}
                                {/* @ts-ignore */}
                                {section.renderDetail && section.renderDetail(page)}
                                </li>
                            ))}
                            </ul>
                        )}
                    </>
                    ) : (
                    <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50/50">
                        <CheckCircle className="inline-block mr-2 text-emerald-500" size={12}/> No violations found.
                    </div>
                    )}
                </div>
                ))}

            </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <IssuesContent />
    </Suspense>
  );
}