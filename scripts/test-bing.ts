import axios from "axios";

async function testBing(query: string) {
    console.log(`Searching Bing for: ${query}`);
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    try {
        const response = await axios.get(searchUrl, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" 
            }
        });
        
        console.log("Response length:", response.data.length);
        const results: string[] = [];
        // Bing search results usually in <h2><a href="...">
        // Let's check for "b_algo" which is the result item class
        const linkRegex = /<h2><a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>/g;
        let match;
        while ((match = linkRegex.exec(response.data)) !== null && results.length < 8) {
            const title = match[2].replace(/<[^>]*>/g, "").trim();
            results.push(`- ${title}: ${match[1]}`);
        }
        
        if (results.length === 0) {
            console.log("No results. Trying fallback regex...");
            const simpleRegex = /<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
            while ((match = simpleRegex.exec(response.data)) !== null && results.length < 10) {
                const url = match[1];
                const text = match[2].replace(/<[^>]*>/g, "").trim();
                // Avoid internal links
                if (url.startsWith("http") && !url.includes("microsoft.com") && !url.includes("bing.com") && text.length > 5) {
                    results.push(`- ${text}: ${url}`);
                }
            }
        }

        console.log("Results found:", results.length);
        if (results.length > 0) {
            console.log(results.slice(0, 5).join("\n"));
        } else {
            console.log("STILL NO RESULTS. HTML snippet around search results:");
            const bodyIndex = response.data.indexOf("<body");
            console.log(response.data.substring(bodyIndex, bodyIndex + 500));
        }
    } catch (e: any) {
        console.error("Failed:", e.message);
    }
}

testBing("82 Halsey Street Brooklyn sale price");
