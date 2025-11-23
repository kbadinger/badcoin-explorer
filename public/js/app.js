const API_BASE = window.location.origin + '/api';

// Format numbers with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format date
function formatDate(date) {
    return new Date(date).toLocaleString();
}

// Truncate hash
function truncateHash(hash, length = 16) {
    if (!hash) return '-';
    return hash.substring(0, length) + '...';
}

// Load network status
async function loadStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();

        document.getElementById('blockHeight').textContent = formatNumber(data.blockchain.blocks);
        document.getElementById('difficulty').textContent = data.blockchain.difficulty.toFixed(2);
        document.getElementById('connections').textContent = data.network.connections;
        document.getElementById('syncProgress').textContent = `${data.sync.percentage}%`;
    } catch (error) {
        console.error('Error loading status:', error);
    }
}

// Load latest blocks
async function loadBlocks() {
    try {
        const response = await fetch(`${API_BASE}/blocks?limit=10`);
        const blocks = await response.json();

        const tbody = document.getElementById('blocksBody');
        tbody.innerHTML = '';

        blocks.forEach(block => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><span class="clickable" onclick="viewBlock(${block.height})">${formatNumber(block.height)}</span></td>
                <td><span class="hash clickable" onclick="viewBlock('${block.hash}')">${truncateHash(block.hash)}</span></td>
                <td>${formatDate(block.time)}</td>
                <td>${block.txCount || 0}</td>
                <td>${(block.size / 1024).toFixed(2)} KB</td>
            `;
        });
    } catch (error) {
        console.error('Error loading blocks:', error);
        document.getElementById('blocksBody').innerHTML = '<tr><td colspan="5" class="error">Failed to load blocks</td></tr>';
    }
}

// Load latest transactions
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE}/transactions?limit=10`);
        const transactions = await response.json();

        const tbody = document.getElementById('transactionsBody');
        tbody.innerHTML = '';

        transactions.forEach(tx => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><span class="hash clickable" onclick="viewTransaction('${tx.txid}')">${truncateHash(tx.txid, 20)}</span></td>
                <td><span class="clickable" onclick="viewBlock(${tx.blockHeight})">${formatNumber(tx.blockHeight)}</span></td>
                <td>${formatDate(tx.blockTime)}</td>
                <td>${tx.totalOutput.toFixed(8)} BAD</td>
            `;
        });
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionsBody').innerHTML = '<tr><td colspan="4" class="error">Failed to load transactions</td></tr>';
    }
}

// Search
async function search() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const resultDiv = document.getElementById('searchResult');
    resultDiv.innerHTML = '<p class="loading">Searching...</p>';
    resultDiv.classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);

        if (!response.ok) {
            resultDiv.innerHTML = '<p class="error">Not found</p>';
            return;
        }

        const result = await response.json();

        if (result.type === 'block') {
            viewBlock(result.data.height || result.data.hash);
        } else if (result.type === 'transaction') {
            viewTransaction(result.data.txid);
        } else if (result.type === 'address') {
            viewAddress(result.data.address);
        }
    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Error searching: ' + error.message + '</p>';
    }
}

// View block
async function viewBlock(identifier) {
    const resultDiv = document.getElementById('searchResult');
    resultDiv.innerHTML = '<p class="loading">Loading block...</p>';
    resultDiv.classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/block/${identifier}`);
        const block = await response.json();

        resultDiv.innerHTML = `
            <h3>Block ${formatNumber(block.height)}</h3>
            <pre>${JSON.stringify(block, null, 2)}</pre>
        `;
    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Error loading block: ' + error.message + '</p>';
    }
}

// View transaction
async function viewTransaction(txid) {
    const resultDiv = document.getElementById('searchResult');
    resultDiv.innerHTML = '<p class="loading">Loading transaction...</p>';
    resultDiv.classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/transaction/${txid}`);
        const tx = await response.json();

        resultDiv.innerHTML = `
            <h3>Transaction</h3>
            <pre>${JSON.stringify(tx, null, 2)}</pre>
        `;
    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Error loading transaction: ' + error.message + '</p>';
    }
}

// View address
async function viewAddress(address) {
    const resultDiv = document.getElementById('searchResult');
    resultDiv.innerHTML = '<p class="loading">Loading address...</p>';
    resultDiv.classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/address/${address}`);
        const addr = await response.json();

        resultDiv.innerHTML = `
            <h3>Address</h3>
            <pre>${JSON.stringify(addr, null, 2)}</pre>
        `;
    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Error loading address: ' + error.message + '</p>';
    }
}

// Search on Enter key
document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') search();
});

// Initial load
loadStatus();
loadBlocks();
loadTransactions();

// Refresh every 30 seconds
setInterval(() => {
    loadStatus();
    loadBlocks();
    loadTransactions();
}, 30000);
