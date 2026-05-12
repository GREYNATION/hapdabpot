async function fetchData() {
    try {
        // Fetch Stats
        const statsRes = await fetch('/api/dashboard/stats');
        const stats = await statsRes.json();
        
        document.getElementById('totalLeads').innerText = stats.totalLeads || 0;
        document.getElementById('qualifiedLeads').innerText = stats.interestedLeads || 0;
        document.getElementById('estRevenue').innerText = `$${(stats.interestedLeads * 5000).toLocaleString()}`; // Mock calculation

        // Fetch Leads
        const leadsRes = await fetch('/api/dashboard/deals');
        const leads = await leadsRes.json();
        const tbody = document.querySelector('#leadTable tbody');
        tbody.innerHTML = '';
        
        leads.slice(0, 10).forEach(lead => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${lead.address || 'Unknown'}</td>
                <td>${lead.owner_name || 'Business Owner'}</td>
                <td><span class="status-pill ${lead.status === 'interested' ? 'qualified' : ''}">${lead.status || 'new'}</span></td>
                <td>${Math.floor(Math.random() * 40 + 60)}%</td>
                <td><button class="btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">View</button></td>
            `;
            tbody.appendChild(tr);
        });

        // Fetch Recent AI Scripts
        const scripts = [
            { title: "Hook: The $1M Mistake", content: "Most founders think that they need more traffic. The truth is you need better conversion..." },
            { title: "Value: Miro Board Breakdown", content: "Here is the exact system I use to 10x lead volume using AI agents..." },
            { title: "CTA: Book a 10x Call", content: "If you want this exact system built for your business, click the link in bio..." }
        ];
        
        const scriptContainer = document.getElementById('scriptList');
        scriptContainer.innerHTML = '';
        scripts.forEach(s => {
            const div = document.createElement('div');
            div.className = 'script-card';
            div.innerHTML = `
                <h3>${s.title}</h3>
                <p>${s.content}</p>
            `;
            scriptContainer.appendChild(div);
        });

    } catch (err) {
        console.error("Failed to load dashboard data:", err);
    }
}

function refreshLeads() {
    fetchData();
}

// Initial Load
fetchData();

// Periodic update
setInterval(fetchData, 10000);
