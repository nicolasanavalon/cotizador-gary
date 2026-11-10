/* Cotizador Gary — v0.1
 * Todo vive en el navegador por ahora (localStorage). La capa `Store` está aislada
 * para cambiarla después por la nube sin tocar el resto.
 */
'use strict';

/* ---------------- Datos base ---------------- */
const IVA = 0.19;
const MARGENES_RAPIDOS = [20, 30, 40, 50];

const TIPOS_DEF = [
  'Pabellón nacional (estrellas) 1/Faz',
  'Pabellón nacional (estrellas) 2/Faz',
  'Bandera normal (uniones) 1/Faz',
  'Bandera con aplicación',
  'Bandera sublimada 2/Faz',
  'GMF',
  'GMT',
  'Cuadra',
  'Bandera especial (c/estrellas, Magallanes, Viña, etc.)',
];
const MATERIALES_DEF = ['Raso', 'Bistrech', 'Microperforado', 'Oxford', 'Raquelado'];
const CONDICIONES_PAGO = [
  'Crédito a 7 días', 'Crédito a 15 días', 'Crédito a 30 días', 'Transferencia anticipada',
  '50% anticipo y 50% contra entrega', '100% contra entrega',
];
const REGIONES = ['Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
  'Metropolitana', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos',
  'Aysén', 'Magallanes'];
/* Feriados nacionales (para contar días hábiles). */
const FERIADOS = new Set([
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-21', '2026-06-29', '2026-07-16',
  '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
  '2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21', '2027-06-21', '2027-06-28', '2027-07-16',
  '2027-08-15', '2027-09-18', '2027-09-19', '2027-10-11', '2027-10-31', '2027-11-01', '2027-12-08', '2027-12-25',
]);

const CONFIG_DEF = {
  empresa: 'Taller Gary', rutEmpresa: '', giro: 'Confección de banderas', dirEmpresa: '',
  fonoEmpresa: '', mailEmpresa: '',
  condPago: '', plazo: '', validez: '',
  margenDef: 40, redondeo: 100, nextCot: 1, nextOt: 1,
  tipos: TIPOS_DEF, materiales: MATERIALES_DEF,
};

/* Matriz de EJEMPLO: costo ≈ área × $/m² del material × factor del tipo + base. */
function matrizEjemplo() {
  const medidas = ['0,90 x 0,60', '1,35 x 0,90', '1,80 x 1,20', '2,25 x 1,50', '3,00 x 2,00'];
  const m2 = { 'Raso': 6500, 'Bistrech': 4200, 'Microperforado': 5200, 'Oxford': 5600, 'Raquelado': 4800 };
  const tipos = [
    [TIPOS_DEF[0], ['Raso', 'Bistrech', 'Oxford'], 1.6, 3500],
    [TIPOS_DEF[1], ['Raso', 'Bistrech', 'Oxford'], 2.6, 5000],
    [TIPOS_DEF[2], ['Raso', 'Bistrech', 'Oxford'], 1.3, 2500],
    [TIPOS_DEF[3], ['Raso', 'Oxford'], 2.2, 6000],
    [TIPOS_DEF[4], ['Bistrech', 'Microperforado', 'Raquelado'], 1.8, 2000],
    [TIPOS_DEF[5], ['Bistrech', 'Oxford'], 1.5, 3000],
    [TIPOS_DEF[6], ['Bistrech', 'Oxford'], 1.5, 3000],
    [TIPOS_DEF[7], ['Raso', 'Bistrech'], 1.4, 2500],
    [TIPOS_DEF[8], ['Raso', 'Bistrech'], 2.4, 6000],
  ];
  const rows = [];
  for (const [tipo, mats, f, base] of tipos)
    for (const mat of mats)
      for (const med of medidas)
        rows.push({ id: uid(), tipo, material: mat, medida: med,
          costo: Math.round((areaDe(med) * m2[mat] * f + base) / 10) * 10 });
  return rows;
}

