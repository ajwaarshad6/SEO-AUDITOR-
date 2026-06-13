'use client';
import SerpCompetitors from '@/components/SerpCompetitors';
import { exportSemrushStyleCSV } from '@/lib/exportUtils';
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, BarChart2, Sparkles, TrendingUp, DollarSign, 
  Activity, Download, Database, ChevronDown, Check, Globe, 
  ArrowRight, Zap, Filter, X, Loader2, FolderPlus, Save, AlertCircle,
  MousePointerClick, ArrowUpDown, Tag
} from 'lucide-react';

interface EnrichedKeyword {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition_index: number; 
  competitive_density: number; 
  intent: string; 
  opportunity_score: number; 
  cluster?: string; 
  results?: number; 
  click_potential?: number; 
  competitors?: string[];
  serp_features?: string[];
  trend?: number[]; 
  match_type?: string;
}

interface KeywordData {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition_index: number;
  intent: string;
  results: EnrichedKeyword[];
  history?: { month: string; volume: number }[]; 
}

interface SuggestionItem {
    keyword: string;
}

const REGIONS = [
    { id: `global`, label: `Global Market`, code: `INT`, currency: `USD` },
    { id: `us`, label: `United States`, code: `US`, currency: `USD` },
    { id: `gb`, label: `United Kingdom`, code: `GB`, currency: `GBP` },
    { id: `pk`, label: `Pakistan`, code: `PK`, currency: `PKR` },
    { id: `ca`, label: `Canada`, code: `CA`, currency: `CAD` },
    { id: `au`, label: `Australia`, code: `AU`, currency: `AUD` },
    { id: `in`, label: `India`, code: `IN`, currency: `INR` },
    { id: `ae`, label: `UAE`, code: `AE`, currency: `AED` },
    { id: `de`, label: `Germany`, code: `DE`, currency: `EUR` },
    { id: `fr`, label: `France`, code: `FR`, currency: `EUR` },
    { id: `br`, label: `Brazil`, code: `BR`, currency: `BRL` },
    { id: `mx`, label: `Mexico`, code: `MX`, currency: `MXN` },
    { id: `jp`, label: `Japan`, code: `JP`, currency: `JPY` },
    { id: `tr`, label: `Turkey`, code: `TR`, currency: `TRY` },
    { id: `sa`, label: `Saudi Arabia`, code: `SA`, currency: `SAR` },
    { id: `eg`, label: `Egypt`, code: `EG`, currency: `EGP` },
    { id: `ng`, label: `Nigeria`, code: `NG`, currency: `NGN` },
    { id: `za`, label: `South Africa`, code: `ZA`, currency: `ZAR` }
];

// MATCH TYPE CLASSIFICATION ENGINE
const classifyMatchType = (seed: string, current: string) => {
    const s = seed.toLowerCase().trim();
    const k = current.toLowerCase().trim();
    if (k === s) return `Exact`;
    if (k.includes(s)) return `Phrase`;
    const words = s.split(` `);
    if (words.every(w => k.includes(w))) return `Broad`;
    return `Related`;
};

