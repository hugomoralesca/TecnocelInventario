// ── Estado ──
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

// Productos de ejemplo
const defaultProducts = [
  {id:1,name:'iPhone 15 Pro',category:'Celular',qty:8,threshold:5,price:1299},
  {id:2,name:'Samsung Galaxy S24',category:'Celular',qty:3,threshold:5,price:999},
  {id:3,name:'Funda iPhone 15 (Transparente)',category:'Accesorio',qty:2,threshold:10,price:29},
  {id:4,name:'Cargador rápido USB-C 65W',category:'Cargador',qty:15,threshold:8,price:45},
  {id:5,name:'Protector de pantalla - Universal',category:'Protector',qty:1,threshold:12,price:18},
  {id:6,name:'Base de carga inalámbrica',category:'Cargador',qty:6,threshold:5,price:39},
  {id:7,name:'AirPods Pro 2',category:'Accesorio',qty:4,threshold:4,price:249},
  {id:8,name:'Cartera MagSafe',category:'Accesorio',qty:0,threshold:5,price:59},
  {id:9,name:'Cargador Samsung 45W',category:'Cargador',qty:11,threshold:6,price:52},
  {id:10,name:'Cristal templado – iPhone 15',category:'Protector',qty:7,threshold:10,price:22},
];

// ── Almacenamiento ──
function loadData() {
  try { products = JSON.parse(localStorage.getItem(KEYS.products)) || defaultProducts; } catch(e) { products = defaultProducts; }
  try { messages = JSON.parse(localStorage.getItem(KEYS.messages)) || []; } catch(e) { messages = []; }
  try { sales = JSON.parse(localStorage.getItem(KEYS.sales)) || []; } catch(e) { sales = []; }
  try { orders = JSON.parse(localStorage.getItem(KEYS.orders)) || []; } catch(e) { orders = []; }
}

function save(key, data) {
  localStorage.setItem(KEYS[key], JSON.stringify(data));
}

// ── Autenticación ──
function login(role) {
  currentRole = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-chip').textContent = role === 'owner' ? 'Dueño / Personal' : 'Proveedor';
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

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !e.target.closest('.menu-btn')) {
      sidebar.classList.remove('open');
    }
  }
});

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  const titles = {
    dashboard: 'Panel Principal', inventory: 'Inventario', sales: 'Historial de Ventas',
    orders: 'Seguimiento de Pedidos', chat: currentRole === 'owner' ? 'Chat con Proveedor' : 'Chat con la Tienda',
    'supplier-stock': 'Alertas de Stock', 'supplier-orders': 'Pedidos por Surtir'
  };
  document.getElementById('page-title').textContent = titles[tab] || tab;
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  render();
}

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

function getStatus(p) {
  if (p.qty === 0) return 'out';
  if (p.qty <= p.threshold * 0.5) return 'critical';
  if (p.qty <= p.threshold) return 'low';
  return 'ok';
}

function statusBadge(p) {
  const s = getStatus(p);
  if (s === 'out') return '<span class="badge danger">Agotado</span>';
  if (s === 'critical') return '<span class="badge danger">Crítico</span>';
  if (s === 'low') return '<span class="badge low">Bajo Stock</span>';
  return '<span class="badge ok">Surtido</span>';
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

// ── VISTAS (RENDERS) ──
function renderDashboard() {
  const alerts = products.filter(p => getStatus(p) !== 'ok');
  const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
  const todayStr = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.ts).toDateString() === todayStr).reduce((a,s)=>a+s.total,0);
  const pendingOrders = orders.filter(o => o.status !== 'delivered').length;

  const alertRows = alerts.length === 0
    ? `<div class="empty"><div class="empty-icon">✓</div><div class="empty-text">Todo surtido</div></div>`
    : alerts.sort((a,b) => a.qty - b.qty).map(p => `
      <div class="alert-item">
        ${alertDot(p)}
        <div class="alert-info">
          <div class="alert-name">${p.name}</div>
          <div class="alert-meta">${p.category} · Mín: ${p.threshold}</div>
        </div>
        <div class="alert-qty">${p.qty}</div>
        <button class="btn sm" onclick="sendRestockRequest(${p.id})">Pedir ↗</button>
      </div>`).join('');

  const recentSales = sales.slice(-6).reverse().map(s => `
      <div class="sale-row">
        <div class="sale-product">${s.productName}</div>
        <div class="sale-amount">${fmt$(s.total)}</div>
      </div>`).join('');

  return `
    <div class="metrics-grid">
      <div class="metric-card accent"><div class="metric-label">Ingresos</div><div class="metric-value">${fmt$(totalRevenue)}</div></div>
      <div class="metric-card success"><div class="metric-label">Hoy</div><div class="metric-value">${fmt$(todaySales)}</div></div>
      <div class="metric-card warning"><div class="metric-label">Alertas</div><div class="metric-value">${alerts.length}</div></div>
    </div>
    <div class="two-col">
      <div><div class="section-label">Alertas</div><div class="card">${alertRows}</div></div>
      <div><div class="section-label">Ventas</div><div class="card">${recentSales || 'Sin ventas'}</div></div>
    </div>`;
}