/* ---------------- Utilidades ---------------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clp = n => '$ ' + Math.round(n || 0).toLocaleString('es-CL');
const pct = n => (isFinite(n) ? (n * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '0') + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const hoy = () => new Date().toISOString().slice(0, 10);
const fechaCL = iso => iso ? iso.slice(0, 10).split('-').reverse().join('-') : '';
/* RUT: formatea a 12.345.678-9 y valida dígito verificador */
function limpiaRut(v) { return String(v || '').toUpperCase().replace(/[^0-9K]/g, '').replace(/K(?=.)/g, ''); }
function formatRut(v) {
  const r = limpiaRut(v); if (r.length < 2) return r;
  const cuerpo = r.slice(0, -1), dv = r.slice(-1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}
function rutValido(v) {
  const r = limpiaRut(v); if (r.length < 2) return false;
  const cuerpo = r.slice(0, -1), dv = r.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let s = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { s += +cuerpo[i] * m; m = m === 7 ? 2 : m + 1; }
  const esperado = 11 - (s % 11);
  return dv === (esperado === 11 ? '0' : esperado === 10 ? 'K' : String(esperado));
}
/* Fechas */
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fechaDe = iso => { const [y, m, d] = String(iso || hoy()).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
function sumarDiasHabiles(iso, n) {
  const d = fechaDe(iso); let k = 0;
  while (k < n) { d.setDate(d.getDate() + 1); const dw = d.getDay(); if (dw !== 0 && dw !== 6 && !FERIADOS.has(isoDe(d))) k++; }
  return isoDe(d);
}
function sumarDias(iso, n) { const d = fechaDe(iso); d.setDate(d.getDate() + n); return isoDe(d); }
const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fechaLarga = iso => `${DIAS_SEM[fechaDe(iso).getDay()]} ${fechaCL(iso)}`;
function esNumero(v) { return v !== '' && v != null && isFinite(+v); }
function textoPlazo(c, desde) {
  if (!esNumero(c.plazo)) return c.plazo || '';
  return `${+c.plazo} días hábiles (${fechaCL(sumarDiasHabiles(desde || c.fecha, +c.plazo))})`;
}
function textoValidez(c) {
  if (!esNumero(c.validez)) return c.validez || '';
  return `${+c.validez} días (hasta el ${fechaCL(sumarDias(c.fecha, +c.validez))})`;
}

function areaDe(medida) {
  const m = String(medida).replace(/,/g, '.').match(/([\d.]+)\s*[x×*]\s*([\d.]+)/i);
  return m ? parseFloat(m[1]) * parseFloat(m[2]) : 0;
}
function normMedida(s) {
  const m = String(s).replace(/,/g, '.').match(/([\d.]+)\s*[x×*]\s*([\d.]+)/i);
  if (!m) return String(s).trim();
  const f = v => v.toFixed(2).replace('.', ',');
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  return `${f(Math.max(a, b))} x ${f(Math.min(a, b))}`;   // siempre la medida mayor primero
}
const miles = n => (+n ? Math.round(+n).toLocaleString('es-CL') : '');
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- Almacenamiento ---------------- */
const Store = {
  get(k, def) {
    try { const v = localStorage.getItem('cg_' + k); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  },
  set(k, v) { try { localStorage.setItem('cg_' + k, JSON.stringify(v)); } catch (e) { toast('No se pudo guardar en este navegador'); } },
};

let CFG = Object.assign({}, CONFIG_DEF, Store.get('config', {}));
// Migración: las condiciones antiguas eran texto; ahora plazo/validez son números y por defecto van en blanco.
if (CFG.condPago === '50% al aceptar la cotización, 50% contra entrega') CFG.condPago = '';
if (!esNumero(CFG.plazo)) CFG.plazo = '';
if (!esNumero(CFG.validez)) CFG.validez = '';
let MATRIZ = Store.get('matriz', null);
let MATRIZ_EJEMPLO = Store.get('matrizEjemplo', true);
if (!MATRIZ) { MATRIZ = matrizEjemplo(); MATRIZ_EJEMPLO = true; Store.set('matriz', MATRIZ); Store.set('matrizEjemplo', true); }
let COTS = Store.get('cotizaciones', []);
let OTS = Store.get('ots', []);
let D = Store.get('borrador', null) || nuevoBorrador();
if (!D.id) {
  if (D.condPago === '50% al aceptar la cotización, 50% contra entrega') D.condPago = '';
  if (!esNumero(D.plazo)) D.plazo = '';
  if (!esNumero(D.validez)) D.validez = '';
}

/* Migración: Poliéster -> Bistrech y medidas con la mayor primero */
(function migrar() {
  const mat = m => m === 'Poliéster' ? 'Bistrech' : m;
  const fix = x => { if (!x) return; if (x.material) x.material = mat(x.material); if (x.medida) x.medida = normMedida(x.medida); };
  CFG.materiales = [...new Set((CFG.materiales || MATERIALES_DEF).map(mat))];
  MATRIZ.forEach(fix);
  [D, ...COTS, ...OTS].forEach(c => (c.items || []).forEach(fix));
  Store.set('config', CFG); Store.set('matriz', MATRIZ); Store.set('cotizaciones', COTS);
  Store.set('ots', OTS); Store.set('borrador', D);
})();

const saveCfg = () => Store.set('config', CFG);
const saveMatriz = () => { Store.set('matriz', MATRIZ); Store.set('matrizEjemplo', MATRIZ_EJEMPLO); };
const saveCots = () => Store.set('cotizaciones', COTS);
const saveOts = () => Store.set('ots', OTS);
const saveDraft = () => Store.set('borrador', D);

function nuevoBorrador() {
  return {
    id: null, numero: null, fecha: hoy(),
    cliente: { nombre: '', rut: '', contacto: '', telefono: '', email: '', direccion: '', comuna: '', region: '' },
    condPago: CFG.condPago, plazo: CFG.plazo, validez: CFG.validez, obs: '',
    items: [nuevoItem()],
    despacho: { costo: 0, cobro: 0, nota: '' },
  };
}
function nuevoItem(libre = false) {
  return { id: uid(), libre, tipo: '', material: '', medida: '', descripcion: '', cantidad: 1, costo: 0, margen: +CFG.margenDef || 40, obs: '' };
}

/* ---------------- Cálculos ---------------- */
function precioUnitario(costo, margenPct) {
  const m = margenPct / 100;
  if (m >= 1 || costo <= 0) return 0;
  const r = Math.max(1, +CFG.redondeo || 1);
  return Math.ceil(costo / (1 - m) / r) * r;   // margen sobre precio de venta
}
function calcItem(it) {
  const costoU = +it.costo || 0, cant = +it.cantidad || 0;
  const precioU = precioUnitario(costoU, +it.margen || 0);
  const venta = precioU * cant, costo = costoU * cant, margen = venta - costo;
  return { costoU, cant, precioU, venta, costo, margen, margenPct: venta ? margen / venta : 0 };
}
function calcTotales(d) {
  let venta = 0, costo = 0;
  for (const it of d.items) { const c = calcItem(it); venta += c.venta; costo += c.costo; }
  const despCobro = +d.despacho.cobro || 0, despCosto = +d.despacho.costo || 0;
  const neto = venta + despCobro, costoTot = costo + despCosto;
  const iva = Math.round(neto * IVA);
  const margen = neto - costoTot;
  return { ventaProductos: venta, costoProductos: costo, despCobro, despCosto, neto, iva, bruto: neto + iva,
    costo: costoTot, margen, margenPct: neto ? margen / neto : 0 };
}
function descItem(it) {
  if (it.libre) return it.descripcion || 'Ítem';
  return [it.tipo, it.material, it.medida ? it.medida + ' m' : ''].filter(Boolean).join(' · ');
}

/* ---------------- Navegación ---------------- */
function mostrar(view) {
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'cotizaciones') renderCotizaciones();
  if (view === 'ots') renderOts();
  if (view === 'matriz') renderMatriz();
  if (view === 'config') renderConfig();
  window.scrollTo(0, 0);
}
$$('#tabs button').forEach(b => b.onclick = () => mostrar(b.dataset.view));

/* ---------------- Editor de cotización ---------------- */
function chipsHtml(valor, attr) {
  const esRapido = MARGENES_RAPIDOS.includes(+valor);
  return MARGENES_RAPIDOS.map(m =>
    `<button type="button" class="chip ${+valor === m ? 'active' : ''}" ${attr}="${m}">${m}%</button>`).join('') +
    `<span class="chip-input ${esRapido ? '' : 'active'}">otro <input type="number" min="0" max="95" step="0.5" ${attr}-manual value="${esRapido ? '' : esc(valor)}" placeholder="—">%</span>`;
}

function renderEditor() {
  $('#cotTitulo').textContent = D.numero ? `Cotización N° ${D.numero}` : 'Nueva cotización';
  $$('[data-c]').forEach(i => i.value = D.cliente[i.dataset.c] || '');
  marcarRut($('[data-c="rut"]'));
  llenarCondPago($('[data-d="condPago"]'), D.condPago);
  $$('[data-d]').forEach(i => i.value = D[i.dataset.d] || '');
  $('#despCosto').value = miles(D.despacho.costo);
  $('#despCobro').value = miles(D.despacho.cobro);
  $('#despNota').value = D.despacho.nota || '';
  renderFechas();
  renderChipsGlobal();
  renderItems();
}
function renderFechas() {
  $('#fechaPlazo').textContent = esNumero(D.plazo) ? '→ ' + fechaLarga(sumarDiasHabiles(D.fecha, +D.plazo)) : '';
  $('#fechaValidez').textContent = esNumero(D.validez) ? '→ hasta ' + fechaLarga(sumarDias(D.fecha, +D.validez)) : '';
}
function renderChipsGlobal() {
  const ms = [...new Set(D.items.map(i => +i.margen))];
  $('#chipsGlobal').innerHTML = chipsHtml(ms.length === 1 ? ms[0] : '', 'data-mg');
}

function opcionesTipo() { return CFG.tipos; }
function opcionesMaterial(tipo) {
  const set = new Set(MATRIZ.filter(r => r.tipo === tipo).map(r => r.material));
  return CFG.materiales.filter(m => set.has(m)).concat([...set].filter(m => !CFG.materiales.includes(m)));
}
function opcionesMedida(tipo, mat) {
  return MATRIZ.filter(r => r.tipo === tipo && r.material === mat)
    .sort((a, b) => areaDe(a.medida) - areaDe(b.medida)).map(r => r.medida);
}
function costoMatriz(it) {
  const r = MATRIZ.find(r => r.tipo === it.tipo && r.material === it.material && r.medida === it.medida);
  return r ? +r.costo : null;
}
const opt = (v, sel, label) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label ?? v)}</option>`;

function renderItems() {
  $('#items').innerHTML = D.items.map((it, i) => {
    let campos;
    if (it.libre) {
      campos = `<div class="item-grid libre">
        <label>Descripción<input data-f="descripcion" value="${esc(it.descripcion)}" placeholder="Ej: Mástil de aluminio 3 m"></label>
        <label>Cantidad<input type="number" min="0" data-f="cantidad" value="${esc(it.cantidad)}"></label>
        <label>Costo unitario neto<input data-money inputmode="numeric" data-f="costo" value="${miles(it.costo)}"></label>
      </div>`;
    } else {
      const mats = it.tipo ? opcionesMaterial(it.tipo) : [];
      const meds = it.tipo && it.material ? opcionesMedida(it.tipo, it.material) : [];
      const cm = costoMatriz(it);
      const modificado = cm != null && +it.costo !== cm;
      campos = `<div class="item-grid">
        <label>Tipo de bandera<select data-f="tipo"><option value="">Elegir…</option>${opcionesTipo().map(t => opt(t, it.tipo)).join('')}</select></label>
        <label>Material<select data-f="material" ${it.tipo ? '' : 'disabled'}><option value="">Elegir…</option>${mats.map(m => opt(m, it.material)).join('')}</select></label>
        <label>Medida (m)<select data-f="medida" ${it.material ? '' : 'disabled'}><option value="">Elegir…</option>${meds.map(m => opt(m, it.medida)).join('')}</select></label>
        <label>Cantidad<input type="number" min="0" data-f="cantidad" value="${esc(it.cantidad)}"></label>
        <label>Costo unit. neto${modificado ? ' <span title="Distinto a la matriz">✎</span>' : ''}<input data-money inputmode="numeric" data-f="costo" value="${miles(it.costo)}"></label>
      </div>
      ${it.tipo && !mats.length ? '<div class="warn-txt">Este tipo aún no tiene costos en la matriz. Agrégalos en “Matriz de costos” o escribe el costo a mano.</div>' : ''}`;
    }
    return `<div class="item" data-id="${it.id}">
      <div class="item-head"><span class="item-num">Producto ${i + 1}${it.libre ? ' (libre)' : ''}</span>
        <span><button class="btn sm ghost" data-act="dup">Duplicar</button> <button class="btn sm ghost danger" data-act="del">Quitar</button></span></div>
      ${campos}
      <div class="item-margen">Margen: <span class="chips">${chipsHtml(it.margen, 'data-m')}</span></div>
      <div class="item-res" data-res></div>
      <div class="item-obs"><input data-f="obs" value="${esc(it.obs)}" placeholder="Detalle para la cotización / OT (opcional): diseño, terminaciones, etc."></div>
    </div>`;
  }).join('') || '<div class="empty">Sin productos. Agrega una bandera.</div>';
  recalc();
}

function recalc() {
  for (const it of D.items) {
    const el = $(`.item[data-id="${it.id}"] [data-res]`); if (!el) continue;
    const c = calcItem(it);
    el.innerHTML = `
      <div class="stat"><small>Costo unit.</small><b>${clp(c.costoU)}</b></div>
      <div class="stat"><small>Precio unit. neto</small><b>${clp(c.precioU)}</b></div>
      <div class="stat"><small>Total neto</small><b>${clp(c.venta)}</b></div>
      <div class="stat"><small>Costo total</small><b>${clp(c.costo)}</b></div>
      <div class="stat ${c.margen < 0 ? 'bad' : 'hl'}"><small>Margen</small><b>${clp(c.margen)} · ${pct(c.margenPct)}</b></div>`;
  }
  const t = calcTotales(D);
  $('#totales').innerHTML = `
    <div class="stat"><small>Productos (neto)</small><b>${clp(t.ventaProductos)}</b></div>
    <div class="stat"><small>Despacho cobrado</small><b>${clp(t.despCobro)}</b></div>
    <div class="stat"><small>Total neto</small><b>${clp(t.neto)}</b></div>
    <div class="stat"><small>IVA 19%</small><b>${clp(t.iva)}</b></div>
    <div class="stat big"><small>Total bruto (cliente paga)</small><b>${clp(t.bruto)}</b></div>
    <div class="stat"><small>Costo total (incl. despacho)</small><b>${clp(t.costo)}</b></div>
    <div class="stat ${t.margen < 0 ? 'bad' : 'hl'}"><small>Margen total</small><b>${clp(t.margen)}</b></div>
    <div class="stat ${t.margen < 0 ? 'bad' : 'hl'}"><small>Margen total %</small><b>${pct(t.margenPct)}</b></div>`;
  saveDraft();
}

const itemDe = el => D.items.find(i => i.id === el.closest('.item')?.dataset.id);

$('#items').addEventListener('change', e => {
  const it = itemDe(e.target); const f = e.target.dataset.f; if (!it || !f) return;
  if (f === 'tipo' || f === 'material' || f === 'medida') {
    it[f] = e.target.value;
    if (f === 'tipo') { it.material = ''; it.medida = '';
      const mats = opcionesMaterial(it.tipo); if (mats.length === 1) it.material = mats[0]; }
    if (f !== 'medida') { const meds = it.material ? opcionesMedida(it.tipo, it.material) : [];
      if (!meds.includes(it.medida)) it.medida = meds.length === 1 ? meds[0] : ''; }
    const cm = costoMatriz(it); it.costo = cm ?? 0;
    renderItems();
  }
});
$('#items').addEventListener('input', e => {
  const it = itemDe(e.target); if (!it) return;
  const f = e.target.dataset.f;
  if (f === 'cantidad' || f === 'costo') { it[f] = num(e.target.value); recalc(); }
  else if (f === 'descripcion' || f === 'obs') { it[f] = e.target.value; saveDraft(); }
  else if (e.target.hasAttribute('data-m-manual')) {
    it.margen = num(e.target.value);
    const box = e.target.closest('.item-margen');
    $$('.chip', box).forEach(c => c.classList.toggle('active', +c.dataset.m === it.margen && e.target.value === ''));
    e.target.parentElement.classList.toggle('active', e.target.value !== '');
    renderChipsGlobal(); recalc();
  }
});
$('#items').addEventListener('click', e => {
  const it = itemDe(e.target); if (!it) return;
  if (e.target.dataset.m) { it.margen = +e.target.dataset.m; renderItems(); renderChipsGlobal(); }
  const act = e.target.dataset.act;
  if (act === 'del') { D.items = D.items.filter(x => x !== it); renderItems(); renderChipsGlobal(); }
  if (act === 'dup') { const i = D.items.indexOf(it); D.items.splice(i + 1, 0, { ...it, id: uid() }); renderItems(); }
});
$('#chipsGlobal').addEventListener('click', e => {
  if (!e.target.dataset.mg) return;
  D.items.forEach(i => i.margen = +e.target.dataset.mg); renderChipsGlobal(); renderItems();
});
$('#chipsGlobal').addEventListener('change', e => {
  if (!e.target.hasAttribute('data-mg-manual') || e.target.value === '') return;
  D.items.forEach(i => i.margen = num(e.target.value)); renderChipsGlobal(); renderItems();
});

$('#btnAddItem').onclick = () => { D.items.push(nuevoItem()); renderItems(); };
$('#btnAddLibre').onclick = () => { D.items.push(nuevoItem(true)); renderItems(); };
$$('[data-c]').forEach(i => i.oninput = () => { D.cliente[i.dataset.c] = i.value; saveDraft(); });
$$('[data-d]').forEach(i => i.oninput = () => { D[i.dataset.d] = i.value; saveDraft(); renderFechas(); });
$('#selRegion').innerHTML = '<option value="">Elegir…</option>' + REGIONES.map(r => `<option>${esc(r)}</option>`).join('');
$('#selRegion').onchange = e => { D.cliente.region = e.target.value; saveDraft(); };

/* Montos: separador de miles mientras se escribe */
document.addEventListener('input', e => {
  if (!e.target.matches('[data-money]')) return;
  const inp = e.target, antes = inp.value, pos = inp.selectionStart ?? antes.length;
  const sig = antes.slice(0, pos).replace(/\D/g, '').replace(/^0+(?=\d)/, '').length;
  const dig = antes.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  inp.value = dig ? (+dig).toLocaleString('es-CL') : '';
  let p = 0, k = 0; while (p < inp.value.length && k < sig) { if (/\d/.test(inp.value[p])) k++; p++; }
  try { inp.setSelectionRange(p, p); } catch (_) {}
}, true);

/* RUT: se formatea solo mientras se escribe (antes que los demás handlers) */
function marcarRut(inp) {
  const msg = inp.parentElement.querySelector('.rut-msg'); if (!msg) return;
  const v = inp.value; const ok = rutValido(v);
  msg.textContent = !v || limpiaRut(v).length < 8 ? '' : ok ? '✓ RUT válido' : '✗ Dígito verificador no calza';
  msg.className = 'rut-msg ' + (ok ? 'ok' : 'bad');
}
document.addEventListener('input', e => {
  if (!e.target.matches('[data-rut]')) return;
  const inp = e.target, antes = inp.value, pos = inp.selectionStart;
  const sig = limpiaRut(antes.slice(0, pos)).length;
  inp.value = formatRut(antes);
  let p = 0, k = 0; while (p < inp.value.length && k < sig) { if (/[0-9K]/.test(inp.value[p])) k++; p++; }
  try { inp.setSelectionRange(p, p); } catch (_) {}
  marcarRut(inp);
}, true);
$('#despCosto').oninput = e => {
  const nuevo = num(e.target.value);
  if (+D.despacho.cobro === +D.despacho.costo) { D.despacho.cobro = nuevo; $('#despCobro').value = miles(nuevo); }
  D.despacho.costo = nuevo; recalc();
};
$('#despCobro').oninput = e => { D.despacho.cobro = num(e.target.value); recalc(); };
$('#despNota').oninput = e => { D.despacho.nota = e.target.value; saveDraft(); };

$('#btnNueva').onclick = () => {
  if (D.items.some(i => i.costo) && !D.id && !confirm('¿Descartar la cotización que estás armando?')) return;
  D = nuevoBorrador(); renderEditor(); toast('Nueva cotización');
};

function validar() {
  if (!D.cliente.nombre.trim()) { toast('Falta el nombre del cliente'); $('[data-c="nombre"]').focus(); return false; }
  const items = D.items.filter(i => +i.cantidad > 0);
  if (!items.length) { toast('Agrega al menos un producto con cantidad'); return false; }
  const sinPrecio = items.find(i => !calcItem(i).precioU);
  if (sinPrecio) { toast('Hay un producto sin costo: revisa tipo, material y medida'); return false; }
  return true;
}
function guardarCotizacion() {
  if (!validar()) return null;
  const snap = JSON.parse(JSON.stringify(D));
  snap.items = snap.items.filter(i => +i.cantidad > 0);
  snap.totales = calcTotales(snap);
  snap.actualizado = new Date().toISOString();
  if (!D.id) {
    snap.id = uid(); snap.numero = +CFG.nextCot || 1; snap.estado = 'Pendiente'; snap.fecha = hoy();
    CFG.nextCot = snap.numero + 1; saveCfg();
    COTS.unshift(snap);
  } else {
    const i = COTS.findIndex(c => c.id === D.id);
    snap.estado = COTS[i]?.estado || 'Pendiente';
    if (i >= 0) COTS[i] = snap; else COTS.unshift(snap);
  }
  saveCots();
  D = JSON.parse(JSON.stringify(snap)); saveDraft();
  renderEditor();
  toast(`Cotización N° ${snap.numero} guardada`);
  return snap;
}
$('#btnGuardar').onclick = guardarCotizacion;
$('#btnPdf').onclick = () => { const c = guardarCotizacion(); if (c) imprimirCotizacion(c); };

/* ---------------- Documentos imprimibles ---------------- */
function encabezado(titulo, numero, fecha) {
  return `<div class="doc-head">
    <div class="doc-emp"><img class="doc-logo" src="logo.png" alt="${esc(CFG.empresa)}"><b>${esc(CFG.empresa)}</b>
      ${CFG.giro ? `<div>${esc(CFG.giro)}</div>` : ''}
      ${CFG.rutEmpresa ? `<div>RUT ${esc(CFG.rutEmpresa)}</div>` : ''}
      ${CFG.dirEmpresa ? `<div>${esc(CFG.dirEmpresa)}</div>` : ''}
      <div>${[CFG.fonoEmpresa, CFG.mailEmpresa].filter(Boolean).map(esc).join(' · ')}</div></div>
    <div class="doc-box"><div class="t">${titulo}</div><div class="n">N° ${numero}</div><div>${fechaCL(fecha)}</div></div>
  </div>`;
}
function bloqueCliente(c) {
  return `<div class="doc-meta">
    <div><span>Cliente:</span> <b>${esc(c.nombre)}</b></div>
    <div><span>RUT:</span> ${esc(c.rut)}</div>
    <div><span>Contacto:</span> ${esc(c.contacto)}</div>
    <div><span>Teléfono / email:</span> ${esc([c.telefono, c.email].filter(Boolean).join(' · '))}</div>
    <div style="grid-column:1/-1"><span>Dirección de despacho:</span> ${esc([c.direccion, c.comuna, c.region ? 'Región ' + c.region : ''].filter(Boolean).join(', '))}</div>
  </div>`;
}
async function imprimir(html, titulo) {
  $('#print').innerHTML = html;
  await Promise.all($$('#print img').map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  const prev = document.title; document.title = titulo;
  setTimeout(() => { window.print(); document.title = prev; }, 50);
}
function imprimirCotizacion(c) {
  const t = c.totales || calcTotales(c);
  const filas = c.items.map(it => { const k = calcItem(it);
    return `<tr><td class="num">${k.cant}</td><td>${esc(descItem(it))}${it.obs ? `<div class="small">${esc(it.obs)}</div>` : ''}</td>
      <td class="num">${clp(k.precioU)}</td><td class="num">${clp(k.venta)}</td></tr>`; }).join('');
  const desp = t.despCobro ? `<tr><td class="num">1</td><td>Despacho${c.despacho.nota ? ' — ' + esc(c.despacho.nota) : ' Correos de Chile'}</td>
      <td class="num">${clp(t.despCobro)}</td><td class="num">${clp(t.despCobro)}</td></tr>` : '';
  imprimir(`<div class="doc">
    ${encabezado('COTIZACIÓN', c.numero, c.fecha)}
    ${bloqueCliente(c.cliente)}
    <table><thead><tr><th class="num">Cant.</th><th>Descripción</th><th class="num">Precio unit. neto</th><th class="num">Total neto</th></tr></thead>
      <tbody>${filas}${desp}</tbody></table>
    <table class="tot">
      <tr><td>Neto</td><td class="num">${clp(t.neto)}</td></tr>
      <tr><td>IVA 19%</td><td class="num">${clp(t.iva)}</td></tr>
      <tr class="final"><td>TOTAL</td><td class="num">${clp(t.bruto)}</td></tr></table>
    <div class="cond">
      ${c.condPago ? `<p><b>Condición de pago:</b> ${esc(c.condPago)}</p>` : ''}
      ${textoPlazo(c) ? `<p><b>Plazo de entrega:</b> ${esc(textoPlazo(c))}</p>` : ''}
      ${textoValidez(c) ? `<p><b>Validez de la oferta:</b> ${esc(textoValidez(c))}</p>` : ''}
      ${c.obs ? `<p><b>Observaciones:</b> ${esc(c.obs).replace(/\n/g, '<br>')}</p>` : ''}
    </div></div>`, `Cotización ${c.numero} - ${c.cliente.nombre}`);
}
function imprimirOt(o) {
  const filas = o.items.map((it, i) => `<tr><td class="num">${i + 1}</td><td class="num">${+it.cantidad}</td>
    <td>${esc(it.libre ? it.descripcion : it.tipo)}</td><td>${esc(it.libre ? '' : it.material)}</td><td>${esc(it.libre ? '' : it.medida)}</td>
    <td>${esc(it.obs)}</td><td style="width:60px"></td></tr>`).join('');
  imprimir(`<div class="doc">
    ${encabezado('ORDEN DE TRABAJO', o.numero, o.fecha)}
    ${bloqueCliente(o.cliente)}
    <div class="doc-meta">
      <div><span>Cotización:</span> N° ${esc(o.cotNumero)}</div>
      <div><span>Fecha de entrega:</span> <b>${esc(textoPlazo({ plazo: o.plazo, fecha: o.fecha }))}</b></div>
      ${o.despacho ? `<div style="grid-column:1/-1"><span>Despacho:</span> ${esc(o.despacho)}</div>` : ''}
    </div>
    <table><thead><tr><th class="num">#</th><th class="num">Cant.</th><th>Tipo / producto</th><th>Material</th><th>Medida (m)</th><th>Detalle</th><th>Listo</th></tr></thead>
      <tbody>${filas}</tbody></table>
    ${o.obs ? `<div class="cond"><p><b>Observaciones:</b> ${esc(o.obs).replace(/\n/g, '<br>')}</p></div>` : ''}
    <div class="firma"><div>Entregado a producción</div><div>Recibido / terminado</div></div>
  </div>`, `OT ${o.numero} - ${o.cliente.nombre}`);
}

/* ---------------- Lista de cotizaciones ---------------- */
function renderCotizaciones() {
  const q = ($('#buscaCot').value || '').toLowerCase();
  const rows = COTS.filter(c => !q || String(c.numero).includes(q) || (c.cliente.nombre || '').toLowerCase().includes(q));
  if (!rows.length) { $('#tablaCot').innerHTML = `<tr><td class="empty">${COTS.length ? 'Sin resultados.' : 'Aún no hay cotizaciones guardadas.'}</td></tr>`; return; }
  $('#tablaCot').innerHTML = `<thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th class="num">Neto</th><th class="num">Total bruto</th><th class="num">Margen</th><th>Estado</th><th></th></tr></thead><tbody>` +
    rows.map(c => { const t = c.totales; const ot = OTS.find(o => o.cotId === c.id);
      return `<tr data-id="${c.id}"><td><b>${c.numero}</b></td><td>${fechaCL(c.fecha)}</td><td>${esc(c.cliente.nombre)}</td>
      <td class="num">${clp(t.neto)}</td><td class="num">${clp(t.bruto)}</td><td class="num">${clp(t.margen)} · ${pct(t.margenPct)}</td>
      <td><span class="badge ${c.estado}">${c.estado}</span>${ot ? ` <small>OT ${ot.numero}</small>` : ''}</td>
      <td class="acc">
        <button class="btn sm" data-a="abrir">Abrir</button>
        <button class="btn sm" data-a="pdf">PDF</button>
        ${c.estado !== 'Aprobada' ? '<button class="btn sm ok" data-a="aprobar">Aprobar</button>' : ''}
        ${c.estado === 'Pendiente' ? '<button class="btn sm ghost" data-a="rechazar">Rechazar</button>' : ''}
        <button class="btn sm ghost" data-a="duplicar">Duplicar</button>
        <button class="btn sm ghost danger" data-a="borrar">Borrar</button></td></tr>`; }).join('') + '</tbody>';
}
$('#buscaCot').oninput = renderCotizaciones;
$('#tablaCot').addEventListener('click', e => {
  const a = e.target.dataset.a; if (!a) return;
  const c = COTS.find(x => x.id === e.target.closest('tr').dataset.id); if (!c) return;
  if (a === 'abrir') { D = JSON.parse(JSON.stringify(c)); saveDraft(); renderEditor(); mostrar('cotizar'); }
  if (a === 'pdf') imprimirCotizacion(c);
  if (a === 'duplicar') {
    D = JSON.parse(JSON.stringify(c)); Object.assign(D, { id: null, numero: null, fecha: hoy() });
    D.items.forEach(i => i.id = uid()); saveDraft(); renderEditor(); mostrar('cotizar'); toast('Copia lista para editar');
  }
  if (a === 'rechazar') { c.estado = 'Rechazada'; saveCots(); renderCotizaciones(); }
  if (a === 'borrar') {
    if (!confirm(`¿Borrar la cotización N° ${c.numero}? No se puede deshacer.`)) return;
    COTS = COTS.filter(x => x !== c); saveCots(); renderCotizaciones();
  }
  if (a === 'aprobar') {
    c.estado = 'Aprobada';
    let ot = OTS.find(o => o.cotId === c.id);
    if (!ot) {
      ot = { id: uid(), numero: +CFG.nextOt || 1, fecha: hoy(), cotId: c.id, cotNumero: c.numero,
        cliente: { ...c.cliente }, plazo: c.plazo, obs: c.obs,
        despacho: [c.despacho.nota, [c.cliente.direccion, c.cliente.comuna, c.cliente.region].filter(Boolean).join(', ')].filter(Boolean).join(' — '),
        items: c.items.map(({ libre, tipo, material, medida, descripcion, cantidad, obs }) => ({ libre, tipo, material, medida, descripcion, cantidad, obs })),
        estado: 'Pendiente' };
      CFG.nextOt = ot.numero + 1; saveCfg();
      OTS.unshift(ot); saveOts();
    }
    saveCots(); renderCotizaciones();
    toast(`Cotización ${c.numero} aprobada → OT N° ${ot.numero} creada`);
  }
});

/* ---------------- Órdenes de trabajo ---------------- */
const ESTADOS_OT = ['Pendiente', 'En producción', 'Terminada'];
function renderOts() {
  if (!OTS.length) { $('#tablaOt').innerHTML = '<tr><td class="empty">Aún no hay OTs. Se crean solas al aprobar una cotización.</td></tr>'; return; }
  $('#tablaOt').innerHTML = `<thead><tr><th>OT</th><th>Fecha</th><th>Cliente</th><th>Cotización</th><th>Productos</th><th>Estado</th><th></th></tr></thead><tbody>` +
    OTS.map(o => `<tr data-id="${o.id}"><td><b>${o.numero}</b></td><td>${fechaCL(o.fecha)}</td><td>${esc(o.cliente.nombre)}</td>
      <td>N° ${o.cotNumero}</td><td>${o.items.reduce((s, i) => s + (+i.cantidad || 0), 0)} u.</td>
      <td><select data-a="estado">${ESTADOS_OT.map(s => opt(s, o.estado)).join('')}</select></td>
      <td class="acc"><button class="btn sm" data-a="pdf">Imprimir / PDF</button>
        <button class="btn sm ghost danger" data-a="borrar">Borrar</button></td></tr>`).join('') + '</tbody>';
}
$('#tablaOt').addEventListener('click', e => {
  const a = e.target.dataset.a; const o = OTS.find(x => x.id === e.target.closest('tr')?.dataset.id); if (!o) return;
  if (a === 'pdf') imprimirOt(o);
  if (a === 'borrar' && confirm(`¿Borrar la OT N° ${o.numero}?`)) { OTS = OTS.filter(x => x !== o); saveOts(); renderOts(); }
});
$('#tablaOt').addEventListener('change', e => {
  if (e.target.dataset.a !== 'estado') return;
  const o = OTS.find(x => x.id === e.target.closest('tr').dataset.id); o.estado = e.target.value; saveOts();
});

/* ---------------- Matriz de costos ---------------- */
function renderMatriz() {
  const f = $('#filtroTipo');
  const actual = f.value;
  f.innerHTML = `<option value="">Todos los tipos</option>` + CFG.tipos.map(t => opt(t, actual)).join('');
  $('#avisoEjemplo').style.display = MATRIZ_EJEMPLO ? '' : 'none';
  const rows = MATRIZ.filter(r => !f.value || r.tipo === f.value)
    .sort((a, b) => CFG.tipos.indexOf(a.tipo) - CFG.tipos.indexOf(b.tipo) || a.material.localeCompare(b.material) || areaDe(a.medida) - areaDe(b.medida));
  $('#tablaMatriz').innerHTML = `<thead><tr><th>Tipo</th><th>Material</th><th>Medida (largo x ancho, m)</th><th class="num">Costo neto</th><th></th></tr></thead><tbody>` +
    (rows.map(r => `<tr data-id="${r.id}">
      <td><select data-k="tipo">${CFG.tipos.concat(CFG.tipos.includes(r.tipo) ? [] : [r.tipo]).map(t => opt(t, r.tipo)).join('')}</select></td>
      <td><select data-k="material">${CFG.materiales.concat(CFG.materiales.includes(r.material) ? [] : [r.material]).map(m => opt(m, r.material)).join('')}</select></td>
      <td><input data-k="medida" value="${esc(r.medida)}"></td>
      <td class="num"><input class="costo" data-money inputmode="numeric" data-k="costo" value="${miles(r.costo)}"></td>
      <td class="acc"><button class="btn sm ghost danger" data-a="del">✕</button></td></tr>`).join('') ||
      '<tr><td colspan="5" class="empty">No hay filas para este tipo.</td></tr>') + '</tbody>';
}
$('#filtroTipo').onchange = renderMatriz;
function tocarMatriz() { MATRIZ_EJEMPLO = false; saveMatriz(); $('#avisoEjemplo').style.display = 'none'; }
$('#tablaMatriz').addEventListener('change', e => {
  const k = e.target.dataset.k; const r = MATRIZ.find(x => x.id === e.target.closest('tr')?.dataset.id); if (!k || !r) return;
  r[k] = k === 'costo' ? num(e.target.value) : k === 'medida' ? normMedida(e.target.value) : e.target.value;
  if (k === 'medida') e.target.value = r.medida;
  tocarMatriz();
});
$('#tablaMatriz').addEventListener('click', e => {
  if (e.target.dataset.a !== 'del') return;
  const id = e.target.closest('tr').dataset.id; MATRIZ = MATRIZ.filter(r => r.id !== id); tocarMatriz(); renderMatriz();
});
$('#btnAddFila').onclick = () => {
  MATRIZ.push({ id: uid(), tipo: $('#filtroTipo').value || CFG.tipos[0], material: CFG.materiales[0], medida: '1,80 x 1,20', costo: 0 });
  tocarMatriz(); renderMatriz();
  const ins = $$('#tablaMatriz input[data-k="medida"]'); ins.at(-1)?.focus();
};
$('#btnPegar').onclick = () => { $('#txtPegar').value = ''; $('#dlgPegar').showModal(); };
$('#btnPegarCancelar').onclick = () => $('#dlgPegar').close();
$('#btnPegarOk').onclick = () => {
  const lineas = $('#txtPegar').value.split(/\r?\n/).map(l => l.split('\t').map(s => s.trim())).filter(c => c.length >= 4 && c[0]);
  const nuevas = []; const malas = [];
  for (const c of lineas) {
    const costo = num(String(c[3]).replace(/[$\s]/g, ''));
    if (!costo || !areaDe(c[2])) { malas.push(c.join(' | ')); continue; }
    nuevas.push({ id: uid(), tipo: c[0], material: c[1], medida: normMedida(c[2]), costo });
  }
  if (!nuevas.length) { alert('No se reconoció ninguna fila. Revisa que sean 4 columnas: Tipo, Material, Medida, Costo.'); return; }
  if ($('#chkReemplazar').checked) MATRIZ = [];
  for (const n of nuevas) {
    const ex = MATRIZ.find(r => r.tipo === n.tipo && r.material === n.material && r.medida === n.medida);
    if (ex) ex.costo = n.costo; else MATRIZ.push(n);
    if (!CFG.tipos.includes(n.tipo)) CFG.tipos.push(n.tipo);
    if (!CFG.materiales.includes(n.material)) CFG.materiales.push(n.material);
  }
  saveCfg(); tocarMatriz(); $('#dlgPegar').close(); renderMatriz();
  toast(`${nuevas.length} filas importadas` + (malas.length ? ` · ${malas.length} ignoradas` : ''));
};

/* ---------------- Configuración ---------------- */
function llenarCondPago(sel, valor) {
  const ops = CONDICIONES_PAGO.concat(valor && !CONDICIONES_PAGO.includes(valor) ? [valor] : []);
  sel.innerHTML = '<option value="">Elegir…</option>' + ops.map(o => opt(o, valor)).join('');
}
function renderConfig() {
  llenarCondPago($('[data-cfg="condPago"]'), CFG.condPago); $$('[data-cfg]').forEach(i => i.value = CFG[i.dataset.cfg] ?? ''); }
$$('[data-cfg]').forEach(i => i.onchange = () => {
  const k = i.dataset.cfg;
  CFG[k] = (k === 'plazo' || k === 'validez') ? (i.value === '' ? '' : num(i.value))
    : i.type === 'number' || k === 'redondeo' ? num(i.value) : i.value;
  saveCfg();
  if (k === 'redondeo') recalc();
  toast('Guardado');
});
$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ config: CFG, matriz: MATRIZ, matrizEjemplo: MATRIZ_EJEMPLO, cotizaciones: COTS, ots: OTS }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `respaldo-cotizador-${hoy()}.json`; a.click();
};
$('#fileImport').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!confirm('Esto reemplaza todos los datos de este navegador por los del respaldo. ¿Seguir?')) return;
    CFG = Object.assign({}, CONFIG_DEF, j.config); MATRIZ = j.matriz || []; MATRIZ_EJEMPLO = !!j.matrizEjemplo;
    COTS = j.cotizaciones || []; OTS = j.ots || [];
    saveCfg(); saveMatriz(); saveCots(); saveOts(); renderConfig(); toast('Respaldo restaurado');
  } catch (err) { alert('El archivo no es un respaldo válido.'); }
  e.target.value = '';
};

/* ---------------- Inicio ---------------- */
renderEditor();
