import axios from "axios";
import fs from "fs";

async function dumpSearch(query: string) {
    const searchUrl = `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    console.log(`Dumping search for: ${query}`);
    try {
        const response = await axios.get(searchUrl, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
            }
        });
        fs.writeFileSync("ddg-lite-dump.html", response.data);
        console.log("Dumped to ddg-lite-dump.html. Length:", response.data.length);
    } catch (e: any) {
        console.error("Failed:", e.message);
    }
}

dumpSearch("82 Halsey Street Brooklyn sale price");
