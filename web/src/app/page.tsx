'use client';

import Link from 'next/link';
import { motion, useInView, animate } from 'framer-motion';
import { 
  Search, BarChart2, FileText, Link as LinkIcon, 
  ArrowRight, Sparkles, LayoutDashboard, Rocket
} from 'lucide-react';
import { useEffect, useRef } from 'react';

// --- Animated Counter Component ---
function Counter({ from = 0, to, duration = 1.5 }: { from?: number, to: number, duration?: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  // once: true ensures it only animates the first time you see it
  const isInView = useInView(nodeRef, { once: true, margin: "-10px" });

  useEffect(() => {
    if (!isInView) return;
    
    const node = nodeRef.current;
    if (!node) return;

    const controls = animate(from, to, {
      duration: duration,
      ease: "easeOut",
      onUpdate(value) {
        node.textContent = Math.round(value).toString();
      }
    });

    return () => controls.stop();
  }, [from, to, duration, isInView]);

  return <span ref={nodeRef}>{from}</span>;
}

export default function Home() {
  // Simple, stable entry animations
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* --- BACKGROUND FX (Static & Clean) --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-100/80 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-100/80 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] bg-cyan-50/80 rounded-full blur-[80px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-soft-light"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-8 pt-12">
        
        {/* 1. HERO SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-16 text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-blue-600 mb-6 shadow-sm">
            <Sparkles size={12} />
            <span>SEO Intelligence Suite v2.0</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-slate-900 leading-tight">
            Master Your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Search Presence.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed font-medium max-w-2xl mx-auto">
            An enterprise-grade toolkit for technical audits, competitor intelligence, and keyword strategy—built for modern agencies.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all hover:scale-105 shadow-xl shadow-slate-200"
            >
              <LayoutDashboard size={20} />
              Open Dashboard
            </Link>
            <Link 
              href="/audit" 
              className="flex items-center gap-2 px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all hover:border-slate-300"
            >
              <Rocket size={20} className="text-blue-600" />
              Quick Audit
            </Link>
          </div>
        </motion.div>

        {/* 2. BENTO GRID TOOLS */}
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[240px]"
        >
          
          {/* CARD 1: SITE AUDIT (Large) */}
          <motion.div variants={item} className="md:col-span-2 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-200 to-red-200 rounded-3xl blur opacity-0 group-hover:opacity-50 transition duration-500"></div>
            <Link href="/audit" className="relative h-full bg-white border border-slate-100 rounded-3xl p-8 flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] transition-all duration-300 overflow-hidden">
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm mb-4">
                  <FileText size={24} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Technical Audit</h3>
                <p className="text-slate-500 max-w-md">Deep crawl your website to identify broken links, missing meta tags, and technical performance issues in real-time.</p>
              </div>
              
              <div className="flex items-center text-orange-600 font-bold group-hover:translate-x-2 transition-transform">
                Launch Crawler <ArrowRight size={18} className="ml-2" />
              </div>

              {/* Decorative Element */}
              <FileText className="absolute -bottom-8 -right-8 text-orange-50 w-64 h-64 rotate-[-15deg] group-hover:rotate-0 transition-transform duration-700" />
            </Link>
          </motion.div>

          {/* CARD 2: KEYWORD PLANNER */}
          <motion.div variants={item} className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-3xl blur opacity-0 group-hover:opacity-50 transition duration-500"></div>
            <Link href="/keyword-research" className="relative h-full bg-white border border-slate-100 rounded-3xl p-8 flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] transition-all duration-300">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm mb-4">
                  <Search size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Keyword Planner</h3>
                <p className="text-sm text-slate-500">Uncover high-volume opportunities and analyze difficulty.</p>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-4">
                 <div className="h-full bg-blue-500 w-2/3 shadow-sm"></div>
              </div>
            </Link>
          </motion.div>

          {/* CARD 3: COMPETITOR ANALYSIS */}
          <motion.div variants={item} className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-200 to-pink-200 rounded-3xl blur opacity-0 group-hover:opacity-50 transition duration-500"></div>
            <Link href="/competitor-analysis" className="relative h-full bg-white border border-slate-100 rounded-3xl p-8 flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] transition-all duration-300">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-100 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm mb-4">
                  <BarChart2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Competitor Spy</h3>
                <p className="text-sm text-slate-500">Reverse engineer traffic sources and organic strategies.</p>
              </div>
              <div className="flex items-end gap-1 h-8 mt-2 opacity-80">
                 {[40, 70, 45, 90, 60].map((h, i) => (
                    <div key={i} className="flex-1 bg-purple-500 rounded-t-sm" style={{ height: `${h}%` }}></div>
                 ))}
              </div>
            </Link>
          </motion.div>

          {/* CARD 4: BACKLINKS AUDITOR (Large) */}
          <motion.div variants={item} className="md:col-span-2 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-200 to-teal-200 rounded-3xl blur opacity-0 group-hover:opacity-50 transition duration-500"></div>
            <Link href="/backlink-auditor" className="relative h-full bg-white border border-slate-100 rounded-3xl p-8 flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] transition-all duration-300 overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0">
                  <LinkIcon size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Backlinks Auditor</h3>
                  <p className="text-slate-500">Monitor your backlink profile, identify toxic links, and track referring domains to maintain a healthy site authority.</p>
                </div>
              </div>
              
              <div className="flex items-center text-emerald-600 font-bold group-hover:translate-x-2 transition-transform mt-4">
                Analyze Profile <ArrowRight size={18} className="ml-2" />
              </div>
              
              <LinkIcon className="absolute -bottom-8 -right-8 text-emerald-50 w-64 h-64 rotate-[15deg] group-hover:rotate-0 transition-transform duration-700" />
            </Link>
          </motion.div>

        </motion.div>

        {/* 3. ACTIVE FOOTER STATS */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-white border border-slate-100 shadow-sm"
        >
           {/* Stat 1: Live Feed */}
           <div className="text-center border-r border-slate-100 last:border-0">
              <div className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Live
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-semibold">Data Feed</div>
           </div>

           {/* Stat 2: Monitoring (Counts to 24) */}
           <div className="text-center border-r border-slate-100 last:border-0">
              <div className="text-2xl font-bold text-blue-600">
                <Counter to={24} />/7
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-semibold">Monitoring</div>
           </div>

           {/* Stat 3: Uptime (Counts to 100) */}
           <div className="text-center border-r border-slate-100 last:border-0">
              <div className="text-2xl font-bold text-purple-600">
                <Counter to={100} />%
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-semibold">Uptime</div>
           </div>

           {/* Stat 4: Status (Static) */}
           <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">Pro</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-semibold">Status</div>
           </div>
        </motion.div>

      </div>
    </div>
  );
}