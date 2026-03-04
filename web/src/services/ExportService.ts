import { stringify } from 'csv-stringify/sync';

export class ExportService {
  public static generateCSV(data: any[]): string {
    const columns = [
      'Keyword', 
      'Volume', 
      'KD %', 
      'CPC', 
      'Intent', 
      'Top URL'
    ];

    const rows = data.map(row => [
      row.keyword_text,
      row.search_volume,
      row.kd_score,
      row.cpc,
      row.primary_intent,
      row.url || 'N/A'
    ]);

    return stringify([columns, ...rows]);
  }
}