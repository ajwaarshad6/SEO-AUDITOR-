import { useState } from 'react';

export default function SerpCompetitors({ keyword, market }: { keyword: string, market: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(``);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState(``);

  const runAnalysis = async () => {
    if (!keyword) return;
    setLoading(true);
    setError(``);
    setDifficulty(null);
    setIntent(null);
    setSaveStatus(``);
    
    try {
      const res = await fetch(`/api/serp`, {
        method: `POST`,
        headers: { Accept: `application/json`, [`Content-Type`]: `application/json` },
        body: JSON.stringify({ keyword, market })
      });
      
      const response = await res.json();
      
      if (response.success) {
        const payload = response.data || response;
        setUrls(payload.urls || []); 
        setDifficulty(payload.competition_index || payload.difficulty || null);
        setIntent(payload.intent || null);
      } else {
        setError(response.error || `Error fetching data from API`);
      }
    } catch (err) {
      setError(`Network error occurred while fetching SERP data`);
    }
    
    setLoading(false);
  };

  const downloadCSV = () => {
    let header = `Rank,Competitor Domain URL`;
    if (difficulty !== null) header += `,Difficulty`;
    if (intent) header += `,Intent`;
    header += `\n`;

    let csvContent = header;

    if (Array.isArray(urls)) {
      urls.forEach((url: string, index: number) => {
        let row = `${index + 1},"${url}"`;
        if (difficulty !== null) row += `,${difficulty}`;
        if (intent) row += `,${intent}`;
        row += `\n`;
        csvContent += row;
      });
    }

    // THE FIX: Using a Blob completely protects the file from breaking on '#' or ',' symbols
    const blob = new Blob([csvContent], { type: `text/csv;charset=utf-8;` });
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement(`a`);
    link.setAttribute(`href`, blobUrl);
    link.setAttribute(`download`, `${keyword.replace(/\s+/g, `-`)}-serp-data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up memory
    URL.revokeObjectURL(blobUrl);
  };

  const saveToSupabase = async () => {
    setSaveStatus(`Saving...`);
    try {
      const res = await fetch(`/api/keywords/save`, {
        method: `POST`,
        headers: { Accept: `application/json`, [`Content-Type`]: `application/json` },
        body: JSON.stringify({ keyword, market, difficulty, intent })
      });

      const data = await res.json();

      if (data.success) {
        setSaveStatus(`Saved successfully!`);
      } else {
        setSaveStatus(`Failed to save`);
      }
    } catch (err) {
      setSaveStatus(`Network error`);
    }
  };

  const getIntentColor = (type: string) => {
    if (type === `Commercial`) return `bg-blue-100 text-blue-800 border-blue-200`;
    if (type === `Informational`) return `bg-green-100 text-green-800 border-green-200`;
    if (type === `Transactional`) return `bg-purple-100 text-purple-800 border-purple-200`;
    return `bg-gray-100 text-gray-800 border-gray-200`;
  };

  return (
    <div className={`mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100`}>
      <div className={`flex justify-between items-center mb-6`}>
        <div className={`flex items-center gap-4`}>
          <h3 className={`text-xl font-bold text-gray-800`}>Top 10 Organic Competitors</h3>
          
          {difficulty !== null && (
            <span className={`px-3 py-1 bg-orange-100 text-orange-800 font-bold rounded-lg text-sm border border-orange-200`}>
              KD: {difficulty} / 100
            </span>
          )}

          {intent && (
            <span className={`px-3 py-1 font-bold rounded-lg text-sm border ${getIntentColor(intent)}`}>
              {intent}
            </span>
          )}
        </div>
        
        <div className={`flex gap-3`}>
          {urls && urls.length > 0 && (
            <>
              <button 
                onClick={saveToSupabase} 
                className={`bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors`}
              >
                {saveStatus || `Save to Dashboard`}
              </button>

              <button 
                onClick={downloadCSV} 
                className={`bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors`}
              >
                Export CSV
              </button>
            </>
          )}
          
          <button 
            onClick={runAnalysis} 
            disabled={loading || !keyword}
            className={`bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors`}
          >
            {loading ? `Analyzing SERP...` : `Run SERP Analysis`}
          </button>
        </div>
      </div>
      
      {error && <p className={`text-red-500 mb-4 bg-red-50 p-3 rounded-lg`}>{error}</p>}
      
      {urls && urls.length > 0 && (
        <div className={`overflow-x-auto`}>
          <table className={`w-full text-left border-collapse`}>
            <thead>
              <tr className={`border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider`}>
                <th className={`pb-3 font-semibold px-4`}>Rank</th>
                <th className={`pb-3 font-semibold px-4`}>Competitor Domain URL</th>
              </tr>
            </thead>
            <tbody>
              {urls.map((url: string, index: number) => (
                <tr key={index} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors`}>
                  <td className={`py-4 px-4 font-semibold text-gray-700 w-20`}>#{index + 1}</td>
                  <td className={`py-4 px-4 text-gray-600`}>
                    <a href={url} target={`_blank`} rel={`noreferrer`} className={`text-blue-600 hover:text-blue-800 hover:underline`}>
                      {url}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {(!urls || urls.length === 0) && !loading && !error && (
        <p className={`text-gray-400 text-sm`}>
          Select a keyword from your table above and click the button to extract live organic competitors.
        </p>
      )}
    </div>
  );
}