function renderInventory() {
  const rows = products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td><span class="cat-tag">${p.category}</span></td>
      <td><input class="qty-input" type="number" value="${p.qty}" onchange="updateField(${p.id},'qty',this.value)"/></td>
      <td>${fmt$(p.price)}</td>
      <td>${statusBadge(p)}</td>
      <td><button class="btn sm primary" onclick="recordSale(${p.id})">Vender</button></td>
    </tr>`).join('');
  return `<div class="card"><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Cat.</th><th>Stock</th><th>Precio</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderSales() {
  const history = sales.slice().reverse().map(s => `<tr><td>${s.date}</td><td>${s.productName}</td><td>${s.qty}</td><td>${fmt$(s.total)}</td></tr>`).join('');
  return `<div class="card"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Total</th></tr></thead><tbody>${history}</tbody></table></div></div>`;
}

function renderOrders() {
  const cards = orders.slice().reverse().map(o => `
    <div class="order-card">
      <div class="order-title">${o.productName} (#${o.id})</div>
      <div class="order-meta">Cantidad: ${o.qtyOrdered} · Estado: ${o.status}</div>
      ${o.status !== 'delivered' ? `<button class="btn sm" onclick="updateOrderStatus(${o.id},'delivered')">Marcar Entregado</button>` : ''}
    </div>`).join('');
  return `<div class="section-label">Pedidos</div>${cards || 'No hay pedidos'}`;
}

function renderChat() {
  const msgHtml = messages.map(m => `<div class="msg-wrap ${m.from === currentRole ? 'mine' : 'theirs'}"><div class="msg-bubble">${m.text}</div></div>`).join('');
  return `<div class="card chat-layout"><div class="messages-list" id="msg-list">${msgHtml}</div><div class="chat-input-bar"><input id="chat-input" placeholder="Mensaje..."/><button class="btn primary" onclick="sendMsg()">Enviar</button></div></div>`;
}

function renderSupplierStock() {
  const low = products.filter(p => getStatus(p) !== 'ok').map(p => `<div class="alert-item">${p.name} - Stock: ${p.qty}</div>`).join('');
  return `<div class="section-label">Alertas para Proveedor</div><div class="card">${low || 'Todo surtido'}</div>`;
}

function renderSupplierOrders() {
  const pending = orders.filter(o => o.status !== 'delivered').map(o => `
    <div class="alert-item">
      <div>${o.productName} (${o.qtyOrdered} unidades)</div>
      <button class="btn sm primary" onclick="updateOrderStatus(${o.id},'shipped')">Enviar</button>
    </div>`).join('');
  return `<div class="section-label">Pedidos Pendientes</div><div class="card">${pending || 'Sin pedidos'}</div>`;
}

// ── ACCIONES ──
function updateField(id, field, value) {
  const p = products.find(x => x.id === id);
  if (p) p[field] = parseInt(value) || 0;
  save('products', products);
}

function recordSale(id) {
  const p = products.find(x => x.id === id);
  if (p && p.qty > 0) {
    p.qty--;
    sales.push({ id: Date.now(), productName: p.name, qty: 1, total: p.price, date: nowDate(), ts: Date.now() });
    save('products', products); save('sales', sales); render();
  } else { alert("Sin stock"); }
}

function sendRestockRequest(id) {
  const p = products.find(x => x.id === id);
  const orderId = Date.now();
  orders.push({ id: orderId, productId: p.id, productName: p.name, qtyOrdered: p.threshold * 2, status: 'pending', date: nowDate() });
  messages.push({ from: 'owner', text: `Pedido: ${p.name}`, time: nowTime() });
  save('orders', orders); save('messages', messages); showTab('chat');
}

function updateOrderStatus(id, status) {
  const o = orders.find(x => x.id === id);
  if (o) {
    o.status = status;
    if (status === 'delivered') {
      const p = products.find(x => x.id === o.productId);
      if (p) p.qty += o.qtyOrdered;
    }
    save('orders', orders); save('products', products); render();
  }
}

function sendMsg() {
  const input = document.getElementById('chat-input');
  if (input.value) {
    messages.push({ from: currentRole, text: input.value, time: nowTime() });
    save('messages', messages); input.value = ''; render();
  }
}

function exportXLSX() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(products);
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, "Inventario.xlsx");
}

function bindEvents() {}

// ── Inicio ──
loadData();
