'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  // LOGIC UPDATE: We removed "pathname === '/'" from this check.
  // Now, only '/login' is considered a public page without a sidebar.
  const isPublicPage = pathname === '/login';

  // SCENARIO 1: Public Pages (Login only) -> Full Width, No Sidebar
  if (isPublicPage) {
    return (
      <main className="w-full min-h-screen bg-[#110b29]">
        {children}
      </main>
    );
  }

  // SCENARIO 2: App Dashboard (Including Home '/') -> Show Sidebar
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <div className="flex-shrink-0 z-50">
        {/* The Sidebar component manages its own hover state, but props are passed for compatibility */}
        <Sidebar />
      </div>

      {/* The margin-left (ml-20) ensures your Home Page content isn't covered 
         by the fixed sidebar on the left edge. 
      */}
      <main 
        className={`flex-1 p-0 md:p-0 overflow-x-hidden transition-all duration-300 ease-in-out md:ml-20`}
      >
        {children}
      </main>
    </div>
  );
}