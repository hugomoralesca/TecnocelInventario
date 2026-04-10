// ── State ──
let currentRole = null;
let currentTab = 'dashboard';
let products = [];
let messages = [];
let sales = [];
let orders = [];

const KEYS = {
  products: 'ss_products',
  messages: 'ss_messages',
  sales: 'ss_sales',
  orders: 'ss_orders',
};

const defaultProducts = [
  {id:1,name:'iPhone 15 Pro',category:'Phone',qty:8,threshold:5,price:1299},
  {id:2,name:'Samsung Galaxy S24',category:'Phone',qty:3,threshold:5,price:999},
  {id:3,name:'iPhone 15 case (clear)',category:'Accessory',qty:2,threshold:10,price:29},
  {id:4,name:'USB-C fast charger 65W',category:'Charger',qty:15,threshold:8,price:45},
  {id:5,name:'Screen protector – universal',category:'Protector',qty:1,threshold:12,price:18},
  {id:6,name:'Wireless charging pad',category:'Charger',qty:6,threshold:5,price:39},
  {id:7,name:'AirPods Pro 2',category:'Accessory',qty:4,threshold:4,price:249},
  {id:8,name:'MagSafe wallet',category:'Accessory',qty:0,threshold:5,price:59},
  {id:9,name:'Samsung 45W charger',category:'Charger',qty:11,threshold:6,price:52},
  {id:10,name:'Tempered glass – iPhone 15',category:'Protector',qty:7,threshold:10,price:22},
];

// ── Storage ──
function loadData() {
  try { products = JSON.parse(localStorage.getItem(KEYS.products)) || defaultProducts; } catch(e) { products = defaultProducts; }
  try { messages = JSON.parse(localStorage.getItem(KEYS.messages)) || []; } catch(e) { messages = []; }
  try { sales = JSON.parse(localStorage.getItem(KEYS.sales)) || []; } catch(e) { sales = []; }
  try { orders = JSON.parse(localStorage.getItem(KEYS.orders)) || []; } catch(e) { orders = []; }
}

function save(key, data) {
  localStorage.setItem(KEYS[key], JSON.stringify(data));
}

// ── Auth ──
function login(role) {
  currentRole = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-chip').textContent = role === 'owner' ? 'Owner / Staff' : 'Supplier';
  document.getElementById('owner-nav').classList.toggle('hidden', role !== 'owner');
  document.getElementById('supplier-nav').classList.toggle('hidden', role !== 'supplier');
  document.getElementById('export-btn').classList.toggle('hidden', role !== 'owner');
  currentTab = role === 'owner' ? 'dashboard' : 'supplier-stock';
  render();
}

function logout() {
  currentRole = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── Sidebar ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Close sidebar on nav click (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !e.target.closest('.menu-btn')) {
      sidebar.classList.remove('open');
    }
  }
});

// ── Tab routing ──
function showTab(tab) {
  currentTab = tab;
  // Sidebar highlight
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  // Page title map
  const titles = {
    dashboard: 'Dashboard', inventory: 'Inventory', sales: 'Sales history',
    orders: 'Order tracking', chat: currentRole === 'owner' ? 'Supplier chat' : 'Chat with store',
    'supplier-stock': 'Stock alerts', 'supplier-orders': 'Orders to fulfill'
  };
  document.getElementById('page-title').textContent = titles[tab] || tab;
  // Close sidebar on mobile
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  render();
}

// ── Render dispatcher ──
function render() {
  updateUnreadBadge();
  const c = document.getElementById('page-content');
  const map = {
    dashboard: renderDashboard,
    inventory: renderInventory,
    sales: renderSales,
    orders: renderOrders,
    chat: renderChat,
    'supplier-stock': renderSupplierStock,
    'supplier-orders': renderSupplierOrders,
  };
  c.innerHTML = (map[currentTab] || renderDashboard)();
  bindEvents();
}

function updateUnreadBadge() {
  const unread = messages.filter(m => m.from !== currentRole).length;
  ['unread-count','unread-count-s'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = unread > 0 ? 'inline' : 'none';
    el.textContent = unread;
  });
}