export default function KeywordResearch() {
  const [keyword, setKeyword] = useState(``);
  const [database, setDatabase] = useState(`us`); 
  const [researchData, setResearchData] = useState<KeywordData | null>(null);
  const [magicData, setMagicData] = useState<EnrichedKeyword[]>([]); 
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [includeText, setIncludeText] = useState(``);
  const [excludeText, setExcludeText] = useState(``);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [itemToSave, setItemToSave] = useState<EnrichedKeyword | null>(null);
  const [projectName, setProjectName] = useState(`Keyword Research`);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener(`mousedown`, handleClickOutside);
    return () => document.removeEventListener(`mousedown`, handleClickOutside);
  }, []);

  useEffect(() => {
    if (researchData) {
        setShowGraph(false);
        const timer = setTimeout(() => setShowGraph(true), 100);
        return () => clearTimeout(timer);
    }
  }, [researchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (keyword.length > 2 && !loadingResearch) {
            fetchSuggestions(keyword);
        } else {
            setSuggestions([]);
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, loadingResearch]);

  const sortedAndFilteredData = useMemo(() => {
      let result = magicData.filter(item => {
          if (includeText && !item.keyword.toLowerCase().includes(includeText.toLowerCase())) return false;
          if (excludeText && item.keyword.toLowerCase().includes(excludeText.toLowerCase())) return false;
          return true;
      });

      if (sortConfig !== null) {
          result.sort((a, b) => {
              const aValue = a[sortConfig.key as keyof EnrichedKeyword] ?? 0;
              const bValue = b[sortConfig.key as keyof EnrichedKeyword] ?? 0;
              if (aValue < bValue) return sortConfig.direction === `asc` ? -1 : 1;
              if (aValue > bValue) return sortConfig.direction === `asc` ? 1 : -1;
              return 0;
          });
      }
      return result;
  }, [magicData, includeText, excludeText, sortConfig]);

  const requestSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'desc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === `desc`) {
          direction = `asc`;
      }
      setSortConfig({ key, direction });
  };

  const fetchSuggestions = async (query: string) => {
    try {
        const res = await fetch(`/api/google-suggest`, {
            method: `POST`,
            headers: { Accept: `application/json`, [`Content-Type`]: `application/json` },
            body: JSON.stringify({ keyword: query }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = data.tasks?.[0]?.result?.[0]?.items || [];
        setSuggestions(items);
        if (items.length > 0) setShowSuggestions(true);
    } catch (err) { console.error(err); }
  };

  const handleSearch = async (e?: React.FormEvent, overrideKeyword?: string) => {
    if (e) e.preventDefault();
    const searchTerm = overrideKeyword || keyword;
    if (!searchTerm) return;

    if (overrideKeyword) setKeyword(overrideKeyword);
    setShowSuggestions(false);
    setIsDropdownOpen(false); 
    setResearchData(null);
    setMagicData([]);
    setSelectedKeywords(new Set());
    setSortConfig(null);
    
    setLoadingResearch(true);

    try {
        // RECURSIVE GOOGLE SUGGEST SCRAPER (ALPHABET SOUP METHOD)
        let keywordsToAnalyze = [searchTerm];
        const uniqueTracker = new Set<string>([searchTerm.toLowerCase()]);
        const alphabets = [``, `a`, `b`, `c`, `d`, `e`, `f`]; // Limited passes to prevent crashing your browser with massive loops
        
        for (const letter of alphabets) {
            if (keywordsToAnalyze.length >= 25) break; 
            const query = letter ? `${searchTerm} ${letter}` : searchTerm;
            try {
                const suggestRes = await fetch(`/api/google-suggest`, {
                    method: `POST`,
                    headers: { Accept: `application/json`, [`Content-Type`]: `application/json` },
                    body: JSON.stringify({ keyword: query }),
                });
                
                if (suggestRes.ok) {
                    const suggestData = await suggestRes.json();
                    const items = suggestData.tasks?.[0]?.result?.[0]?.items || [];
                    
                    for (const item of items) {
                        const cleanKw = item.keyword.toLowerCase().trim();
                        if (!uniqueTracker.has(cleanKw) && keywordsToAnalyze.length < 25) {
                            uniqueTracker.add(cleanKw);
                            keywordsToAnalyze.push(cleanKw);
                        }
                    }
                }
            } catch (suggestErr) {
                console.error(`Failed recursive fetch`, suggestErr);
            }
        }

        let liveTableData: EnrichedKeyword[] = [];

        for (let i = 0; i < keywordsToAnalyze.length; i++) {
            const currentKw = keywordsToAnalyze[i];
            
            try {
                const res = await fetch(`/api/serp`, {
                    method: `POST`,
                    headers: { Accept: `application/json`, [`Content-Type`]: `application/json` },
                    body: JSON.stringify({ keyword: currentKw, market: database })
                });
                
                const responseData = await res.json();
                
                if (responseData.success && responseData.data) {
                    const apiData = responseData.data;

                    const calculatedClickRate = Math.max(0.05, (0.45 - (apiData.competition_index / 250)));
                    const dynamicClickPotential = Math.round(apiData.search_volume * calculatedClickRate);
                    
                    const scoreBase = (100 - apiData.competition_index) * 0.5;
                    const scoreVol = (Math.min(apiData.search_volume, 50000) / 50000) * 30;
                    const scoreCpc = (Math.min(apiData.cpc, 10) / 10) * 20;
                    const dynamicOppScore = Math.min(100, Math.round(scoreBase + scoreVol + scoreCpc));

                    const dynamicCluster = apiData.keyword.split(` `)[0] || `Core`;

                    const mappedItem: EnrichedKeyword = {
                        keyword: apiData.keyword,
                        search_volume: apiData.search_volume,
                        cpc: apiData.cpc,
                        competition_index: apiData.competition_index,
                        competitive_density: apiData.competition_index / 100,
                        intent: apiData.intent,
                        opportunity_score: dynamicOppScore,
                        cluster: dynamicCluster,
                        results: apiData.detailed_results?.length || 0,
                        click_potential: dynamicClickPotential,
                        competitors: apiData.urls?.slice(0, 3) || [],
                        serp_features: apiData.serp_features || [`Organic`],
                        trend: [100, 120, 110, 140, 130, 160],
                        match_type: classifyMatchType(searchTerm, apiData.keyword) 
                    };

                    liveTableData.push(mappedItem);
                    setMagicData([...liveTableData]);

                    if (i === 0) {
                        setResearchData({
                            keyword: apiData.keyword,
                            search_volume: apiData.search_volume,
                            cpc: apiData.cpc,
                            competition_index: apiData.competition_index,
                            intent: apiData.intent,
                            results: [...liveTableData]
                        });
                    } else {
                        setResearchData(prev => prev ? { ...prev, results: [...liveTableData] } : null);
                    }
                }
            } catch (serpErr) {
                console.error(`Failed heavy SERP scrape for ${currentKw}`, serpErr);
            }
        }
    } catch (err) {
        console.error(`Search Error:`, err);
        alert(`Failed to complete mass analysis. Check your backend connection.`);
    } finally {
        setLoadingResearch(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
      handleSearch(undefined, suggestion);
  };

  const toggleSelectAll = () => {
      if (selectedKeywords.size === sortedAndFilteredData.length && sortedAndFilteredData.length > 0) {
          setSelectedKeywords(new Set());
      } else {
          const next = new Set(sortedAndFilteredData.map(i => i.keyword));
          setSelectedKeywords(next);
      }
  };

  const toggleSelection = (itemKeyword: string) => {
      const next = new Set(selectedKeywords);
      if (next.has(itemKeyword)) next.delete(itemKeyword);
      else next.add(itemKeyword);
      setSelectedKeywords(next);
  };

  const openSaveModal = (item: EnrichedKeyword) => {
      setItemToSave(item);
      setIsSaveModalOpen(true);
  };

  const confirmSave = async () => {
    if (!itemToSave) return;
    setIsSaving(true);

    try {
      const payload = {
        keyword: itemToSave.keyword,
        volume: itemToSave.search_volume,
        difficulty: itemToSave.competition_index,
        cpc: itemToSave.cpc,
        intent: itemToSave.intent,
        competitiveDensity: itemToSave.competitive_density,
        results: itemToSave.results?.toString() || `0`,
        serpFeatures: Array.isArray(itemToSave.serp_features) ? JSON.stringify(itemToSave.serp_features) : JSON.stringify([`Organic`]),
        trend: Array.isArray(itemToSave.trend) ? JSON.stringify(itemToSave.trend) : `[]`,
        clickPotential: itemToSave.click_potential,
        competitors: Array.isArray(itemToSave.competitors) ? JSON.stringify(itemToSave.competitors) : `[]`
      };

      const res = await fetch(`/api/projects/add-item`, {
        method: `POST`,
        headers: { Accept: `application/json`, [`Content-Type`]: `application/json` },
        body: JSON.stringify({
          projectName: projectName,
          keywordData: payload
        })
      });

      if (res.ok) {
        setIsSaveModalOpen(false);
        alert(`Saved ${payload.keyword} to project ${projectName}`);
      }
    } catch (e) {
      console.error(`Save Error`, e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!keyword || sortedAndFilteredData.length === 0) {
        alert(`Please perform a search first.`);
        return;
    }
    const currentRegionLabel = REGIONS.find(r => r.id === database)?.label || `Global`;
    const dataToExport = selectedKeywords.size > 0 
        ? sortedAndFilteredData.filter(item => selectedKeywords.has(item.keyword))
        : sortedAndFilteredData;
        
    const headers = [
      `Database`, `Match Type`, `Keyword`, `Seed Keyword`, `Volume`, `Keyword Difficulty`, `CPC (USD)`, 
      `Competitive Density`, `Number of Results`, `Intent`, `SERP Features`, `Trend`, 
      `Click Potential`, `Competitors`
    ];
    
    let csvContent = headers.join(`,`) + `\n`;

    dataToExport.forEach(row => {
      const features = Array.isArray(row.serp_features) ? row.serp_features.join(` | `) : `Organic`;
      const trendData = Array.isArray(row.trend) ? row.trend.join(`-`) : ``;
      const competitorsData = Array.isArray(row.competitors) ? row.competitors.join(` | `) : ``;
      
      const rowData = [
        `"${currentRegionLabel}"`,
        `"${row.match_type || `Related`}"`,
        `"${row.keyword || ``}"`,
        `"${keyword || ``}"`,
        row.search_volume || 0,
        row.competition_index || 0,
        (row.cpc || 0).toFixed(2),
        (row.competitive_density || 0).toFixed(2),
        row.results || 0,
        `"${row.intent || `Unknown`}"`,
        `"${features}"`,
        `"${trendData}"`,
        row.click_potential || 0,
        `"${competitorsData}"`
      ];
      csvContent += rowData.join(`,`) + `\n`;
    });

    const blob = new Blob([csvContent], { type: `text/csv;charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement(`a`);
    link.setAttribute(`href`, url);
    link.setAttribute(`download`, `${keyword.replace(/\s+/g, `-`)}-comprehensive-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isLoading = loadingResearch;
  const currentRegion = REGIONS.find(r => r.id === database) || REGIONS[0];
  const topStat = researchData?.results?.[0]; 

  if (!mounted) return null;

  return (
    <div className={`min-h-screen font-sans text-slate-900 pb-20 relative overflow-x-hidden selection:bg-indigo-500/20 selection:text-indigo-800`}>
      
      {isSaveModalOpen && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4`}>
            <div className={`bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 animate-in fade-in zoom-in-95 duration-200`}>
                <h3 className={`text-lg font-bold text-slate-900 mb-2 flex items-center gap-2`}>
                    <FolderPlus size={20} className={`text-indigo-600`}/> Save Keyword
                </h3>
                <p className={`text-sm text-slate-500 mb-6`}>
                    Add <strong className={`text-slate-800`}>{itemToSave?.keyword}</strong> to a project list.
                </p>
                <div className={`space-y-4`}>
                    <div>
                        <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2`}>Project Name</label>
                        <input 
                            type={`text`} 
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className={`w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium`}
                        />
                    </div>
                    <div className={`flex gap-3 pt-2`}>
                        <button 
                            onClick={() => setIsSaveModalOpen(false)}
                            className={`flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors`}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmSave}
                            disabled={isSaving}
                            className={`flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-70 flex items-center justify-center gap-2`}
                        >
                            {isSaving ? <Loader2 className={`animate-spin`} size={18}/> : <Save size={18}/>}
                            {isSaving ? `Saving...` : `Save Keyword`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className={`fixed inset-0 z-0 bg-[#F8FAFC]`}>
         <div className={`absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-200/20 to-purple-200/20 blur-[120px] animate-pulse`} style={{animationDuration: `8s`}} />
         <div className={`absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 blur-[100px] animate-pulse`} style={{animationDuration: `12s`}} />
         <div className={`absolute inset-0 bg-[url(https://grainy-gradients.vercel.app/noise.svg)] opacity-20`}></div>
      </div>

      <div className={`max-w-7xl mx-auto px-6 pt-12 relative z-10 space-y-12`}>
        
        <div className={`flex flex-col items-center text-center gap-6 animate-in slide-in-from-top-4 fade-in duration-700`}>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-indigo-100 shadow-sm backdrop-blur-md`}>
                <span className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 bg-indigo-500`}></span>
                </span>
                <span className={`text-xs font-bold text-indigo-900 tracking-wide uppercase`}>AI Research Engine v2.0</span>
            </div>
            <div className={`space-y-4 max-w-3xl`}>
                <h1 className={`text-6xl font-extrabold text-slate-900 tracking-tight leading-tight`}>
                    Uncover <span className={`text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-300% animate-gradient`}>Hidden Keywords</span>
                </h1>
                <p className={`text-slate-500 text-lg leading-relaxed max-w-2xl mx-auto flex items-center justify-center gap-2`}>
                    Professional SEO intelligence for the 
                    <span className={`font-semibold text-slate-800 inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm`}>
                          {currentRegion.id === `global` ? (
                                <Globe className={`w-4 h-4 text-indigo-600`} />
                        ) : (
                            <img 
                                src={`https://flagcdn.com/w40/${currentRegion.code.toLowerCase()}.png`}
                                alt={currentRegion.label}
                                className={`w-4 h-3 object-cover rounded-[2px]`}
                            />
                        )}
                        {currentRegion.label}
                    </span> 
                    market.
                </p>
            </div>
        </div>

        <div className={`max-w-4xl mx-auto group relative z-50 animate-in fade-in zoom-in-95 duration-700 delay-150`} ref={searchContainerRef}>
            <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-focus-within:opacity-50 group-focus-within:duration-200`} />
            <div className={`relative bg-white/90 backdrop-blur-xl p-2 rounded-2xl border border-white/50 shadow-2xl shadow-indigo-500/10 flex gap-0 ring-1 ring-slate-200/50`}>
                <div className={`relative border-r border-slate-200 pr-2 mr-2`} ref={dropdownRef}>
                    <button
                        type={`button`}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`h-full flex items-center gap-3 px-4 rounded-xl transition-all duration-200 hover:bg-slate-50 outline-none min-w-[160px] ${isDropdownOpen ? `bg-slate-50` : ``}`}
                    >
                        <div className={`w-10 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shadow-inner ring-1 ring-slate-200 flex-shrink-0`}>
                            {currentRegion.id === `global` ? (
                                <Globe className={`w-5 h-5 text-indigo-600`} />
                            ) : (
                                <img 
                                    src={`https://flagcdn.com/w80/${currentRegion.code.toLowerCase()}.png`}
                                    alt={currentRegion.label}
                                    className={`w-full h-full object-cover`}
                                />
                            )}
                        </div>
                        <div className={`flex flex-col items-start overflow-hidden text-left`}>
                            <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight`}>Market</span>
                            <span className={`text-sm font-bold text-slate-800 truncate w-24 block`}>{currentRegion.code}</span>
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 ml-auto transition-transform duration-300 ${isDropdownOpen ? `rotate-180` : ``}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className={`absolute top-full left-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[60] overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col`}>
                            <div className={`px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0`}>
                                <span className={`text-xs font-bold text-slate-500 uppercase tracking-widest`}>Select Database</span>
                            </div>
                            <div className={`p-2 space-y-1 overflow-y-auto max-h-80 custom-scrollbar`}>
                                {REGIONS.map((region) => (
                                    <button
                                        key={region.id}
                                        onClick={() => { setDatabase(region.id); setIsDropdownOpen(false); }}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
                                            database === region.id ? `bg-indigo-50 ring-1 ring-indigo-100` : `hover:bg-slate-50`
                                        }`}
                                    >
                                        <div className={`flex items-center gap-4`}>
                                            <div className={`w-8 h-6 rounded overflow-hidden shadow-sm border border-slate-100 flex items-center justify-center bg-white flex-shrink-0`}>
                                                {region.id === `global` ? <Globe className={`w-4 h-4 text-indigo-600`} /> : <img src={`https://flagcdn.com/w80/${region.code.toLowerCase()}.png`} className={`w-full h-full object-cover`} />}
                                            </div>
                                            <div className={`flex flex-col items-start text-left`}>
                                                <span className={`font-semibold text-sm ${database === region.id ? `text-indigo-900` : `text-slate-700`}`}>{region.label}</span>
                                                <span className={`text-[10px] text-slate-400 font-medium`}>Currency: {region.currency}</span>
                                            </div>
                                        </div>
                                        {database === region.id && <Check size={16} className={`text-indigo-600`} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSearch} className={`flex-1 flex gap-2 relative z-10`}>
                    <div className={`relative flex-1 group/input`}>
                        <input 
                            type={`text`} 
                            value={keyword} 
                            onChange={(e) => {
                                setKeyword(e.target.value);
                                if(e.target.value.length === 0) setShowSuggestions(false);
                            }}
                            onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
                            placeholder={`Type a seed keyword...`} 
                            className={`w-full h-full bg-transparent text-slate-900 px-4 outline-none text-xl font-medium placeholder:text-slate-300`}
                            autoComplete={`off`}
                        />
                    </div>
                    <button 
                        type={`submit`} 
                        disabled={isLoading}
                        className={`bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-10 rounded-xl transition-all shadow-lg flex items-center gap-3 disabled:opacity-70`}
                    >
                        {isLoading ? (
                            <div className={`flex items-center gap-2`}><Loader2 className={`animate-spin`} size={18} /> Scraping...</div>
                        ) : (
                            <>Analyze <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>

                {showSuggestions && suggestions.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-4 bg-white/80 backdrop-blur-2xl rounded-2xl border border-white/50 ring-1 ring-slate-200/50 shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2`}>
                        <div className={`px-5 py-3 border-b border-slate-100/50 flex items-center justify-between bg-white/50`}>
                            <span className={`text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2`}>
                                <Sparkles size={12} className={`text-purple-500`} /> AI Suggestions
                            </span>
                        </div>
                        <div className={`p-2`}>
                             {suggestions.slice(0, 5).map((item, index) => (
                                <button key={index} onClick={() => handleSuggestionClick(item.keyword)} className={`w-full text-left px-4 py-3.5 hover:bg-white hover:shadow-sm rounded-xl transition-all flex items-center gap-4 text-slate-700 group`}>
                                    <div className={`p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors`}>
                                        <Search size={16} />
                                    </div>
                                    <span className={`font-medium text-lg group-hover:text-slate-900`}>{item.keyword}</span>
                                </button>
                             ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {researchData && (
          <div className={`space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700`}>
              
              <div className={`flex flex-col gap-4 p-1`}>
                <div className={`flex items-center justify-between`}>
                    <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/60 border border-white/60 shadow-sm backdrop-blur-md`}>
                        <Database className={`text-indigo-600`} size={18} />
                        <span className={`font-bold text-slate-700 uppercase tracking-wide text-sm`}>{currentRegion.label} Database</span>
                        <span className={`text-slate-300`}>|</span>
                        <span className={`text-slate-500 text-sm`}>Target: <strong className={`text-indigo-700 font-semibold`}>{researchData.keyword}</strong></span>
                    </div>

                    <div className={`flex gap-2`}>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`group relative inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg font-semibold shadow-sm transition-all ${
                                showFilters || includeText || excludeText 
                                ? `bg-indigo-50 border-indigo-200 text-indigo-700` 
                                : `bg-white border-slate-200 text-slate-700 hover:text-indigo-600`
                            }`}
                        >
                            <Filter size={18} />
                            <span>Filters</span>
                        </button>

                        <button onClick={handleExport} disabled={isLoading} className={`group relative inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 border border-transparent rounded-lg font-semibold text-white hover:bg-slate-800 shadow-sm hover:shadow-md transition-all`}>
                            <Download size={18} className={`group-hover:-translate-y-0.5 transition-transform`} />
                            <span>
                                {selectedKeywords.size > 0 ? `Export Selected (${selectedKeywords.size})` : `Export All`}
                            </span>
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className={`animate-in slide-in-from-top-2 fade-in duration-200 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4`}>
                        <div className={`flex items-center gap-2 flex-1 min-w-[200px]`}>
                            <span className={`text-xs font-bold text-slate-500 uppercase`}>Include:</span>
                            <div className={`relative flex-1`}>
                                <input 
                                    type={`text`} 
                                    value={includeText}
                                    onChange={(e) => setIncludeText(e.target.value)}
                                    placeholder={`e.g. best, cheap`}
                                    className={`w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none`}
                                />
                                {includeText && <button onClick={() => setIncludeText(``)} className={`absolute right-2 top-1/2 -translate-y-1/2 text-slate-400`}><X size={14}/></button>}
                            </div>
                        </div>
                        <div className={`flex items-center gap-2 flex-1 min-w-[200px]`}>
                            <span className={`text-xs font-bold text-slate-500 uppercase`}>Exclude:</span>
                            <div className={`relative flex-1`}>
                                <input 
                                    type={`text`} 
                                    value={excludeText}
                                    onChange={(e) => setExcludeText(e.target.value)}
                                    placeholder={`e.g. free, pdf`}
                                    className={`w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none`}
                                />
                                {excludeText && <button onClick={() => setExcludeText(``)} className={`absolute right-2 top-1/2 -translate-y-1/2 text-slate-400`}><X size={14}/></button>}
                            </div>
                        </div>
                    </div>
                )}
             </div>
             
             <div className={`grid grid-cols-1 md:grid-cols-12 gap-6`}>
                <div className={`md:col-span-3 bg-white/60 backdrop-blur-xl p-8 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group`}>
                  <div className={`absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity`}>
                      <BarChart2 size={100} className={`text-blue-600`} />
                  </div>
                  <div className={`relative z-10`}>
                      <div className={`flex items-center gap-3 mb-4`}>
                          <div className={`p-2.5 bg-blue-100/50 text-blue-600 rounded-xl`}><Search size={20} /></div>
                          <span className={`text-xs font-bold text-slate-500 uppercase tracking-widest`}>Search Volume</span>
                      </div>
                      <div className={`text-5xl font-black text-slate-900 tracking-tight`}>
                        {topStat?.search_volume?.toLocaleString() || `0`}
                      </div>
                      <div className={`mt-6 flex items-center gap-2`}>
                         <div className={`flex-1 h-2 bg-slate-100 rounded-full overflow-hidden`}>
                             <div className={`h-full bg-gradient-to-r from-blue-500 to-indigo-500 w-[70%] rounded-full animate-pulse`} />
                         </div>
                         <span className={`text-xs font-bold text-blue-600`}>High</span>
                      </div>
                  </div>
                </div>

                <div className={`md:col-span-6 bg-white/60 backdrop-blur-xl p-8 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform duration-300 relative`}>
                    <div className={`flex items-center justify-between mb-8`}>
                         <div className={`flex items-center gap-3`}>
                             <div className={`p-2.5 bg-indigo-100/50 text-indigo-600 rounded-xl`}><TrendingUp size={20} /></div>
                             <span className={`text-xs font-bold text-slate-500 uppercase tracking-widest`}>12-Month Trend</span>
                         </div>
                         <span className={`text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md`}>+24% Growth</span>
                    </div>
                    
                    <div className={`flex items-end justify-between h-32 gap-3 relative`}>
                        {((topStat?.trend && topStat.trend.length > 0) ? topStat.trend : [100, 120, 110, 140, 130, 160, 150, 180, 200, 190, 220, 240]).map((vol, i) => {
                             const maxVol = Math.max(...((topStat?.trend && topStat.trend.length > 0) ? topStat.trend : [250]));
                             const heightPercentage = Math.min(100, (vol / maxVol) * 100);
                             
                            return (
                                <div key={i} className={`flex-1 flex flex-col justify-end h-full relative group/bar z-10 cursor-pointer`}>
                                    <div className={`w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg transition-all duration-1000 ease-out opacity-80 group-hover/bar:opacity-100 shadow-sm group-hover/bar:shadow-lg hover:scale-x-110 origin-bottom`} 
                                     style={{ height: showGraph ? `${heightPercentage}%` : `0%`, transitionDelay: `${i * 50}ms` }}></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={`md:col-span-3 flex flex-col gap-6`}>
                    <div className={`flex-1 bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 flex flex-col justify-center hover:-translate-y-1 transition-transform`}>
                        <div className={`flex justify-between items-start mb-2`}>
                            <span className={`text-xs font-bold text-slate-400 uppercase tracking-widest`}>CPC ({currentRegion.currency})</span>
                            <DollarSign size={20} className={`text-emerald-500 bg-emerald-100 rounded-full p-0.5`}/>
                        </div>
                        <div className={`text-4xl font-black text-slate-900`}>${(topStat?.cpc || 0).toFixed(2)}</div>
                    </div>
                    <div className={`flex-1 bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 flex flex-col justify-center hover:-translate-y-1 transition-transform`}>
                        <div className={`flex justify-between items-start mb-2`}>
                            <span className={`text-xs font-bold text-slate-400 uppercase tracking-widest`}>Difficulty</span>
                            <Activity size={20} className={(topStat?.competition_index || 0) > 60 ? `text-amber-500` : `text-emerald-500`}/>
                        </div>
                        <div className={`flex items-baseline gap-2`}>
                            <div className={`text-4xl font-black text-slate-900`}>{topStat?.competition_index || 0}</div>
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                (topStat?.competition_index || 0) > 60 ? `bg-amber-100 text-amber-700` : `bg-emerald-100 text-emerald-700`
                            }`}>
                                {(topStat?.competition_index || 0) > 60 ? `Hard` : `Easy`}
                            </span>
                        </div>
                    </div>
                </div>
             </div>

             <div className={`bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl shadow-slate-200/50 overflow-hidden min-h-[400px]`}>
                <div className={`px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/40`}>
                   <h2 className={`text-lg font-bold text-slate-800 flex items-center gap-3`}>
                       <div className={`p-2 bg-purple-100 text-purple-600 rounded-lg`}><Sparkles size={18} /></div>
                       Keyword Opportunities
                       {loadingResearch && <span className={`text-xs font-bold text-indigo-500 ml-4 animate-pulse`}>Python scraping live metrics...</span>}
                   </h2>
                </div>
                
                <div className={`overflow-x-auto`}>
                    <table className={`w-full text-left border-collapse`}>
                        <thead>
                            <tr className={`bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200`}>
                                <th className={`px-8 py-4 w-12`}>
                                    <input 
                                        type={`checkbox`} 
                                        className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer`}
                                        checked={sortedAndFilteredData.length > 0 && selectedKeywords.size === sortedAndFilteredData.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`keyword`)}>
                                    <div className={`flex items-center gap-1`}>Keyword <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`match_type`)}>
                                    <div className={`flex items-center gap-1`}>Match <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`intent`)}>
                                    <div className={`flex items-center gap-1`}>Intent <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`search_volume`)}>
                                    <div className={`flex items-center gap-1`}>Vol <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`competition_index`)}>
                                    <div className={`flex items-center gap-1`}>KD % <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`cpc`)}>
                                    <div className={`flex items-center gap-1`}>CPC <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors`} onClick={() => requestSort(`click_potential`)}>
                                    <div className={`flex items-center gap-1`}>Clicks <ArrowUpDown size={12}/></div>
                                </th>
                                <th className={`px-8 py-4 text-right`}>Action</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y divide-slate-100`}>
                            {sortedAndFilteredData.length > 0 ? (
                                sortedAndFilteredData.map((item, i) => (
                                <tr key={i} className={`group hover:bg-indigo-50/30 transition-colors ${selectedKeywords.has(item.keyword) ? `bg-indigo-50/40` : ``}`}>
                                    <td className={`px-8 py-4`}>
                                        <input 
                                            type={`checkbox`} 
                                            className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer`}
                                            checked={selectedKeywords.has(item.keyword)}
                                            onChange={() => toggleSelection(item.keyword)}
                                        />
                                    </td>
                                    <td className={`px-4 py-4`}>
                                        <div className={`font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors text-sm`}>{item.keyword}</div>
                                    </td>
                                    
                                    <td className={`px-4 py-4`}>
                                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wide`}>
                                            <Tag size={12} className={`text-indigo-400`} />
                                            {item.match_type || `Related`}
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

                                    <td className={`px-4 py-4 text-sm text-slate-600 font-mono font-medium`}>{item.search_volume?.toLocaleString() || 0}</td>
                                    
                                    <td className={`px-4 py-4`}>
                                        <div className={`flex items-center gap-2`}>
                                            <div className={`w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden`}>
                                                <div className={`h-full rounded-full ${item.competition_index > 60 ? `bg-amber-500` : `bg-emerald-500`}`} style={{ width: `${item.competition_index}%` }} />
                                            </div>
                                            <span className={`text-xs font-bold text-slate-600`}>{item.competition_index}</span>
                                        </div>
                                    </td>

                                    <td className={`px-4 py-4 text-sm text-slate-600 font-mono`}>${(item.cpc || 0).toFixed(2)}</td>

                                    <td className={`px-4 py-4 text-sm text-slate-600 font-mono flex items-center gap-1`}>
                                        <MousePointerClick size={12} className={`text-slate-400`}/>
                                        {item.click_potential?.toLocaleString() || 0}
                                    </td>
                                    
                                    <td className={`px-8 py-4 text-right`}>
                                        <button 
                                            onClick={() => openSaveModal(item)}
                                            className={`text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95 border border-indigo-100`}
                                        >
                                            SAVE
                                        </button>
                                    </td>
                                </tr>
                            ))
                           ) : (
                               <tr>
                                   <td colSpan={9} className={`py-20 text-center`}>
                                        <div className={`flex flex-col items-center justify-center gap-2 text-slate-400`}>
                                             <div className={`p-4 bg-slate-50 rounded-full mb-2`}>
                                                 <AlertCircle size={32} className={`text-slate-300`}/>
                                             </div>
                                             <span className={`text-lg font-semibold text-slate-600`}>No keywords found</span>
                                             <span className={`text-sm`}>Try adjusting your filters or search terms.</span>
                                        </div>
                                   </td>
                               </tr>
                           )}
                        </tbody>
                    </table>
                </div>
             </div>
             <SerpCompetitors keyword={researchData.keyword} market={database} />
          </div>
        )}
      </div>
    </div>
  );
}