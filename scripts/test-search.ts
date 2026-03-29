import axios from "axios";

async function testSearch(query: string) {
    console.log(`Searching web for: ${query}`);
    const searchUrl = `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    try {
        const response = await axios.get(searchUrl, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
            }
        });
        
        const results: string[] = [];
        const linkRegex = /<a class="result-link" href="([^"]+)">([^<]+)<\/a>/g;
        let match;
        while ((match = linkRegex.exec(response.data)) !== null && results.length < 8) {
            results.push(`- ${match[2].trim()}: ${match[1]}`);
        }
        
        if (results.length === 0) {
            console.log("No results found. HTML snippet:");
            console.log(response.data.substring(0, 500));
        } else {
            console.log("Results found:");
            console.log(results.join("\n"));
        }
    } catch (e: any) {
        console.error("Search failed:", e.message);
    }
}

testSearch("sale price of 82 Halsey Street, Brooklyn");
