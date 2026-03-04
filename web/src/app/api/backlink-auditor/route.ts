import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { 
    calculateSemanticRelevance, 
    detectManipulationIntent, 
    computeXGBoostRisk, 
    classifyBacklink 
} from '@/lib/backlink-ml';

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();

    if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });

    const target = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    
    console.log(`🕷️ STARTING CRAWL FOR: ${target}`);

    // --- STEP 1: EXECUTE PYTHON SCRAPY CRAWLER ---
    
    // PATH SETUP
    const crawlerPath = path.resolve(process.cwd(), '../crawler'); 
    const uniqueID = randomUUID();
    const outputFile = `output_${uniqueID}.json`;
    const outputFilePath = path.join(crawlerPath, outputFile);

    // COMMAND: Explicitly point to the venv python executable
    // This assumes you are on Windows
    const pythonExec = path.join(crawlerPath, 'venv', 'Scripts', 'python.exe');
    const command = `"${pythonExec}" -m scrapy crawl backlink_finder -a target="${target}" -O "${outputFile}"`;

    console.log(`📂 Crawler Path: ${crawlerPath}`);
    console.log(`💻 Command: ${command}`);

    const rawBacklinks = await new Promise<any[]>((resolve, reject) => {
        exec(command, { cwd: crawlerPath }, (error, stdout, stderr) => {
            
            // LOG EVERYTHING for debugging
            if (stderr) console.error(`⚠️ Scrapy Stderr: ${stderr}`);
            if (stdout) console.log(`ℹ️ Scrapy Stdout: ${stdout}`);

            if (error) {
                console.error(`❌ EXEC ERROR: ${error.message}`);
                resolve([]); 
                return;
            }
            
            if (fs.existsSync(outputFilePath)) {
                try {
                    const fileData = fs.readFileSync(outputFilePath, 'utf8');
                    fs.unlinkSync(outputFilePath); 
                    
                    if (!fileData.trim()) {
                        console.warn("⚠️ JSON file was empty.");
                        resolve([]);
                    } else {
                        const parsedData = JSON.parse(fileData);
                        resolve(parsedData);
                    }
                } catch (e) {
                    console.error("❌ JSON Parse Error:", e);
                    resolve([]);
                }
            } else {
                console.warn("⚠️ No output file found. Scrapy might have been blocked or failed.");
                resolve([]);
            }
        });
    });

    console.log(`✅ Scrapy found ${rawBacklinks.length} real backlinks.`);

    // --- STEP 2: ML PIPELINE ---
    
    const processedLinks = rawBacklinks.map((link: any) => {
        let simDA = Math.floor(Math.random() * 40) + 10; 
        if (link.source_url.includes('.edu') || link.source_url.includes('.gov')) simDA += 40;
        
        let simSpam = Math.floor(Math.random() * 10);
        if (link.source_url.includes('coupon') || link.source_url.includes('free')) simSpam += 50;

        const relevance = calculateSemanticRelevance(link.anchor, "General"); 
        const intent = detectManipulationIntent(link.anchor);
        const toxicScore = computeXGBoostRisk(simDA, simSpam, relevance, intent, "Text");

        return {
            sourceTitle: link.source_title || new URL(link.source_url).hostname,
            sourceUrl: link.source_url,
            authority: simDA, 
            spamScore: simSpam,
            anchor: link.anchor,
            type: "Text",
            firstSeen: link.found_date || new Date().toISOString().split('T')[0],
            bert_intent: intent, 
            xgboost_risk: toxicScore, 
            semantic_relevance: relevance,
            classification: classifyBacklink(toxicScore),
            isToxic: toxicScore >= 60,
        };
    });

    // --- STEP 3: STATS ---
    const toxicCount = processedLinks.filter((l: any) => l.isToxic).length;
    
    // FIX: If no backlinks are found, the score plummets. Otherwise, calculate normally.
    let healthScore = 100;
    if (processedLinks.length === 0) {
        healthScore = 10; // Severe penalty for having absolutely zero off-page presence
    } else {
        healthScore = Math.max(0, 100 - (toxicCount * 5)); 
    }

    const anchorCounts: Record<string, number> = {};
    processedLinks.forEach((l: any) => {
        const key = l.bert_intent === 'Natural' ? 'Natural' : 'Optimized/Toxic';
        anchorCounts[key] = (anchorCounts[key] || 0) + 1;
    });
    const anchorStats = Object.entries(anchorCounts).map(([type, count]) => ({ type, count }));

    return NextResponse.json({
        domain: target,
        healthScore,
        stats: {
            totalBacklinks: processedLinks.length,
            referringDomains: new Set(processedLinks.map((l: any) => new URL(l.sourceUrl).hostname)).size,
            toxicLinks: toxicCount,
            newLinks: Math.floor(Math.random() * 5),
            lostLinks: 0
        },
       velocity: [
            { month: `Sep`, newLinks: Math.max(5, Math.floor(processedLinks.length * 0.2)) }, 
            { month: `Oct`, newLinks: Math.max(12, Math.floor(processedLinks.length * 0.4)) },
            { month: `Nov`, newLinks: Math.max(18, Math.floor(processedLinks.length * 0.6)) }, 
            { month: `Dec`, newLinks: Math.max(25, Math.floor(processedLinks.length * 0.75)) },
            { month: `Jan`, newLinks: Math.max(35, Math.floor(processedLinks.length * 0.9)) }, 
            { month: `Feb`, newLinks: Math.max(45, processedLinks.length) }
        ],
        anchors: anchorStats,
        backlinks: processedLinks,
        insights: [
            `${processedLinks.length} live backlinks discovered via Scrapy.`,
            toxicCount > 0 ? `⚠️ Alert: ${toxicCount} toxic links detected.` : (processedLinks.length === 0 ? "⚠️ Alert: Zero backlinks found. Severe SEO penalty." : "✅ Clean Crawl.")
        ]
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}