// ── Status helpers ──
function getStatus(p) {
  if (p.qty === 0) return 'out';
  if (p.qty <= p.threshold * 0.5) return 'critical';
  if (p.qty <= p.threshold) return 'low';
  return 'ok';
}

function statusBadge(p) {
  const s = getStatus(p);
  if (s === 'out') return '<span class="badge danger">Out of stock</span>';
  if (s === 'critical') return '<span class="badge danger">Critical</span>';
  if (s === 'low') return '<span class="badge low">Low stock</span>';
  return '<span class="badge ok">In stock</span>';
}

function alertDot(p) {
  const s = getStatus(p);
  if (s === 'out' || s === 'critical') return '<span class="alert-dot dot-danger"></span>';
  if (s === 'low') return '<span class="alert-dot dot-low"></span>';
  return '<span class="alert-dot dot-ok"></span>';
}

function nowTime() { return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function nowDate() { return new Date().toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'}); }
function fmt$(n) { return '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}); }

// ── DASHBOARD ──
function renderDashboard() {
  const alerts = products.filter(p => getStatus(p) !== 'ok');
  const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
  const todayStr = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.ts).toDateString() === todayStr).reduce((a,s)=>a+s.total,0);
  const pendingOrders = orders.filter(o => o.status !== 'delivered').length;

  const alertRows = alerts.length === 0
    ? `<div class="empty"><div class="empty-icon">✓</div><div class="empty-text">All products are well stocked</div></div>`
    : alerts.sort((a,b) => a.qty - b.qty).map(p => `
      <div class="alert-item">
        ${alertDot(p)}
        <div class="alert-info">
          <div class="alert-name">${p.name}</div>
          <div class="alert-meta">${p.category} · Min: ${p.threshold} units</div>
        </div>
        <div class="alert-qty ${getStatus(p)==='ok'?'':getStatus(p)==='low'?'':'danger-text'}">${p.qty}</div>
        ${statusBadge(p)}
        <button class="btn sm" onclick="sendRestockRequest(${p.id})">Request restock ↗</button>
      </div>`).join('');

  const recentSales = sales.slice(-6).reverse();
  const salesRows = recentSales.length === 0
    ? `<div class="empty"><div class="empty-icon">↗</div><div class="empty-text">No sales logged yet</div></div>`
    : recentSales.map(s => `
      <div class="sale-row">
        <div class="sale-product">${s.productName}</div>
        <span class="cat-tag">${s.qty}×</span>
        <div class="sale-amount">${fmt$(s.total)}</div>
        <div class="sale-date">${s.date}</div>
      </div>`).join('');

  return `
    <div class="metrics-grid">
      <div class="metric-card accent">
        <div class="metric-label">Total revenue</div>
        <div class="metric-value accent">${fmt$(totalRevenue)}</div>
      </div>
      <div class="metric-card success">
        <div class="metric-label">Today's sales</div>
        <div class="metric-value success">${fmt$(todaySales)}</div>
      </div>
      <div class="metric-card ${alerts.length > 0 ? 'warning':''}">
        <div class="metric-label">Stock alerts</div>
        <div class="metric-value ${alerts.length > 0 ? 'warning':'success'}">${alerts.length}</div>
      </div>
      <div class="metric-card ${pendingOrders > 0 ? 'warning':''}">
        <div class="metric-label">Pending orders</div>
        <div class="metric-value ${pendingOrders > 0 ? 'warning':'success'}">${pendingOrders}</div>
      </div>
    </div>
    <div class="two-col">
      <div>
        <div class="section-label">Stock alerts</div>
        <div class="card"><div class="alert-list">${alertRows}</div></div>
      </div>
      <div>
        <div class="section-label">Recent sales</div>
        <div class="card">${salesRows}</div>
      </div>
    </div>`;
}

// ── INVENTORY ──
function renderInventory() {
  const rows = products.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${alertDot(p)}
          <span style="font-weight:500">${p.name}</span>
        </div>
      </td>
      <td><span class="cat-tag">${p.category}</span></td>
      <td><input class="qty-input" type="number" min="0" value="${p.qty}" onchange="updateField(${p.id},'qty',this.value)"/></td>
      <td><input class="qty-input" type="number" min="1" value="${p.threshold}" onchange="updateField(${p.id},'threshold',this.value)"/></td>
      <td><input class="qty-input" type="number" min="0" step="0.01" value="${p.price}" onchange="updateField(${p.id},'price',this.value)" style="width:90px"/></td>
      <td>${statusBadge(p)}</td>
      <td>
        <div class="btn-group">
          <input class="qty-input" type="number" min="1" value="1" id="sell-${p.id}" style="width:55px"/>
          <button class="btn sm primary" onclick="recordSale(${p.id})">Sell</button>
          <button class="btn sm danger" onclick="removeProduct(${p.id})">✕</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">Add new product</span></div>
      <div class="card-body">
        <div class="form-row cols-4">
          <div class="form-group"><label>Product name</label><input id="np-name" placeholder="e.g. iPhone 15 Pro Max case"/></div>
          <div class="form-group"><label>Category</label>
            <select id="np-cat">
              <option>Phone</option><option>Charger</option><option>Protector</option><option>Accessory</option>
            </select>
          </div>
          <div class="form-group"><label>Qty / Min stock</label>
            <div style="display:flex;gap:8px">
              <input id="np-qty" type="number" min="0" placeholder="Qty" style="width:50%"/>
              <input id="np-thr" type="number" min="1" placeholder="Min" style="width:50%"/>
            </div>
          </div>
          <div class="form-group"><label>Price ($)</label><input id="np-price" type="number" min="0" step="0.01" placeholder="0.00"/></div>
        </div>
        <button class="btn primary" onclick="addProduct()">+ Add product</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Product</th><th>Category</th><th>Qty in stock</th><th>Min stock</th><th>Price ($)</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── SALES ──
function renderSales() {
  const totalRevenue = sales.reduce((a,s) => a+s.total, 0);
  const totalUnits = sales.reduce((a,s) => a+s.qty, 0);

  const byProduct = {};
  sales.forEach(s => {
    if (!byProduct[s.productName]) byProduct[s.productName] = {qty:0, revenue:0};
    byProduct[s.productName].qty += s.qty;
    byProduct[s.productName].revenue += s.total;
  });
  const top = Object.entries(byProduct).sort((a,b) => b[1].revenue - a[1].revenue).slice(0,5);

  const topRows = top.length === 0
    ? `<div class="empty"><div class="empty-text">No sales yet</div></div>`
    : top.map(([name, d]) => `
      <div class="sale-row">
        <div class="sale-product">${name}</div>
        <div style="color:var(--text2);font-size:12px">${d.qty} units</div>
        <div class="sale-amount">${fmt$(d.revenue)}</div>
      </div>`).join('');

  const historyRows = sales.length === 0
    ? `<tr><td colspan="6"><div class="empty"><div class="empty-text">No sales recorded yet</div></div></td></tr>`
    : sales.slice().reverse().map(s => `
      <tr>
        <td style="color:var(--text2);font-size:12px">${s.date}</td>
        <td style="font-weight:500">${s.productName}</td>
        <td><span class="cat-tag">${s.category}</span></td>
        <td style="font-family:var(--mono)">${s.qty}</td>
        <td style="font-family:var(--mono)">${fmt$(s.unitPrice)}</td>
        <td style="font-family:var(--mono);color:var(--success);font-weight:600">${fmt$(s.total)}</td>
      </tr>`).join('');

  return `
    <div class="metrics-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="metric-card accent"><div class="metric-label">Total revenue</div><div class="metric-value accent">${fmt$(totalRevenue)}</div></div>
      <div class="metric-card"><div class="metric-label">Units sold</div><div class="metric-value">${totalUnits}</div></div>
      <div class="metric-card"><div class="metric-label">Transactions</div><div class="metric-value">${sales.length}</div></div>
    </div>
    <div class="two-col">
      <div>
        <div class="section-label">Top products by revenue</div>
        <div class="card">${topRows}</div>
        <div class="section-label" style="margin-top:20px">Quick sale</div>
        <div class="card">
          <div class="card-body">
            <div class="form-row cols-2">
              <div class="form-group"><label>Product</label>
                <select id="qs-product">${products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>
              </div>
              <div class="form-group"><label>Quantity</label><input id="qs-qty" type="number" min="1" value="1"/></div>
            </div>
            <button class="btn primary" onclick="quickSale()">Log sale</button>
          </div>
        </div>
      </div>
      <div>
        <div class="section-label">Full sales history</div>
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
              <tbody>${historyRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}

// ── ORDERS ──
function renderOrders() {
  const statusOrder = {pending:0, confirmed:1, shipped:2, delivered:3};
  const steps = ['Pending','Confirmed','Shipped','Delivered'];

  const counts = ['pending','confirmed','shipped','delivered'].map(s =>
    `<div class="metric-card"><div class="metric-label">${s.charAt(0).toUpperCase()+s.slice(1)}</div><div class="metric-value">${orders.filter(o=>o.status===s).length}</div></div>`
  ).join('');

  const orderCards = orders.slice().reverse().map(o => {
    const step = statusOrder[o.status];
    const pct = Math.round((step/3)*100);
    const nextActions = {
      pending: `<button class="btn sm" onclick="updateOrderStatus(${o.id},'confirmed')">Mark confirmed</button>`,
      confirmed: `<button class="btn sm" onclick="updateOrderStatus(${o.id},'shipped')">Mark shipped</button>`,
      shipped: `<button class="btn sm primary" onclick="updateOrderStatus(${o.id},'delivered')">Mark delivered</button>`,
      delivered: ''
    };
    const stepLabels = steps.map((s,i) =>
      `<span class="progress-step ${i < step ? 'done' : i === step ? 'current' : ''}">${s}</span>`
    ).join('');
    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <div class="order-title">${o.productName}</div>
            <div class="order-meta">Order #${o.id} · ${o.qtyOrdered} units · Placed ${o.date}</div>
          </div>
          <span class="badge ${o.status==='delivered'?'ok':o.status==='shipped'?'info':'gray'}">${o.status.charAt(0).toUpperCase()+o.status.slice(1)}</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-steps">${stepLabels}</div>
        </div>
        ${nextActions[o.status] ? `<div class="order-actions">${nextActions[o.status]}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="metrics-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${counts}</div>
    <div class="section-label">All orders</div>
    ${orders.length === 0
      ? `<div class="card"><div class="empty"><div class="empty-icon">⊡</div><div class="empty-text">No orders yet. Use "Request restock" from the dashboard.</div></div></div>`
      : orderCards}`;
}

// ── CHAT ──
function renderChat() {
  const msgHtml = messages.length === 0
    ? `<div class="empty" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column"><div class="empty-icon">◎</div><div class="empty-text">No messages yet. Start the conversation.</div></div>`
    : messages.map(m => `
      <div class="msg-wrap ${m.from === currentRole ? 'mine' : 'theirs'}">
        <div class="msg-bubble">${m.text}</div>
        <div class="msg-time">${m.from === 'owner' ? 'Store' : 'Supplier'} · ${m.time}</div>
      </div>`).join('');

  return `
    <div class="card chat-layout">
      <div class="messages-list" id="msg-list">${msgHtml}</div>
      <div class="chat-input-bar">
        <input id="chat-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendMsg()"/>
        <button class="btn primary" onclick="sendMsg()">Send</button>
      </div>
    </div>`;
}

// ── SUPPLIER: STOCK ──
function renderSupplierStock() {
  const alerts = products.filter(p => getStatus(p) !== 'ok');
  const critical = alerts.filter(p => getStatus(p) === 'out' || getStatus(p) === 'critical');
  const low = alerts.filter(p => getStatus(p) === 'low');

  const makeSection = (title, items) => {
    if (!items.length) return '';
    return `
      <div class="section-label">${title}</div>
      <div class="card">
        <div class="alert-list">
          ${items.map(p => `
            <div class="alert-item">
              ${alertDot(p)}
              <div class="alert-info">
                <div class="alert-name">${p.name}</div>
                <div class="alert-meta">${p.category}</div>
              </div>
              <div class="alert-qty">${p.qty} <span style="color:var(--text3);font-size:11px">/ ${p.threshold} min</span></div>
              ${statusBadge(p)}
            </div>`).join('')}
        </div>
      </div>`;
  };

  return `
    <div class="metrics-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="metric-card danger"><div class="metric-label">Urgent restock</div><div class="metric-value danger">${critical.length}</div></div>
      <div class="metric-card warning"><div class="metric-label">Running low</div><div class="metric-value warning">${low.length}</div></div>
      <div class="metric-card"><div class="metric-label">Products tracked</div><div class="metric-value">${products.length}</div></div>
    </div>
    ${alerts.length === 0 ? `<div class="card"><div class="empty"><div class="empty-icon">✓</div><div class="empty-text">Everything is well stocked.</div></div></div>` : ''}
    ${makeSection('Urgent — out of stock or critical', critical)}
    ${makeSection('Running low', low)}`;
}

// ── SUPPLIER: ORDERS ──
function renderSupplierOrders() {
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const done = orders.filter(o => o.status === 'shipped' || o.status === 'delivered');

  const card = o => `
    <div class="alert-item">
      <div class="alert-info">
        <div class="alert-name">${o.productName}</div>
        <div class="alert-meta">Order #${o.id} · ${o.qtyOrdered} units · ${o.date}</div>
      </div>
      <span class="badge ${o.status==='delivered'?'ok':o.status==='shipped'?'info':'gray'}">${o.status.charAt(0).toUpperCase()+o.status.slice(1)}</span>
      ${o.status==='pending' ? `<button class="btn sm" onclick="supplierConfirm(${o.id})">Confirm</button>` : ''}
      ${o.status==='confirmed' ? `<button class="btn sm primary" onclick="supplierShip(${o.id})">Mark shipped</button>` : ''}
    </div>`;

  return `
    <div class="section-label">Orders to action</div>
    <div class="card">
      <div class="alert-list">
        ${pending.length === 0
          ? `<div class="empty"><div class="empty-text">No pending orders.</div></div>`
          : pending.map(card).join('')}
      </div>
    </div>
    <div class="section-label" style="margin-top:20px">Completed orders</div>
    <div class="card">
      <div class="alert-list">
        ${done.length === 0
          ? `<div class="empty"><div class="empty-text">No completed orders yet.</div></div>`
          : done.map(card).join('')}
      </div>
    </div>`;
}

// ── Actions ──
function updateField(id, field, value) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (field === 'qty') p.qty = Math.max(0, parseInt(value) || 0);
  if (field === 'threshold') p.threshold = Math.max(1, parseInt(value) || 1);
  if (field === 'price') p.price = Math.max(0, parseFloat(value) || 0);
  save('products', products);
  updateUnreadBadge();
}

function removeProduct(id) {
  if (!confirm('Remove this product?')) return;
  products = products.filter(x => x.id !== id);
  save('products', products);
  render();
}

function addProduct() {
  const name = document.getElementById('np-name').value.trim();
  const cat = document.getElementById('np-cat').value;
  const qty = parseInt(document.getElementById('np-qty').value) || 0;
  const thr = parseInt(document.getElementById('np-thr').value) || 5;
  const price = parseFloat(document.getElementById('np-price').value) || 0;
  if (!name) { alert('Please enter a product name.'); return; }
  products.push({ id: Date.now(), name, category: cat, qty, threshold: thr, price });
  save('products', products);
  render();
}

function recordSale(id) {
  const p = products.find(x => x.id === id);
  const qtyEl = document.getElementById('sell-' + id);
  const qty = parseInt(qtyEl?.value) || 1;
  if (!p) return;
  if (qty > p.qty) { alert(`Only ${p.qty} units in stock.`); return; }
  p.qty -= qty;
  sales.push({ id: Date.now(), productId: p.id, productName: p.name, category: p.category, qty, unitPrice: p.price, total: qty * p.price, date: nowDate(), ts: Date.now() });
  save('products', products);
  save('sales', sales);
  render();
}

function quickSale() {
  const id = parseInt(document.getElementById('qs-product').value);
  const qty = parseInt(document.getElementById('qs-qty').value) || 1;
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (qty > p.qty) { alert(`Only ${p.qty} units in stock.`); return; }
  p.qty -= qty;
  sales.push({ id: Date.now(), productId: p.id, productName: p.name, category: p.category, qty, unitPrice: p.price, total: qty * p.price, date: nowDate(), ts: Date.now() });
  save('products', products);
  save('sales', sales);
  render();
}

function sendRestockRequest(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const suggestedQty = Math.max(p.threshold * 2 - p.qty, p.threshold);
  const orderId = Date.now();
  orders.push({ id: orderId, productId: p.id, productName: p.name, category: p.category, qtyOrdered: suggestedQty, status: 'pending', date: nowDate() });
  const text = `Hi! We need a restock for "${p.name}" — we currently have ${p.qty} units (minimum: ${p.threshold}). Requesting ${suggestedQty} units. Order #${orderId}. Please confirm availability and estimated delivery.`;
  messages.push({ from: 'owner', text, time: nowTime() });
  save('orders', orders);
  save('messages', messages);
  showTab('chat');
}

function updateOrderStatus(id, newStatus) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  o.status = newStatus;
  if (newStatus === 'delivered') {
    const p = products.find(x => x.id === o.productId);
    if (p) p.qty += o.qtyOrdered;
    messages.push({ from: currentRole, text: `Order #${o.id} for "${o.productName}" (${o.qtyOrdered} units) has been delivered. Inventory updated.`, time: nowTime() });
    save('products', products);
    save('messages', messages);
  }
  save('orders', orders);
  render();
}

