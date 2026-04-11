let supabaseClient;
let currentAssignmentDealId = null;

async function initSupabase() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        
        if (!config.supabaseUrl || !config.supabaseKey) {
            console.error('Supabase config missing. Polling fallback active.');
            startPolling();
            return;
        }

        supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseKey);
        
        console.log('Gravity Claw Realtime connected.');
        
        // Subscribe to changes
        supabaseClient
            .channel('any')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, payload => {
                console.log('Realtime Update:', payload);
                fetchStats();
                fetchDeals();
            })
            .subscribe();

    } catch (err) {
        console.error('Failed to init Supabase:', err);
        startPolling();
    }
}

function startPolling() {
    setInterval(() => {
        fetchStats();
        fetchDeals();
    }, 10000);
}

async function fetchStats() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();
        
        document.getElementById('totalLeads').textContent = data.totalLeads.toLocaleString();
        document.getElementById('surplusDeals').textContent = data.surplusDeals.toLocaleString();
        document.getElementById('callsMade').textContent = data.callsMade.toLocaleString();
        document.getElementById('interestedLeads').textContent = data.interestedLeads.toLocaleString();
        document.getElementById('estimatedProfit').textContent = `$${data.estimatedProfit.toLocaleString()}`;
    } catch (err) {
        console.error('Failed to fetch stats:', err);
    }
}

async function fetchDeals() {
    try {
        const response = await fetch('/api/dashboard/deals');
        const deals = await response.json();
        
        // Filter out finalized outcomes from active feed
        const activeDeals = deals.filter(d => !d.outcome);

        renderPriorityDeals(activeDeals);
        renderHotDeals(activeDeals);
        renderAllDeals(activeDeals);
    } catch (err) {
        console.error('Failed to fetch deals:', err);
    }
}

function renderPriorityDeals(deals) {
    const priorityDeals = deals
        .filter(isHighValue)
        .sort((a, b) => (b.profit || 0) - (a.profit || 0))
        .slice(0, 3);

    const container = document.getElementById('priorityDealsList');
    const section = document.getElementById('priority-deals-section');

    if (priorityDeals.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';
    
    priorityDeals.forEach(deal => {
        container.appendChild(createDealCard(deal, false));
    });
}

function renderHotDeals(deals) {
    const hotDeals = deals
        .filter(d => (d.status || '').toLowerCase() === 'interested')
        .sort((a, b) => (b.profit || 0) - (a.profit || 0))
        .slice(0, 3);

    const container = document.getElementById('hotDealsList');
    const section = document.getElementById('hot-deals-section');

    if (hotDeals.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';
    
    hotDeals.forEach(deal => {
        container.appendChild(createDealCard(deal, true));
    });
}

function renderAllDeals(deals) {
    const dealsList = document.getElementById('dealsList');
    if (deals.length === 0) {
        dealsList.innerHTML = '<div class="loading">No active surplus deals. Generate patterns to find more.</div>';
        return;
    }

    dealsList.innerHTML = '';
    deals.forEach(deal => {
        dealsList.appendChild(createDealCard(deal, false));
    });
}

function isHighValue(deal) {
    const surplus = deal.surplus || 0;
    const price = deal.price || deal.max_offer || 0;
    const profit = (deal.arv || 0) - price - (deal.repair_estimate || 0);
    return surplus > 20000 || profit > 30000;
}

function createDealCard(deal, isHot = false) {
    const card = document.createElement('div');
    const status = deal.status || 'Lead';
    const statusClass = status.toLowerCase().replace(' ', '-');
    const highValue = isHighValue(deal);
    
    card.className = `deal-card ${statusClass} ${isHot ? 'hot-card' : ''} ${highValue ? 'high-value-card' : ''}`;
    
    const isInterested = status.toLowerCase() === 'interested';
    
    card.innerHTML = `
        <div class="status-tag ${statusClass}">${status}</div>
        ${isHot ? '<div class="hot-badge">TOP PRIORITY</div>' : ''}
        ${highValue ? '<div class="high-value-badge">💎 HIGH VALUE</div>' : ''}
        
        <div class="card-header-main">
            <h3>${deal.address}</h3>
            <div class="outcome-actions">
                <button class="outcome-btn closed" onclick="setOutcome(${deal.id}, 'closed')" title="Mark as Closed">✅</button>
                <button class="outcome-btn bounce" onclick="setOutcome(${deal.id}, 'no_response')" title="Mark as No Response">❌</button>
            </div>
        </div>

        <div class="deal-info">
            <div class="info-item">
                <label>Owner</label>
                <span>${deal.seller_name || 'Owner'}</span>
            </div>
            <div class="info-item">
                <label>📞 Phone</label>
                <span>${deal.seller_phone || 'N/A'}</span>
            </div>
        </div>
        <div class="card-footer">
            <span class="surplus-tag">💰 Surplus: $${(deal.profit || 0).toLocaleString()}</span>
            <div class="card-btns">
                ${isInterested ? `<button class="contract-btn" onclick="sendContract(${deal.id}, this)">📄 Contract</button>` : ''}
                ${isInterested ? `<button class="match-btn" onclick="openAssignment(${deal.id})">🤝 Match</button>` : ''}
                <button class="call-btn" onclick="triggerCall(${deal.id}, this)">🎙️ Call AI</button>
            </div>
        </div>
    `;
    return card;
}

async function setOutcome(dealId, outcome) {
    if (!confirm(`Mark this deal as ${outcome.toUpperCase()} and archive it?`)) return;

    try {
        const response = await fetch('/api/dashboard/outcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId, outcome })
        });
        
        const result = await response.json();
        if (result.success) {
            fetchDeals();
            fetchStats();
        }
    } catch (err) {
        console.error('Failed to set outcome:', err);
    }
}

async function triggerCall(dealId, btn) {
    const originalText = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = 'Connecting...';
        
        const response = await fetch('/api/dashboard/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId })
        });
        
        const result = await response.json();
        if (result.success) {
            btn.innerHTML = '✅ Triggered';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 3000);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        console.error('Failed to trigger call:', err);
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 3000);
    }
}

