import axios from "axios";

async function debugNoEmbed() {
    const url = "https://www.youtube.com/shorts/JAnI5Y1H9Xw";
    const apiUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
    console.log(`Fetching: ${apiUrl}`);
    
    try {
        const response = await axios.get(apiUrl);
        console.log("Response data:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
    }
}

debugNoEmbed();