function supplierConfirm(id) { updateOrderStatus(id, 'confirmed'); }
function supplierShip(id) { updateOrderStatus(id, 'shipped'); }

function sendMsg() {
  const input = document.getElementById('chat-input');
  const text = input?.value?.trim();
  if (!text) return;
  messages.push({ from: currentRole, text, time: nowTime() });
  save('messages', messages);
  input.value = '';
  render();
  setTimeout(() => {
    const ml = document.getElementById('msg-list');
    if (ml) ml.scrollTop = ml.scrollHeight;
  }, 30);
}

// ── EXPORT ──
function exportXLSX() {
  const wb = XLSX.utils.book_new();
  const inv = [['Product','Category','Qty','Min stock','Price ($)','Status'],
    ...products.map(p => [p.name, p.category, p.qty, p.threshold, p.price, getStatus(p)==='ok'?'In stock':getStatus(p)==='low'?'Low':getStatus(p)==='critical'?'Critical':'Out of stock'])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inv), 'Inventory');
  if (sales.length) {
    const s = [['Date','Product','Category','Qty','Unit price','Total'], ...sales.map(s=>[s.date,s.productName,s.category,s.qty,s.unitPrice,s.total])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s), 'Sales');
  }
  if (orders.length) {
    const o = [['Order #','Product','Category','Qty ordered','Date','Status'], ...orders.map(o=>[o.id,o.productName,o.category,o.qtyOrdered,o.date,o.status])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(o), 'Orders');
  }
  XLSX.writeFile(wb, 'StockSync_' + new Date().toISOString().slice(0,10) + '.xlsx');
}

// ── Bind dynamic events ──
function bindEvents() {
  if (currentTab === 'chat') {
    setTimeout(() => {
      const ml = document.getElementById('msg-list');
      if (ml) ml.scrollTop = ml.scrollHeight;
    }, 30);
  }
}

// ── Init ──
loadData();
