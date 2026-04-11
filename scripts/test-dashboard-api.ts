import fetch from "node-fetch";

async function verify() {
    const baseUrl = process.env.BASE_URL || "http://localhost:8080";
    
    try {
        console.log(`Checking dashboard stats at ${baseUrl}/api/dashboard/stats...`);
        const statsRes = await fetch(`${baseUrl}/api/dashboard/stats`);
        if (statsRes.ok) {
            console.log("✅ Stats API OK:", await statsRes.json());
        } else {
            console.error("❌ Stats API Failed:", statsRes.status, await statsRes.text());
        }

        console.log(`Checking deals API at ${baseUrl}/api/dashboard/deals...`);
        const dealsRes = await fetch(`${baseUrl}/api/dashboard/deals`);
        if (dealsRes.ok) {
            const deals = await dealsRes.json();
            console.log(`✅ Deals API OK: Found ${deals.length} deals.`);
        } else {
            console.error("❌ Deals API Failed:", dealsRes.status, await dealsRes.text());
        }
    } catch (err: any) {
        console.error("❌ Verification failed (Server might not be running):", err.message);
    }
}

verify();
