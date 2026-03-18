'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  url?: string;
  title: string;
  description: string;
  h1: string;
  score: number;
  details?: {
    missingAlt: number;
    totalImages: number;
    h2Count: number;
    h3Count: number;
    internalLinks: number;
    externalLinks: number;
  };
}

export default function DownloadPDFButton({ report }: { report: ReportData }) {
  
  const generatePDF = () => {
    const doc = new jsPDF();

    // -- HEADER --
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("SEO Audit Report", 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} @ ${new Date().toLocaleTimeString()}`, 20, 28);

    // -- SCORE CARD --
    const scoreColor = report.score >= 80 ? [34, 197, 94] : report.score >= 50 ? [234, 179, 8] : [220, 38, 38];
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]); 
    doc.rect(20, 35, 170, 25, 'F'); 
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(`Overall SEO Score: ${report.score}/100`, 30, 52);

    // -- TABLE DATA --
    const tableBody = [
      [{ content: 'Meta Data', colSpan: 2, styles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' } }],
      ['Website URL', report.url || 'N/A'],
      ['Page Title', report.title],
      ['Meta Description', report.description],
      
      [{ content: 'Structure', colSpan: 2, styles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' } }],
      ['H1 Tags Found', report.h1 === 'No H1 found' ? '0' : '1'],
      ['H2 Tags Found', report.details?.h2Count || 0],
      ['H3 Tags Found', report.details?.h3Count || 0],

      [{ content: 'Content Health', colSpan: 2, styles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' } }],
      ['Total Images', report.details?.totalImages || 0],
      ['Images Missing Alt Text', report.details?.missingAlt || 0],
      ['Internal Links', report.details?.internalLinks || 0],
      ['External Links', report.details?.externalLinks || 0],
    ];

    // -- GENERATE TABLE --
    autoTable(doc, {
      startY: 70,
      head: [['Metric', 'Details']],
      body: tableBody as any,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' } 
      },
      styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save(`SEO-Report-${Date.now()}.pdf`);
  };

  return (
    <button 
      onClick={generatePDF}
      className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg font-bold transition flex justify-center items-center gap-2 shadow-lg"
    >
      📄 Download Professional PDF
    </button>
  );
}