import { NextResponse } from "next/server";
import { calculateStrictKD, classifyMultiIntent, generateStableMetrics, getDeterministicDomainMetrics } from "@/lib/IntelligenceEngine";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const keyword = body.keyword;
    const country = body.market || "us";

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    // 1. Execute Python Scraper via Internal API Request
    // This calls the serverless function at /api/scraper.py
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const host = req.headers.get("host");
    
    const scraperResponse = await fetch(`${protocol}://${host}/api/scraper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, country })
    });

    const parsedData = await scraperResponse.json();

    if (!parsedData.success || !parsedData.urls) {
      return NextResponse.json({ error: parsedData.error || "Scraping failed" }, { status: 500 });
    }

    // 2. Run Algorithmic Intelligence Engine
    const urls = parsedData.urls;
    const serpFeatures = parsedData.serp_features || ["Organic"]; 
    
    const difficultyData = calculateStrictKD(urls, serpFeatures);
    const intentData = classifyMultiIntent(keyword);
    const volumeMetrics = generateStableMetrics(keyword, country);

    // 3. Save Master Keyword Data
    const savedKeyword = await prisma.keyword.upsert({
      where: { keywordText: keyword },
      update: {}, 
      create: {
        keywordText: keyword,
        language: "en",
        metrics: {
          create: {
            countryCode: country,
            searchVolume: volumeMetrics.searchVolume,
            cpc: volumeMetrics.cpc,
            competitionDensity: volumeMetrics.competitionDensity,
            resultsCount: volumeMetrics.resultsCount 
          }
        },
        difficulty: {
          create: {
            kdScore: difficultyData.score,
            difficultyLabel: difficultyData.label
          }
        },
        intent: {
          create: {
            primaryIntent: intentData.primaryIntent,
            secondaryIntents: intentData.secondaryIntents,
            confidenceScore: intentData.score
          }
        }
      }
    });

    // 4. Save Top 10 Live SERP Results with Calculated Domain Metrics
    if (parsedData.detailed_results) {
      await prisma.serpResult.deleteMany({ where: { keywordId: savedKeyword.id, countryCode: country } });
      
      const serpPayload = parsedData.detailed_results.map((res: any) => {
        const domainMetrics = getDeterministicDomainMetrics(res.domain);
        
        return {
          keywordId: savedKeyword.id,
          countryCode: country,
          position: res.position,
          url: res.url,
          domain: res.domain,
          pageType: res.page_type,
          referringDomains: domainMetrics.rd,
          domainAuthority: domainMetrics.da,
          estimatedTrafficShare: (30 / res.position) 
        };
      });
      
      await prisma.serpResult.createMany({ data: serpPayload });
    }

    // 5. Save Detected SERP Features to Database
    await prisma.serpFeature.deleteMany({ where: { keywordId: savedKeyword.id } });
    
    const featurePayload = serpFeatures.map((feat: string) => ({
        keywordId: savedKeyword.id,
        featureType: feat
    }));
    await prisma.serpFeature.createMany({ data: featurePayload });

    // 6. Generate Historical Trends (12 Months)
    const currentYear = new Date().getFullYear();
    const trendPayload = [];
    let baseVol = volumeMetrics.searchVolume;
    
    for (let month = 1; month <= 12; month++) {
        const variance = ((keyword.length + month) % 40) - 20; 
        const monthVol = Math.max(10, Math.floor(baseVol * (1 + (variance / 100))));
        
        trendPayload.push({
           keywordId: savedKeyword.id,
           countryCode: country,
           month: month,
           year: currentYear,
           searchVolume: monthVol
        });
    }
    await prisma.keywordTrend.deleteMany({ where: { keywordId: savedKeyword.id, countryCode: country } });
    await prisma.keywordTrend.createMany({ data: trendPayload });

    // 7. SERP Overlap Clustering Engine (60% Rule)
    const currentUrls = urls;
    const allClusters = await prisma.keywordCluster.findMany();
    
    let matchedClusterId = null;
    let highestOverlap = 0;

    for (const cluster of allClusters) {
        const parentSerp = await prisma.serpResult.findMany({
            where: { keywordId: cluster.parentKeywordId, countryCode: country },
            select: { url: true }
        });
        const parentUrls = parentSerp.map((s: any) => s.url);
        
        const overlapCount = currentUrls.filter((url: string) => parentUrls.includes(url)).length;
        const overlapPercentage = (overlapCount / Math.max(currentUrls.length, 1)) * 100;

        if (overlapPercentage >= 60 && overlapPercentage > highestOverlap) {
            matchedClusterId = cluster.id;
            highestOverlap = overlapPercentage;
        }
    }

    if (matchedClusterId) {
        await prisma.keywordClusterMap.upsert({
            where: {
                clusterId_keywordId: { clusterId: matchedClusterId, keywordId: savedKeyword.id }
            },
            update: { serpOverlapPercentage: highestOverlap },
            create: {
                clusterId: matchedClusterId,
                keywordId: savedKeyword.id,
                serpOverlapPercentage: highestOverlap
            }
        });
    } else {
        const newCluster = await prisma.keywordCluster.create({
            data: {
                parentKeywordId: savedKeyword.id,
                clusterName: keyword 
            }
        });
        
        await prisma.keywordClusterMap.create({
            data: {
                clusterId: newCluster.id,
                keywordId: savedKeyword.id,
                serpOverlapPercentage: 100
            }
        });
    }

    // 8. Return data to frontend
    return NextResponse.json({
      success: true,
      data: {
        keyword: keyword,
        search_volume: volumeMetrics.searchVolume,
        cpc: volumeMetrics.cpc,
        competition_index: difficultyData.score,
        intent: intentData.primaryIntent,
        urls: urls,
        detailed_results: parsedData.detailed_results,
        serp_features: serpFeatures 
      }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Backend Analysis Failed" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}