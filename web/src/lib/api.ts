export const fetchKeywordData = async (filters: any, isExport = false) => {
  try {
    const response = await fetch(`/api/magic`, {
      method: `POST`,
      headers: {
        [`Content-Type`]: `application/json`
      },
      body: JSON.stringify({ ...filters, exportAction: isExport })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data`);
    }

    if (isExport) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement(`a`);
      a.href = url;
      a.download = `keyword_export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { success: true };
    }

    const data = await response.json();
    return data.results;

  } catch (error) {
    console.error(error);
    return null;
  }
};