'use client';
import { useState, useEffect } from 'react';
import SerpCompetitors from '@/components/SerpCompetitors';
import { 
  Folder, FolderOpen, Download, Database, LayoutDashboard, 
  Search, BarChart2, Activity, DollarSign, MousePointerClick, X,
  MessageCircle, Link2, Target, List, Grid, Sparkles, Tag
} from 'lucide-react';

interface ProjectItem {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intent: string;
  competitiveDensity: number;
  results: string;
  clickPotential: number;
  serpFeatures?: string; 
  trend?: string;        
  competitors?: string;  
}

interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  items: ProjectItem[];
}

// MATCH TYPE CLASSIFICATION ENGINE
const classifyMatch = (seed: string, current: string) => {
    const s = seed.toLowerCase().trim();
    const k = current.toLowerCase().trim();
    if (k === s) return `Exact`;
    if (k.includes(s)) return `Phrase`;
    const words = s.split(` `);
    if (words.every(w => k.includes(w))) return `Broad`;
    return `Related`;
};

export default function KeywordManager() {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(``);
  const [serpAnalysisKeyword, setSerpAnalysisKeyword] = useState<string | null>(null);

  const [magicFilter, setMagicFilter] = useState(`all`); 
  const [viewMode, setViewMode] = useState(`list`); 

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`/api/projects`);
      const data = await res.json();
      if (data.success && data.projects) {
        setProjects(data.projects);
        if (data.projects.length > 0) {
          setActiveProjectId(data.projects[0].id);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  const baseFilteredItems = activeProject?.items.filter(item => 
    item.keyword.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  let finalFilteredItems = baseFilteredItems;
  if (magicFilter === `questions`) {
      finalFilteredItems = baseFilteredItems.filter(item => /\b(how|what|why|when|where|who|is|are|can)\b/i.test(item.keyword));
  } else if (magicFilter === `prepositions`) {
      finalFilteredItems = baseFilteredItems.filter(item => /\b(for|to|with|without|near|by)\b/i.test(item.keyword));
  } else if (magicFilter === `transactional`) {
      finalFilteredItems = baseFilteredItems.filter(item => item.intent.includes(`Commercial`) || item.intent.includes(`Transactional`));
  }

  const topicClusters: Record<string, ProjectItem[]> = {};
  finalFilteredItems.forEach(item => {
      const rootWord = item.keyword.split(` `)[0] || `Other`;
      const clusterName = rootWord.charAt(0).toUpperCase() + rootWord.slice(1);
      if (!topicClusters[clusterName]) topicClusters[clusterName] = [];
      topicClusters[clusterName].push(item);
  });

  const parseDbArray = (str?: string, joinChar: string = ` | `) => {
    if (!str || str === `EMPTY` || str === `[]`) return ``;
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.join(joinChar);
      return str;
    } catch (e) {
      return str; 
    }
  };

  const handleExportProject = () => {
    if (!activeProject || finalFilteredItems.length === 0) return;
    
    // Exact SEMrush-style headers matching the Keyword Research tool including Match Types
    const headers = [
        `Database`, `Match Type`, `Keyword`, `Seed Keyword`, `Volume`, `Keyword Difficulty`, `CPC (USD)`, 
        `Competitive Density`, `Number of Results`, `Intent`, `SERP Features`, `Trend`, 
        `Click Potential`, `Competitors`
    ];
    
    let csvContent = headers.join(`,`) + `\n`;
    
    finalFilteredItems.forEach((item) => {
        const features = parseDbArray(item.serpFeatures, ` | `) || `Organic`;
        const trendData = parseDbArray(item.trend, `-`);
        const competitorsData = parseDbArray(item.competitors, ` | `);
        const calculatedMatch = classifyMatch(activeProject.name, item.keyword);

        const row = [
            `"Saved Project"`,
            `"${calculatedMatch}"`,
            `"${item.keyword}"`,
            `"${activeProject.name}"`, 
            item.volume || 0,
            item.difficulty || 0,
            item.cpc || 0,
            item.competitiveDensity || 0,
            `"${item.results || `0`}"`,
            `"${item.intent || `Unknown`}"`,
            `"${features}"`,
            `"${trendData}"`,
            item.clickPotential || 0,
            `"${competitorsData}"`
        ];
        csvContent += row.join(`,`) + `\n`;
    });
    
    const blob = new Blob([csvContent], { type: `text/csv;charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement(`a`);
    link.setAttribute(`href`, url);
    link.setAttribute(`download`, `${activeProject.name.replace(/\s+/g, `-`)}-campaign.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-[#F8FAFC]`}>
        <div className={`animate-pulse flex flex-col items-center gap-4`}>
           <Database size={40} className={`text-indigo-300`} />
           <p className={`text-slate-500 font-bold tracking-widest uppercase text-sm`}>Loading Campaigns</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans text-slate-900 bg-[#F8FAFC] pb-20 relative overflow-hidden`}>
      
      {serpAnalysisKeyword && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-10 overflow-y-auto custom-scrollbar`}>
            <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-6xl relative min-h-[600px] flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200`}>
                <div className={`p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-20 rounded-t-3xl shadow-sm`}>
                    <h2 className={`text-xl font-bold text-slate-800 flex items-center gap-3`}>
                        <div className={`p-2 bg-indigo-100 text-indigo-600 rounded-lg`}><Activity size={18} /></div>
                        SERP Analysis: <span className={`text-indigo-600`}>{serpAnalysisKeyword}</span>
                    </h2>
                    <button 
                        onClick={() => setSerpAnalysisKeyword(null)} 
                        className={`p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors`}
                    >
                        <X size={20}/>
                    </button>
                </div>
                <div className={`p-8 flex-1 bg-slate-50 rounded-b-3xl`}>
                    <SerpCompetitors keyword={serpAnalysisKeyword} market={`us`} />
                </div>
            </div>
        </div>
      )}

      <div className={`absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-200/20 to-purple-200/20 blur-[120px] animate-pulse`} style={{animationDuration: `8s`}} />
      <div className={`absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 blur-[100px] animate-pulse`} style={{animationDuration: `12s`}} />
      <div className={`absolute inset-0 bg-[url(https://grainy-gradients.vercel.app/noise.svg)] opacity-20`}></div>

      <div className={`max-w-[1500px] mx-auto px-6 pt-12 relative z-10`}>
        
        <div className={`mb-10 animate-in slide-in-from-top-4 fade-in duration-700`}>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-indigo-100 shadow-sm backdrop-blur-md mb-6`}>
                <Sparkles size={14} className={`text-indigo-600`} />
                <span className={`text-xs font-bold text-indigo-900 tracking-wide uppercase`}>Premium Campaign Manager</span>
            </div>
            <h1 className={`text-5xl font-extrabold text-slate-900 tracking-tight`}>Saved Projects</h1>
            <p className={`text-slate-500 text-lg mt-3 max-w-2xl`}>Organize export and deploy topic clusters from your highly curated keyword lists.</p>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-8`}>
            
            <div className={`lg:col-span-1 flex flex-col gap-6 animate-in slide-in-from-left-8 fade-in duration-700`}>
                
                <div className={`bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-slate-200/40 p-4`}>
                    <h3 className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2`}>Your Folders</h3>
                    <div className={`space-y-2`}>
                        {projects.length === 0 ? (
                            <p className={`text-sm text-slate-500 px-2`}>No projects saved yet.</p>
                        ) : (
                            projects.map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => setActiveProjectId(project.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                                        activeProjectId === project.id 
                                        ? `bg-indigo-600 text-white shadow-md shadow-indigo-200` 
                                        : `hover:bg-slate-100 text-slate-600`
                                    }`}
                                >
                                    <div className={`flex items-center gap-3`}>
                                        {activeProjectId === project.id ? <FolderOpen size={18} /> : <Folder size={18} />}
                                        <span className={`font-semibold text-sm truncate max-w-[120px]`}>{project.name}</span>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                        activeProjectId === project.id ? `bg-white/20 text-white` : `bg-slate-200 text-slate-500`
                                    }`}>
                                        {project.items.length}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {activeProject && (
                    <div className={`bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-slate-200/40 p-4`}>
                        <h3 className={`text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4 px-2 flex items-center gap-2`}>
                            <Sparkles size={14} /> Keyword Magic
                        </h3>
                        <div className={`space-y-2`}>
                            <button onClick={() => setMagicFilter(`all`)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm font-semibold ${magicFilter === `all` ? `bg-indigo-50 text-indigo-700` : `hover:bg-slate-50 text-slate-600`}`}>
                                <Database size={16} /> All Keywords
                            </button>
                            <button onClick={() => setMagicFilter(`questions`)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm font-semibold ${magicFilter === `questions` ? `bg-indigo-50 text-indigo-700` : `hover:bg-slate-50 text-slate-600`}`}>
                                <MessageCircle size={16} /> Questions
                            </button>
                            <button onClick={() => setMagicFilter(`prepositions`)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm font-semibold ${magicFilter === `prepositions` ? `bg-indigo-50 text-indigo-700` : `hover:bg-slate-50 text-slate-600`}`}>
                                <Link2 size={16} /> Prepositions
                            </button>
                            <button onClick={() => setMagicFilter(`transactional`)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm font-semibold ${magicFilter === `transactional` ? `bg-indigo-50 text-indigo-700` : `hover:bg-slate-50 text-slate-600`}`}>
                                <Target size={16} /> High Intent
                            </button>
                        </div>
                    </div>
                )}

            </div>

            <div className={`lg:col-span-4 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-150`}>
                {activeProject ? (
                    <div className={`bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col h-[800px]`}>
                        
                        <div className={`p-6 border-b border-slate-100 bg-white/40 flex flex-wrap gap-4 items-center justify-between`}>
                            <div className={`flex items-center gap-4`}>
                                <div className={`w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner`}>
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h2 className={`text-2xl font-bold text-slate-800`}>{activeProject.name}</h2>
                                    <p className={`text-sm font-medium text-slate-500`}>{finalFilteredItems.length} Curated Keywords</p>
                                </div>
                            </div>
                            
                            <div className={`flex items-center gap-3`}>
                                <div className={`flex bg-slate-100 p-1 rounded-xl mr-2`}>
                                    <button onClick={() => setViewMode(`list`)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === `list` ? `bg-white text-indigo-700 shadow-sm` : `text-slate-500 hover:text-slate-700`}`}>
                                        <List size={16} /> List
                                    </button>
                                    <button onClick={() => setViewMode(`clusters`)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === `clusters` ? `bg-white text-indigo-700 shadow-sm` : `text-slate-500 hover:text-slate-700`}`}>
                                        <Grid size={16} /> Clusters
                                    </button>
                                </div>

                                <div className={`relative`}>
                                    <input 
                                        type={`text`}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={`Search...`}
                                        className={`pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48 transition-all`}
                                    />
                                    <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400`} />
                                </div>
                                <button 
                                    onClick={handleExportProject}
                                    className={`flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95`}
                                >
                                    <Download size={16} /> Export
                                </button>
                            </div>
                        </div>

                        <div className={`flex-1 overflow-auto custom-scrollbar p-0 bg-slate-50/30`}>
                            
                            {viewMode === `list` && (
                                <table className={`w-full text-left border-collapse bg-transparent`}>
                                    <thead className={`sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-sm`}>
                                        <tr className={`text-xs font-bold text-slate-500 uppercase tracking-wider`}>
                                            <th className={`px-6 py-4`}>Target Keyword</th>
                                            <th className={`px-4 py-4`}>Match</th>
                                            <th className={`px-4 py-4`}>Intent</th>
                                            <th className={`px-4 py-4`}>Volume</th>
                                            <th className={`px-4 py-4`}>KD %</th>
                                            <th className={`px-4 py-4`}>CPC</th>
                                            <th className={`px-6 py-4 text-right`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y divide-slate-100`}>
                                        {finalFilteredItems.length > 0 ? (
                                            finalFilteredItems.map((item, i) => (
                                                <tr key={i} className={`hover:bg-white transition-colors group`}>
                                                    <td className={`px-6 py-4`}>
                                                        <div className={`font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors`}>{item.keyword}</div>
                                                    </td>
                                                    <td className={`px-4 py-4`}>
                                                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wide`}>
                                                            <Tag size={12} className={`text-indigo-400`} />
                                                            {classifyMatch(activeProject.name, item.keyword)}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-4`}>
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${
                                                            item.intent.includes(`Transactional`) ? `bg-emerald-50 text-emerald-700 border-emerald-100` :
                                                            item.intent.includes(`Commercial`) ? `bg-purple-50 text-purple-700 border-purple-100` :
                                                            item.intent.includes(`Informational`) ? `bg-blue-50 text-blue-700 border-blue-100` :
                                                            `bg-gray-50 text-gray-700 border-gray-200`
                                                        }`}>
                                                            {item.intent.split(` `)[0] || `Unknown`}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-4 text-sm text-slate-600 font-mono font-medium flex items-center gap-2`}>
                                                        <BarChart2 size={14} className={`text-blue-400`}/>
                                                        {item.volume.toLocaleString()}
                                                    </td>
                                                    <td className={`px-4 py-4`}>
                                                        <div className={`flex items-center gap-2`}>
                                                            <Activity size={14} className={item.difficulty > 60 ? `text-amber-500` : `text-emerald-500`}/>
                                                            <span className={`text-sm font-bold text-slate-600 font-mono`}>{item.difficulty}</span>
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-4 text-sm text-slate-600 font-mono flex items-center gap-1`}>
                                                        <DollarSign size={14} className={`text-emerald-500`}/>
                                                        {item.cpc.toFixed(2)}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right`}>
                                                        <button 
                                                            onClick={() => setSerpAnalysisKeyword(item.keyword)}
                                                            className={`text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95 border border-indigo-100 opacity-0 group-hover:opacity-100`}
                                                        >
                                                            VIEW SERP
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className={`py-32 text-center`}>
                                                    <div className={`flex flex-col items-center justify-center gap-3 text-slate-400`}>
                                                        <div className={`p-4 bg-slate-50 rounded-full mb-2`}>
                                                            <Search size={32} className={`text-slate-300`}/>
                                                        </div>
                                                        <span className={`text-lg font-bold text-slate-600`}>No keywords found</span>
                                                        <span className={`text-sm font-medium`}>Try clearing your magic filters.</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {viewMode === `clusters` && (
                                <div className={`p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`}>
                                    {Object.entries(topicClusters).map(([clusterName, items]) => {
                                        const totalVolume = items.reduce((sum, item) => sum + item.volume, 0);
                                        return (
                                            <div key={clusterName} className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow`}>
                                                <div className={`flex justify-between items-start mb-4 border-b border-slate-100 pb-4`}>
                                                    <div>
                                                        <h3 className={`font-bold text-slate-800 text-lg`}>{clusterName} Cluster</h3>
                                                        <p className={`text-xs text-slate-500 font-medium mt-1`}>{items.length} Keywords</p>
                                                    </div>
                                                    <div className={`text-right`}>
                                                        <span className={`text-xs font-bold text-slate-400 uppercase tracking-widest block`}>Volume</span>
                                                        <span className={`font-black text-indigo-600 font-mono`}>{totalVolume.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className={`space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2`}>
                                                    {items.map((item, idx) => (
                                                        <div key={idx} className={`flex justify-between items-center py-1`}>
                                                            <span className={`text-sm font-medium text-slate-700 truncate pr-4`}>{item.keyword}</span>
                                                            <span className={`text-xs text-slate-400 font-mono`}>{item.volume.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>
                    </div>
                ) : (
                    <div className={`bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 h-[700px] flex flex-col items-center justify-center p-10 text-center`}>
                        <div className={`w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6`}>
                            <FolderOpen size={40} className={`text-indigo-300`} />
                        </div>
                        <h2 className={`text-2xl font-bold text-slate-800 mb-2`}>Select a Project</h2>
                        <p className={`text-slate-500 max-w-md`}>Click on a folder in the sidebar to view your curated campaign keywords export data and analyze trends.</p>
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}