// AI Insights Logic
function openInsights() {
    document.getElementById('insightsModal').classList.remove('hidden');
    fetchInsights();
}

function closeInsights() {
    document.getElementById('insightsModal').classList.add('hidden');
}

async function fetchInsights() {
    const body = document.getElementById('insightsBody');
    body.innerHTML = '<div class="loading">🔍 AI is analyzing 100+ deal patterns through OpenRouter...</div>';

    try {
        const res = await fetch('/api/dashboard/insights');
        const data = await res.json();
        
        // Simple Markdown-ish parser for the AI response
        const html = data.insights
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>')
            .replace(/\n/g, '<br>');

        body.innerHTML = html;
    } catch (err) {
        body.innerHTML = '<div class="error">Failed to generate AI insights. Please check OpenRouter credits.</div>';
    }
}

// Assignment (Disposition) Logic
async function openAssignment(dealId) {
    currentAssignmentDealId = dealId;
    document.getElementById('assignmentModal').classList.remove('hidden');
    
    // Clear previous
    document.getElementById('matchResults').innerHTML = '<div class="loading">Finding matching buyers...</div>';
    const bSelect = document.getElementById('buyerSelect');
    bSelect.innerHTML = '<option value="">-- Choose Investor --</option>';

    try {
        // Fetch Matches
        const matchRes = await fetch(`/api/dashboard/match-buyers?dealId=${dealId}`);
        const matches = await matchRes.json();
        
        // Fetch All Buyers for dropdown
        const allRes = await fetch('/api/dashboard/buyers');
        const allBuyers = await allRes.json();

        // Render Matches
        const resultsDiv = document.getElementById('matchResults');
        if (matches.length === 0) {
            resultsDiv.innerHTML = '<div class="loading">No automatic matches found. Sending blast alerts recommended.</div>';
        } else {
            resultsDiv.innerHTML = '<h3>Automatic Matches</h3>';
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'buyer-item';
                div.innerHTML = `
                    <span>👤 ${m.name} (${m.city})</span>
                    <span class="match-score">READY TO BUY</span>
                `;
                resultsDiv.appendChild(div);
            });
        }

        // Populate Dropdown
        allBuyers.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} ($${(b.budget || 0).toLocaleString()})`;
            bSelect.appendChild(opt);
        });

    } catch (err) {
        console.error('Failed to load assignment data:', err);
    }
}

function closeAssignment() {
    document.getElementById('assignmentModal').classList.add('hidden');
}

async function submitAssignment() {
    const buyerId = document.getElementById('buyerSelect').value;
    const salePrice = document.getElementById('salePriceInput').value;

    if (!buyerId || !salePrice) {
        alert("Please select a buyer and enter the final sale price.");
        return;
    }

    try {
        const response = await fetch('/api/dashboard/assign-deal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                dealId: currentAssignmentDealId, 
                buyerId, 
                salePrice 
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert("Deal successfully assigned! Assignment fee calculated and profit tracked.");
            closeAssignment();
            fetchDeals();
            fetchStats();
        }
    } catch (err) {
        console.error('Failed to assign deal:', err);
    }
}

async function sendContract(dealId, btn) {
    if (!confirm("Dispatch legal assignment agreement to seller via SMS?")) return;
    
    const originalText = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = 'Sending...';
        
        const response = await fetch('/api/dashboard/send-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId })
        });
        
        const result = await response.json();
        if (result.success) {
            btn.innerHTML = '✅ Sent';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                fetchDeals();
            }, 2000);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        console.error('Failed to send contract:', err);
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 3000);
    }
}

// Initial Run
initSupabase();
fetchStats();
fetchDeals();
