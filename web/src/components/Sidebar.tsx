'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Search, BarChart2, Link as LinkIcon, 
  FileText, Settings, ChevronRight, ChevronLeft, Home, 
  AlertTriangle, Folder 
} from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Home', icon: Home, path: '/' },
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Keyword Planner', icon: Search, path: '/keyword-research' },
  { name: 'Projects', icon: Folder, path: '/projects' },
  { name: 'Competitor Analysis', icon: BarChart2, path: '/competitor-analysis' },
  { name: 'Backlinks Auditor', icon: LinkIcon, path: '/backlink-auditor' },
  { name: 'Site Auditor', icon: FileText, path: '/audit' }, 
  { name: 'All Issues', icon: AlertTriangle, path: '/issues' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [issueCount, setIssueCount] = useState(0);

  useEffect(() => {
    const calculateIssues = () => {
      const saved = localStorage.getItem('latestAudit');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // FIX: Handle both raw array and { results: [...] } format
          const data = Array.isArray(parsed) ? parsed : (parsed.results || []);

          if (!Array.isArray(data)) return;

          let totalIssues = 0;
          data.forEach((p: any) => {
              // FIX: Safe access with fallbacks (?. and || {})
              const issues = p.issues || {};
              const dataObj = p.data || {};
              const mobile = p.mobile || {};

              // 1. Critical
              if (issues.is404) totalIssues++;
              if (issues.isRedirect) totalIssues++;
              if (issues.notSecure) totalIssues++;
              if ((dataObj.internal || 0) === 0) totalIssues++;

              // 2. Meta
              if (!dataObj.title) totalIssues++; 
              else if (dataObj.title.length < 50 || dataObj.title.length > 60) totalIssues++;
              
              if (dataObj.desc && (dataObj.desc.length < 150 || dataObj.desc.length > 160)) totalIssues++;
              
              // 3. Performance
              if ((mobile.lcp || 0) > 2500) totalIssues++;
              if (issues.largeImgIssue) totalIssues++;
          });

          setIssueCount(totalIssues);
        } catch (e) {
          console.error("Sidebar Issue Sync Error", e);
        }
      }
    };

    calculateIssues();
    window.addEventListener('storage', calculateIssues);
    window.addEventListener('local-storage', calculateIssues);
    return () => {
        window.removeEventListener('storage', calculateIssues);
        window.removeEventListener('local-storage', calculateIssues);
    };
  }, []);

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-200 transition-all duration-300 z-50 flex flex-col ${
        isExpanded ? 'w-64 shadow-2xl' : 'w-20'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="h-20 flex items-center border-b border-slate-100 overflow-hidden">
        <div className="w-20 h-full flex items-center justify-center flex-shrink-0">
          <Link href="/" className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-blue-200 shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
            S
          </Link>
        </div>
        <div className={`whitespace-nowrap transition-all duration-300 flex-1 ${
          isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
        }`}>
          <span className="text-lg font-bold text-slate-800 tracking-tight">SEO Auditor</span>
        </div>
      </div>

      <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const isIssuesPage = item.path === '/issues';

          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center h-12 rounded-xl transition-all duration-200 group relative ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="w-14 h-full flex items-center justify-center flex-shrink-0 relative">
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {isIssuesPage && issueCount > 0 && (
                  <div className={`absolute top-2 right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm transform transition-transform ${
                    !isExpanded ? 'scale-100' : 'scale-0'
                  }`}>
                    {issueCount > 99 ? '99+' : issueCount}
                  </div>
                )}
              </div>
              <span className={`whitespace-nowrap font-medium text-sm transition-all duration-300 flex items-center justify-between flex-1 pr-3 ${
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 overflow-hidden w-0'
              }`}>
                {item.name}
                {isIssuesPage && issueCount > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{issueCount}</span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}