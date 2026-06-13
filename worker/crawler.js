const { chromium } = require('playwright');
const cheerio = require('cheerio');

async function runAudit(url) {
    console.log(`Starting audit for: ${url}`);
    
    // 1. Launch the browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // 2. Go to the URL
        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000                 
        });
        
        // --- THE FIX IS HERE ---
        console.log("Page loaded, waiting for 3 seconds to settle...");
        await page.waitForTimeout(3000); // Wait 3 seconds for redirects/animations
        // -----------------------

        const status = response.status();
        
        // 3. Get the page content
        const content = await page.content();
        const $ = cheerio.load(content);

        // 4. Extract SEO Data
        const title = $('title').text();
        const description = $('meta[name="description"]').attr('content') || 
                            $('meta[property="og:description"]').attr('content') || 
                            'No description found';
        const h1 = $('h1').text().trim() || 'No H1 found';
        
        // 5. Create the Report Object
        const report = {
            url,
            status,
            details: {
                title: title,
                description: description,
                h1: h1
            }
        };

        console.log("--- AUDIT REPORT ---");
        console.log(report);
        console.log("--------------------");

    } catch (error) {
        console.error("Error crawling:", error.message);
    } finally {
        await browser.close();
    }
}

// Test with a website
runAudit('https://blackzero.co');