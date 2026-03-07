// ============================================================================
// js/features/finances.js
// Band finances: income, expenses, starting balance, transactions.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js
// EXPOSES globals: renderFinancesPage, loadFinances, addTransaction,
//   deleteTransaction, setStartingBalance
// ============================================================================

'use strict';

// ============================================================================
// FINANCES
// ============================================================================
function renderFinancesPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>💰 Finances</h1><p>Income, expenses, and receipts</p></div>
    <div class="card-grid" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value finance-income" id="finTotalIncome">$0</div><div class="stat-label">Total Income</div></div>
        <div class="stat-card"><div class="stat-value finance-expense" id="finTotalExpenses">$0</div><div class="stat-label">Total Expenses</div></div>
        <div class="stat-card"><div class="stat-value" id="finBalance" style="color:var(--accent)">$0</div><div class="stat-label">Balance</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="addTransaction()">+ Add Transaction</button>
        <button class="btn btn-ghost" onclick="setStartingBalance()">💵 Starting Balance</button>
    </div>
    <div id="finStartBalDisplay"></div>
    <div class="app-card"><h3>Transactions</h3><div id="finTransactions"><div style="text-align:center;padding:20px;color:var(--text-dim)">No transactions yet.</div></div></div>`;
    loadFinances();
}

async function loadFinances() {
    const data = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    const meta = await loadBandDataFromDrive('_band', 'finances_meta') || {};
    const startBal = parseFloat(meta.startingBalance) || 0;
    const el = document.getElementById('finTransactions');
    if (!el) return;
    let totalIn = 0, totalOut = 0;
    data.forEach(t => { if (t.type === 'income') totalIn += parseFloat(t.amount) || 0; else totalOut += parseFloat(t.amount) || 0; });
    document.getElementById('finTotalIncome').textContent = '$' + totalIn.toFixed(2);
    document.getElementById('finTotalExpenses').textContent = '$' + totalOut.toFixed(2);
    const bal = startBal + totalIn - totalOut;
    const balEl = document.getElementById('finBalance');
    balEl.textContent = (bal >= 0 ? '$' : '-$') + Math.abs(bal).toFixed(2);
    balEl.style.color = bal >= 0 ? 'var(--green)' : 'var(--red)';
    var sbDisp = document.getElementById('finStartBalDisplay');
    if (sbDisp) {
        if (startBal !== 0) {
            sbDisp.innerHTML = '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px;padding:6px 10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px">💵 Starting balance: <strong style="color:var(--text)">$' + startBal.toFixed(2) + '</strong> <span style="opacity:0.5">(set ' + (meta.startingBalanceDate || '') + ')</span></div>';
        } else { sbDisp.innerHTML = ''; }
    }
    if (data.length === 0) return;
    data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    el.innerHTML = '<div style="display:grid;grid-template-columns:90px 1fr 80px 70px;gap:6px;padding:6px 10px;font-size:0.7em;color:var(--text-dim);font-weight:600;text-transform:uppercase"><span>Date</span><span>Description</span><span>Amount</span><span></span></div>' +
        data.map(function(t, idx) { return '<div style="display:grid;grid-template-columns:90px 1fr 80px 70px;gap:6px;padding:8px 10px;font-size:0.85em;border-bottom:1px solid var(--border);align-items:center"><span style="color:var(--text-dim)">' + (t.date || '') + '</span><span>' + (t.description || '') + '</span><span style="color:' + (t.type==='income'?'var(--green)':'var(--red)') + ';font-weight:600">' + (t.type==='income'?'+':'-') + '$' + parseFloat(t.amount||0).toFixed(2) + '</span><span style="display:flex;align-items:center;gap:4px"><span style="font-size:0.75em;color:var(--text-dim)">' + (t.category || '') + '</span><button onclick="deleteTransaction(' + idx + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.85em;padding:2px" title="Delete">🗑️</button></span></div>'; }).join('');
}

async function setStartingBalance() {
    var meta = await loadBandDataFromDrive('_band', 'finances_meta') || {};
    var current = meta.startingBalance || '';
    var el = document.getElementById('finStartBalDisplay');
    if (!el) return;
    el.innerHTML = '<div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;margin-bottom:10px"><div style="font-weight:600;font-size:0.9em;margin-bottom:8px">💵 Set Starting Balance</div><div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Enter the amount your band fund started with before tracking transactions here.</div><div class="form-grid"><div class="form-row"><label class="form-label">Amount ($)</label><input class="app-input" id="finStartBal" type="number" step="0.01" placeholder="0.00" value="' + current + '"></div></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" onclick="saveStartingBalance()">💾 Save</button><button class="btn btn-ghost" onclick="loadFinances()">Cancel</button></div></div>';
}

async function saveStartingBalance() {
    var val = document.getElementById('finStartBal')?.value;
    if (val === '' || val === undefined) { showToast('Enter an amount'); return; }
    var meta = await loadBandDataFromDrive('_band', 'finances_meta') || {};
    meta.startingBalance = val;
    meta.startingBalanceDate = new Date().toISOString().split('T')[0];
    meta.setBy = currentUserEmail;
    await saveBandDataToDrive('_band', 'finances_meta', meta);
    showToast('✅ Starting balance set!');
    loadFinances();
}

async function deleteTransaction(index) {
    var existing = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    if (index < 0 || index >= existing.length) return;
    existing.splice(index, 1);
    await saveBandDataToDrive('_band', 'finances', existing);
    showToast('🗑️ Transaction deleted');
    loadFinances();
}

function addTransaction() {
    const el = document.getElementById('finTransactions');
    el.innerHTML = `<div style="margin-bottom:16px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px">
        <div class="form-grid">
            <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="finType"><option value="income">💵 Income</option><option value="expense">💸 Expense</option></select></div>
            <div class="form-row"><label class="form-label">Amount ($)</label><input class="app-input" id="finAmount" type="number" step="0.01" placeholder="0.00"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="finDate" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-row"><label class="form-label">Category</label><select class="app-select" id="finCategory"><option value="gig_pay">Gig Pay</option><option value="merch">Merch</option><option value="tips">Tips</option><option value="equipment">Equipment</option><option value="rehearsal">Rehearsal Space</option><option value="promo">Promotion</option><option value="travel">Travel</option><option value="other">Other</option></select></div>
        </div>
        <div class="form-row"><label class="form-label">Description</label><input class="app-input" id="finDesc" placeholder="e.g. Buckhead Theatre gig pay"></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" onclick="saveTransaction()">💾 Save</button><button class="btn btn-ghost" onclick="loadFinances()">Cancel</button></div>
    </div>` + el.innerHTML;
}

async function saveTransaction() {
    const t = { type: document.getElementById('finType')?.value, amount: document.getElementById('finAmount')?.value,
        date: document.getElementById('finDate')?.value, category: document.getElementById('finCategory')?.value,
        description: document.getElementById('finDesc')?.value, created: new Date().toISOString() };
    if (!t.amount) { alert('Amount required'); return; }
    const existing = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    existing.push(t);
    await saveBandDataToDrive('_band', 'finances', existing);
    alert('✅ Transaction saved!');
    loadFinances();
}

// ── Window exports (called from inline HTML onclick handlers) ──────────────
window.renderFinancesPage = renderFinancesPage;
window.loadFinances = loadFinances;
window.setStartingBalance = setStartingBalance;
window.saveStartingBalance = saveStartingBalance;
window.deleteTransaction = deleteTransaction;
window.addTransaction = addTransaction;
window.saveTransaction = saveTransaction;
