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

// Productos de ejemplo traducidos
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

// ── Autenticación (Roles) ──
function login(role) {
  currentRole = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-chip').textContent = role === 'owner' ? 'Dueño / Personal' : 'Proveedor';
  document.getElementById('owner-nav').classList.toggle('hidden', role !== 'owner');
  document.getElementById('supplier-nav').classList.toggle('hidden', role !== 'supplier');
  document.getElementById('export-btn').classList.toggle('hidden', role !== 'owner');
  currentTab = role === 'owner' ? 'dashboard': 'supplier-stock';
  render();
}

function logout() {
  currentRole = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── Barra Lateral ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Cerrar sidebar al hacer clic fuera (móvil)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !e.target.closest('.menu-btn')) {
      sidebar.classList.remove('open');
    }
  }
});

// ── Navegación de pestañas ──
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  const titles = {
    dashboard: 'Panel Principal', 
    inventory: 'Inventario', 
    sales: 'Historial de Ventas',
    orders: 'Seguimiento de Pedidos', 
    chat: currentRole === 'owner' ? 'Chat con Proveedor' : 'Chat con la Tienda',
    'supplier-stock': 'Alertas de Stock', 
    'supplier-orders': 'Pedidos por Surtir'
  };
  document.getElementById('page-title').textContent = titles[tab] || tab;
  
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  render();
}

// ── Renderizado ──
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

// ── Ayudantes de Estado ──
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

// ── PANEL PRINCIPAL (DASHBOARD) ──
function renderDashboard() {
  const alerts = products.filter(p => getStatus(p) !== 'ok');
  const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
  const todayStr = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.ts).toDateString() === todayStr).reduce((a,s)=>a+s.total,0);
  const pendingOrders = orders.filter(o => o.status !== 'delivered').length;

  const alertRows = alerts.length === 0
    ? `<div class="empty"><div class="empty-icon">✓</div><div class="empty-text">Todo el inventario está surtido</div></div>`
    : alerts.sort((a,b) => a.qty - b.qty).map(p => `
      <div class="alert-item">
        ${alertDot(p)}
        <div class="alert-info">
          <div class="alert-name">${p.name}</div>
          <div class="alert-meta">${p.category} · Mínimo: ${p.threshold} unidades</div>
        </div>
        <div class="alert-qty ${getStatus(p)==='ok'?'':getStatus(p)==='low'?'':'danger-text'}">${p.qty}</div>
        ${statusBadge(p)}
        <button class="btn sm" onclick="sendRestockRequest(${p.id})">Pedir resurtido ↗</button>
      </div>`).join('');

  const recentSales = sales.slice(-6).reverse();
  const salesRows = recentSales.length === 0
    ? `<div class="empty"><div class="empty-icon">↗</div><div class="empty-text">No hay ventas registradas</div></div>`
