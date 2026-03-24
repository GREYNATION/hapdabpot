import axios from "axios";

async function testScraping() {
    console.log("--- SCRAPING TEST ---");
    const url = "https://www.zillow.com/homedetails/82-Halsey-St-Brooklyn-NY-11216/30578641_zpid/";
    console.log("URL:", url);

    try {
        console.log("Sending request to Zillow...");
        const response = await axios.get(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            },
            timeout: 10000
        });
        
        console.log("Status:", response.status);
        const text = response.data.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
                                  .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
                                  .replace(/<[^>]+>/g, " ")
                                  .replace(/\s+/g, " ")
                                  .trim();
        console.log("Content length:", text.length);
        console.log("Snippet:", text.substring(0, 500));
        
        if (text.toLowerCase().includes("captcha") || text.toLowerCase().includes("please confirm you are a human")) {
            console.log("CAUGHT BY CAPTCHA!");
        }
    } catch (e: any) {
        console.error("SCRAPING FAILED!");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data sample:", e.response.data.substring(0, 500));
        } else {
            console.error("Error:", e.message);
        }
    }
    console.log("--------------------------");
}

testScraping();
