export function exportSemrushStyleCSV(data: any[], seedKeyword: string, databaseName: string) {
  const headers = [
    `Database`, `Keyword`, `Seed Keyword`, `Volume`, `Keyword Difficulty`, `CPC (USD)`, 
    `Competitive Density`, `Number of Results`, `Intent`, `SERP Features`, `Trend`, 
    `Click Potential`, `Competitors`
  ];
  
  // Notice we removed the data:text/csv prefix from the raw string
  let csvContent = headers.join(`,`) + `\n`;

  data.forEach(row => {
    const features = Array.isArray(row.serp_features) ? row.serp_features.join(` | `) : `Organic`;
    const trendData = Array.isArray(row.trend) ? row.trend.join(`-`) : ``;
    const competitorsData = Array.isArray(row.competitors) ? row.competitors.join(` | `) : ``;
    
    const rowData = [
      `"${databaseName}"`,
      `"${row.keyword || ``}"`,
      `"${seedKeyword || ``}"`,
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

  // Enterprise Blob Generation - Immune to # symbols and length limits
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement(`a`);
  link.setAttribute(`href`, url);
  link.setAttribute(`download`, `${seedKeyword.replace(/\s+/g, `-`)}-comprehensive-report.csv`);
  document.body.appendChild(link);
  link.click();
  
  // Clean up memory
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}