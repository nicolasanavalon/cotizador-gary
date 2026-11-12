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
const VAINAS = ['Huincha poliéster y argollas', 'Vaina de lona', 'Vaina de lona con driza incorporada', 'Vaina de lona con ojetillos'];
const PRODUCTOS = ['Bandera', 'Bandera de escritorio', 'Mantel', 'Asta de escritorio', 'Otro'];
const DESCUENTOS_RAPIDOS = [5, 10, 15];
const ICONO_CAMION = '<svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h24v20H4z"/><path d="M28 19h8l7 7v6h-15z"/><circle cx="13" cy="35" r="4"/><circle cx="35" cy="35" r="4"/></svg>';
const ICONO_BANDERA = '<svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 44V5"/><path d="M11 7c6-3 11 3 17 0s9-2 12 0v18c-3-2-6-3-12 0s-11-3-17 0"/></svg>';
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

const CAJAS_DEF = [   // cajas reales del taller (capM2 = estimación hasta tener las capacidades)
  { id: 'chica', nombre: 'Caja chica', largo: 30.5, ancho: 25.5, alto: 20, pesoVacia: 0.2, capM2: 12 },
  { id: 'mediana', nombre: 'Caja mediana', largo: 40, ancho: 30, alto: 30, pesoVacia: 0.35, capM2: 29 },
  { id: 'grande', nombre: 'Caja grande', largo: 42, ancho: 36, alto: 32, pesoVacia: 0.4, capM2: 38 },
];
const CONFIG_DEF = {
  empresa: 'Taller Gary', rutEmpresa: '', giro: 'Confección de banderas', dirEmpresa: '',
  fonoEmpresa: '', mailEmpresa: '', lema: '', banco: '', cuentaCte: '', contactos: '', web: '',
  condPago: '', plazo: '', validez: '', garantia: '',
  cajas: CAJAS_DEF, capacidad: {}, pesoM2: 0.2, cajasEjemplo: true,
  margenDef: 40, redondeo: 100, nextCot: 1, nextOt: 1,
  tipos: TIPOS_DEF, materiales: MATERIALES_DEF,
};

/* Matriz de EJEMPLO: costo ≈ área × $/m² del material × factor del tipo + base. */
function matrizEjemplo() {
  const medidas = ['0,90 x 0,60', '1,35 x 0,90', '1,50 x 1,00', '1,80 x 1,20', '2,25 x 1,50', '3,00 x 2,00'];
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
const pct = n => (isFinite(n) ? Math.round(n * 100).toLocaleString('es-CL') : '0') + '%';
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
  return `${+c.validez} días hábiles (hasta el ${fechaCL(sumarDiasHabiles(c.fecha, +c.validez))})`;
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

/* ---------------- Nube (Google Sheets vía Apps Script) ---------------- */
const NUBE_URL = window.__NUBE_URL__ ||
  'https://script.google.com/macros/s/AKfycbzBANnMMcT3isEE8EJPwIbduOYacMxLan9E8pp_MYiv7AblOEDqx2oHGoSr7WJiWeb4Cg/exec';
const nubeActiva = () => !!NUBE_URL;
function estadoNube(txt, tipo) { const el = $('#nube'); if (el) { el.textContent = txt; el.className = 'nube ' + tipo; } }
let cambios = 0;   // cuenta los guardados; sirve para descartar lecturas que quedaron viejas
async function api(accion, datos = {}) {
  if (accion !== 'cargar') cambios++;
  estadoNube(accion === 'cargar' ? 'Actualizando…' : 'Guardando…', 'sync');
  const espera = ms => new Promise(r => setTimeout(r, ms));
  let j;
  for (let intento = 1; ; intento++) {
    let r;
    try {
      r = await fetch(NUBE_URL, { method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...datos, accion }) });
      j = await r.json();
    } catch (e) {
      // Leer se puede reintentar sin riesgo; un guardado no (podría haber quedado hecho).
      if (accion === 'cargar' && intento < 3) { await espera(2000 * intento); continue; }
      estadoNube('Sin conexión', 'off'); throw new Error('sin conexión con el servidor');
    }
    // "Ocupado" = el servidor no alcanzó a hacer nada: se puede reintentar siempre.
    if (j && j.error && /ocupado/i.test(j.error) && intento < 4) { await espera(1500 * intento); continue; }
    break;
  }
  if (!j.ok) { estadoNube('Error', 'off'); throw new Error(j.error || 'error del servidor'); }
  estadoNube('● En línea', 'on');
  return j;
}
let subiendoMatriz = null, timerMatriz = null, cargando = null;
/* Trae todo desde la nube y actualiza la copia local. */
function cargarNube() {
  if (!nubeActiva()) return Promise.resolve(false);
  if (cargando) return cargando;
  cargando = (async () => {
    try {
      const antes = cambios;
      const j = await api('cargar');
      if (timerMatriz || subiendoMatriz) return false;   // hay cambios de matriz sin subir: no pisarlos
      if (cambios !== antes) { setTimeout(actualizar, 300); return false; }   // llegó vieja: pedir de nuevo
      const cfg = j.config || {};
      if (!Object.keys(cfg).length) {
        // Primera conexión: la nube está vacía, se sube la configuración y la matriz de este equipo.
        Object.assign(CFG, { nextCot: 1, nextOt: 1 });     // la numeración en la nube parte de cero
        await api('guardarConfig', { config: CFG });
      } else {
        CFG = Object.assign({}, CONFIG_DEF, cfg);
        MATRIZ_EJEMPLO = !!cfg.matrizEjemplo;
      }
      if (!(j.matriz || []).length) await api('guardarMatriz', { matriz: MATRIZ, ejemplo: MATRIZ_EJEMPLO });
      else MATRIZ = j.matriz.map(r => ({ ...r, medida: normMedida(r.medida) }));
      COTS = (j.cotizaciones || []).sort((a, b) => b.numero - a.numero);
      OTS = (j.ots || []).sort((a, b) => b.numero - a.numero);
      Store.set('config', CFG); saveMatriz(); saveCots(); saveOts();
      return true;
    } catch (e) { toast('No se pudo actualizar: ' + e.message); return false; }
    finally { cargando = null; }
  })();
  return cargando;
}
function subirMatriz() {
  if (!nubeActiva()) return;
  clearTimeout(timerMatriz);
  timerMatriz = setTimeout(async () => {
    timerMatriz = null;
    const p = subiendoMatriz = api('guardarMatriz', { matriz: MATRIZ, ejemplo: MATRIZ_EJEMPLO });
    try { await p; } catch (e) { toast('No se pudo guardar la matriz: ' + e.message); }
    finally { if (subiendoMatriz === p) subiendoMatriz = null; }
  }, 1200);
}
async function subirConfig(parcial) {
  if (!nubeActiva()) return;
  await api('guardarConfig', { config: parcial });
}
/* ---------------- Imágenes de productos ---------------- */
const IMGS = new Map();
function imgDe(id) {
  if (!id) return null;
  if (IMGS.has(id)) return IMGS.get(id);
  try { const v = localStorage.getItem('cg_img_' + id); if (v) { IMGS.set(id, v); return v; } } catch (_) {}
  return null;
}
function guardarImgLocal(id, data) { IMGS.set(id, data); try { localStorage.setItem('cg_img_' + id, data); } catch (_) {} }
/* Trae desde la nube las imágenes que este equipo todavía no tiene. */
async function asegurarImagenes(items) {
  const faltan = [...new Set((items || []).map(i => i.imagen).filter(Boolean))].filter(id => !imgDe(id));
  if (!faltan.length || !nubeActiva()) return false;
  try {
    const j = await api('leerImagenes', { ids: faltan });
    Object.entries(j.imagenes || {}).forEach(([id, data]) => guardarImgLocal(id, data));
    return true;
  } catch (e) { return false; }
}
/* Convierte lo que se suba (foto, PNG, SVG o PDF) en un JPEG liviano (máx. 900 px). */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let cargaPdfJs = null;
function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!cargaPdfJs) cargaPdfJs = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { cargaPdfJs = null; rej(new Error('no se pudo cargar el lector de PDF')); };
    document.head.appendChild(s);
  });
  return cargaPdfJs;
}
const MAX_IMG = 900;
function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  return [cv, g];
}
/* Primera página del PDF (sirve también para .ai de Illustrator guardados con compatibilidad PDF). */
async function pdfALienzo(file) {
  const lib = await cargarPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pag = await doc.getPage(1);
  const v1 = pag.getViewport({ scale: 1 });
  // alta resolución: si el diseño ocupa solo parte de la página, después del recorte sigue nítido
  const vp = pag.getViewport({ scale: 2800 / Math.max(v1.width, v1.height) });
  const [cv, g] = lienzo(vp.width, vp.height);
  await pag.render({ canvasContext: g, viewport: vp }).promise;
  return cv;
}
function imagenALienzo(file, esSvg) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) { w = 1200; h = 800; }                 // SVG sin tamaño declarado
      if (esSvg) { const k = (MAX_IMG * 1.5) / Math.max(w, h); w *= k; h *= k; }   // vectorial: se dibuja nítido
      const [cv, g] = lienzo(w, h);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('no se pudo leer el archivo')); };
    img.src = url;
  });
}
/* Quita bordes blancos (típico en PDF y SVG con margen). */
function recortarBlanco(cv) {
  const g = cv.getContext('2d'), { width: w, height: h } = cv;
  const px = g.getImageData(0, 0, w, h).data;
  const blanco = i => px[i] > 244 && px[i + 1] > 244 && px[i + 2] > 244;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (!blanco((y * w + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return cv;                                   // todo blanco: se deja igual
  const m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  if (x1 - x0 > w * 0.97 && y1 - y0 > h * 0.97) return cv;
  const [out, go] = lienzo(x1 - x0 + 1, y1 - y0 + 1);
  go.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
async function comprimirImagen(file) {
  const nombre = (file.name || '').toLowerCase();
  const esPdf = file.type === 'application/pdf' || /\.(pdf|ai)$/.test(nombre);
  const esSvg = file.type === 'image/svg+xml' || nombre.endsWith('.svg');
  let cv = esPdf ? await pdfALienzo(file) : await imagenALienzo(file, esSvg);
  if (esPdf || esSvg) cv = recortarBlanco(cv);
  const k = Math.min(1, MAX_IMG / Math.max(cv.width, cv.height));
  const [fin, g] = lienzo(cv.width * k, cv.height * k);
  g.drawImage(cv, 0, 0, fin.width, fin.height);
  return fin.toDataURL('image/jpeg', 0.82);
}
async function subirImagen(it, file) {
  let data;
  toast('Procesando ' + (/\.(pdf|ai)$/i.test(file.name) ? 'PDF' : 'imagen') + '…');
  try { data = await comprimirImagen(file); }
  catch (e) { toast('No se pudo leer el archivo (' + e.message + '). Formatos: JPG, PNG, SVG o PDF.'); return; }
  const id = 'img' + uid();
  guardarImgLocal(id, data);
  it.imagen = id; renderItems();
  if (nubeActiva()) {
    try { await api('guardarImagen', { id, data }); toast('Imagen guardada'); }
    catch (e) {
      toast(/desconocida/i.test(e.message) ? 'Falta actualizar el servidor para guardar imágenes en la nube (la imagen quedó solo en este equipo)'
        : 'No se pudo subir la imagen: ' + e.message);
    }
  }
}

const vistaActual = () => $('.view.active')?.id.replace('view-', '');
function refrescarVista() {
  const v = vistaActual();
  if (v === 'cotizaciones') renderCotizaciones();
  if (v === 'ots') renderOts();
  if (v === 'matriz' && !$('#tablaMatriz').contains(document.activeElement)) renderMatriz();
  if (v === 'config' && !$('#view-config').contains(document.activeElement)) renderConfig();
  if (v === 'cotizar' && !$('#items').contains(document.activeElement)) renderItems();
}
async function actualizar() { if (await cargarNube()) refrescarVista(); }
function conBoton(btn, fn) {
  return async (...a) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try { return await fn(...a); } finally { btn.disabled = false; }
  };
}

function nuevoBorrador() {
  return {
    id: null, numero: null, fecha: hoy(),
    cliente: { nombre: '', rut: '', contacto: '', telefono: '', email: '', direccion: '', comuna: '', region: '' },
    condPago: CFG.condPago, plazo: CFG.plazo, validez: CFG.validez, garantia: CFG.garantia || '', obs: '',
    items: [nuevoItem()],
    despacho: { modo: 'domicilio', destino: '', secundaria: false, mostrar: 'incluido', manual: null,
      costo: 0, cobro: 0, cobroManual: false, nota: '' },
  };
}
function nuevoItem(libre = false) {
  return { id: uid(), producto: 'Bandera', productoOtro: '', tipo: '', material: '', materialOtro: '', medida: '', medidaOtra: '',
    vaina: '', descripcion: '', titulo: '', costoManual: false, cantidad: 1, costo: 0, margen: +CFG.margenDef || 40, obs: '' };
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
  const lineas = d.items.map(it => ({ it, k: calcItem(it) }));
  let venta = 0, costo = 0;
  for (const l of lineas) { venta += l.k.venta; costo += l.k.costo; }
  const desp = d.despacho || {};
  const sinDesp = desp.modo === 'retiro';
  let despCobro = sinDesp ? 0 : (+desp.cobro || 0);
  const despCosto = sinDesp ? 0 : (+desp.costo || 0);
  // El despacho nunca va como ítem: su cobro se reparte en los precios, proporcional a cada línea.
  const incluido = despCobro > 0 && venta > 0;
  let subtotal;
  if (incluido) {
    for (const l of lineas) {
      const extra = despCobro * l.k.venta / venta;
      l.precioDoc = l.k.cant ? Math.round((l.k.venta + extra) / l.k.cant) : 0;
      l.totalDoc = l.precioDoc * l.k.cant;
    }
    subtotal = lineas.reduce((s, l) => s + l.totalDoc, 0);
    despCobro = subtotal - venta;
  } else {
    for (const l of lineas) { l.precioDoc = l.k.precioU; l.totalDoc = l.k.venta; }
    subtotal = venta;
  }
  // Descuento sobre el precio de venta: baja el neto (y el margen), no los costos.
  const pctDesc = Math.min(100, Math.max(0, +d.descuento || 0));
  const descuento = Math.round(subtotal * pctDesc / 100);
  const neto = subtotal - descuento;
  const iva = Math.round(neto * IVA);
  const costoTot = costo + despCosto, margen = neto - costoTot;
  return { lineas, ventaProductos: venta, costoProductos: costo, despCobro, despCosto,
    despIncluido: incluido, despEnLinea: false, subtotal, pctDesc, descuento,
    margenSinDesc: subtotal ? (subtotal - costoTot) / subtotal : 0,
    neto, iva, bruto: neto + iva, costo: costoTot, margen, margenPct: neto ? margen / neto : 0 };
}
const totalesGuardables = d => { const { lineas, ...t } = calcTotales(d); return t; };
const numDoc = c => c.numero ? c.numero + (c.version ? '-' + c.version : '') : '';

/* ---------------- Despacho (Correos) ---------------- */
function destinoEfectivo(d) { return d.despacho.destino || Envio.destinoDe(d.cliente.region, d.cliente.comuna); }
function piezasEnvio(d) {
  return d.items.map(normalizarItem).filter(i => medidaEf(i) && areaDe(medidaEf(i)) > 0 && +i.cantidad > 0)
    .map(i => ({ medida: medidaEf(i), area: areaDe(medidaEf(i)), cantidad: +i.cantidad }));
}
/* Recalcula el costo del despacho de la cotización en edición. */
function actualizarDespacho() {
  const ds = D.despacho;
  ds.calc = null;
  if (ds.modo === 'domicilio' || ds.modo === 'sucursal') {
    const destino = destinoEfectivo(D);
    const opts = { tabla: CFG.capacidad, pesoM2: +CFG.pesoM2 || 0.2, servicio: ds.modo, destino, secundaria: !!ds.secundaria };
    if (!destino) { ds.calc = { error: 'Elige la región del cliente o el destino Correos.' }; ds.costo = 0; }
    else {
      const r = ds.manual ? Envio.precioManual(ds.manual, CFG.cajas, opts) : Envio.empacar(piezasEnvio(D), CFG.cajas, opts);
      ds.calc = { ...r, destino, servicio: ds.modo };
      ds.costo = r.costo;
    }
  } else if (ds.modo === 'retiro') {
    ds.costo = 0;
  }
  ds.cobro = ds.costo; ds.cobroManual = false;   // al cliente se le cobra lo que cuesta (repartido en los precios)
}
function renderDespacho() {
  const ds = D.despacho, correos = ds.modo === 'domicilio' || ds.modo === 'sucursal';
  $$('[data-solo-correos]').forEach(e => e.style.display = correos ? '' : 'none');
  $('#despManualBox').style.display = ds.modo === 'manual' ? '' : 'none';
  if (document.activeElement !== $('#despCosto')) $('#despCosto').value = miles(ds.costo);
  const auto = Envio.destinoDe(D.cliente.region, D.cliente.comuna);
  $('#despDestino').innerHTML = `<option value="">${auto ? 'Automático: ' + esc(auto) : 'Automático (elige región)'}</option>` +
    Envio.DESTINOS.map(x => opt(x, ds.destino)).join('');
  const c = ds.calc, el = $('#despCalc');
  if (!correos || !c) { el.innerHTML = ''; return; }
  if (c.error) { el.innerHTML = `<div class="warn-txt">${esc(c.error)}</div>`; return; }
  const cajas = c.cajas.length ? c.cajas.map(x => `<span class="caja">${x.n} × ${esc(x.nombre)} <small>(${String(x.kg).replace('.', ',')} kg)</small> · <b>${clp(x.unitario)}</b> c/u</span>`).join('')
    : '<span class="hint">Sin banderas con medida para despachar.</span>';
  const man = CFG.cajas.map(b => `<label>${esc(b.nombre)} <input type="number" min="0" data-caja="${b.id}" value="${ds.manual ? (+ds.manual[b.id] || 0) : (c.cajas.find(x => x.id === b.id)?.n || 0)}"></label>`).join('');
  el.innerHTML = `<div class="cajas">${cajas}<span>→ total Correos <b>${clp(c.costo)}</b></span></div>
    ${c.avisos.map(a => `<div class="warn-txt">${esc(a)}</div>`).join('')}
    <div class="manual">${ds.manual ? 'Cajas a mano:' : 'Ajustar cajas:'} ${man}
      ${ds.manual ? '<a href="#" class="mini" data-caja-auto>volver a cálculo automático</a>' : ''}</div>`;
}
/* Cotizaciones antiguas: "ítem libre" pasa a producto "Otro"; Wincha → Huincha. */
function normalizarItem(it) {
  if (it.libre) { it.producto = 'Otro'; it.productoOtro = it.productoOtro || it.descripcion || ''; delete it.libre; }
  if (!it.producto) it.producto = 'Bandera';
  if (it.vaina === 'Wincha poliéster y argollas') it.vaina = 'Huincha poliéster y argollas';
  return it;
}
const esBandera = it => (it.producto || 'Bandera') === 'Bandera';
const productoEf = it => it.producto === 'Otro' ? (it.productoOtro || '') : (it.producto || 'Bandera');
const materialEf = it => it.material === 'Otro' ? (it.materialOtro || '') : (it.material || '');
const medidaEf = it => it.medida === 'Otra' ? normMedida(it.medidaOtra || '') : (it.medida || '');
function tituloAuto(it) {
  if (!esBandera(it)) return productoEf(it);
  return String(it.tipo || '').replace(/\s*\d\/Faz/i, '').replace(/\s*\(.*?\)/, '').trim();
}
function actualizarTituloAuto(it) {
  if (!it.titulo || it.titulo === it._tituloAuto) { it.titulo = tituloAuto(it); it._tituloAuto = it.titulo; }
}
function materialDoc(it) {
  const faz = esBandera(it) && /2\/Faz/i.test(it.tipo) ? ' doble faz' : '';
  return materialEf(it) + (materialEf(it) ? faz : '');
}
function descItem(it) {
  normalizarItem(it);
  return [esBandera(it) ? it.tipo : productoEf(it), materialEf(it), medidaEf(it) ? medidaEf(it) + ' m' : ''].filter(Boolean).join(' · ');
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
  if (view !== 'cotizar') actualizar();
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
  $('#cotTitulo').textContent = D.numero ? `Cotización N° ${numDoc(D)}${D.version ? ' (actualizada)' : ''}` : 'Nueva cotización';
  $$('[data-c]').forEach(i => i.value = D.cliente[i.dataset.c] || '');
  marcarRut($('[data-c="rut"]'));
  llenarCondPago($('[data-d="condPago"]'), D.condPago);
  $$('[data-d]').forEach(i => i.value = D[i.dataset.d] || '');
  const ds = D.despacho;
  if (!ds.modo) ds.modo = 'manual';            // cotizaciones antiguas: monto a mano
  if (!ds.mostrar) ds.mostrar = 'linea';
  $('#despModo').value = ds.modo;
  $('#despSecundaria').checked = !!ds.secundaria;
  renderFechas();
  renderChipsGlobal();
  renderItems();
}
function renderFechas() {
  $('#fechaPlazo').textContent = esNumero(D.plazo) ? '→ ' + fechaLarga(sumarDiasHabiles(D.fecha, +D.plazo)) : '';
  $('#fechaValidez').textContent = esNumero(D.validez) ? '→ hasta ' + fechaLarga(sumarDiasHabiles(D.fecha, +D.validez)) : '';
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
  if (!esBandera(it) || !it.tipo || it.material === 'Otro' || it.medida === 'Otra') return null;
  const r = MATRIZ.find(r => r.tipo === it.tipo && r.material === it.material && r.medida === it.medida);
  return r ? +r.costo : null;
}
const opt = (v, sel, label) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label ?? v)}</option>`;

function opcionesMaterialItem(it) {
  const deMatriz = esBandera(it) && it.tipo ? opcionesMaterial(it.tipo) : [];
  return { deMatriz, resto: CFG.materiales.filter(m => !deMatriz.includes(m)) };
}
function opcionesMedidaItem(it) {
  const deMatriz = esBandera(it) && it.tipo && it.material && it.material !== 'Otro' ? opcionesMedida(it.tipo, it.material) : [];
  const todas = [...new Set(MATRIZ.map(r => r.medida))].sort((a, b) => areaDe(a) - areaDe(b));
  return { deMatriz, resto: todas.filter(m => !deMatriz.includes(m)) };
}
function selectGrupos(campo, valor, deMatriz, resto, otro, extra = '') {
  const g = (lbl, arr) => arr.length ? `<optgroup label="${lbl}">${arr.map(x => opt(x, valor)).join('')}</optgroup>` : '';
  const conocido = !valor || valor === otro || deMatriz.includes(valor) || resto.includes(valor);
  return `<select data-f="${campo}" ${extra}><option value="">Elegir…</option>
    ${deMatriz.length ? g('Con costo en la matriz', deMatriz) + g('Otros', resto) : resto.map(x => opt(x, valor)).join('')}
    ${conocido ? '' : opt(valor, valor)}<option value="${otro}" ${valor === otro ? 'selected' : ''}>${otro}… (escribir)</option></select>`;
}
function renderItems() {
  $('#items').innerHTML = D.items.map((it, i) => {
    normalizarItem(it);
    const band = esBandera(it), foto = imgDe(it.imagen), cm = costoMatriz(it);
    const mats = opcionesMaterialItem(it), meds = opcionesMedidaItem(it);
    const notaCosto = cm != null
      ? (it.costoManual && +it.costo !== cm ? `✎ a mano · <a href="#" data-act="matriz">usar matriz (${clp(cm)})</a>` : 'de la matriz de costos')
      : (band && !it.tipo ? 'elige el tipo para traerlo de la matriz' : 'escríbelo a mano');
    return `<div class="item ${foto ? 'con-foto' : 'sin-foto'}" data-id="${it.id}">
      ${foto ? `<img class="item-fondo" src="${foto}" alt="">` : ''}
      <div class="item-head">
        <span class="item-num">${i + 1}</span>
        <input class="item-nombre" data-f="titulo" value="${esc(it.titulo)}" placeholder="Nombre del producto (ej: Pabellón Nacional)">
        <span class="item-acc">
          <input type="file" accept="image/*,.svg,image/svg+xml,.pdf,application/pdf,.ai" data-file hidden>
          ${foto ? '<button class="btn sm ghost" data-act="img">Cambiar imagen</button>'
            : `<button class="sin-img" data-act="img" title="Agregar imagen">${ICONO_BANDERA}<span>Sin imagen</span><b>＋ Agregar</b></button>`}
          ${it.imagen ? '<button class="btn sm ghost" data-act="sinimg">Quitar imagen</button>' : ''}
          <button class="btn sm ghost" data-act="dup">Duplicar</button>
          <button class="btn sm ghost danger" data-act="del">Quitar</button></span>
      </div>
      <div class="item-def">
        <label>Producto
          <select data-f="producto">${PRODUCTOS.map(p => opt(p, it.producto)).join('')}</select>
          ${it.producto === 'Otro' ? `<input data-f="productoOtro" value="${esc(it.productoOtro)}" placeholder="¿Qué producto? (ej: mástil 6 m)">` : ''}</label>
        <label class="${band ? '' : 'no-aplica'}">Tipo de bandera
          ${band ? `<select data-f="tipo"><option value="">Elegir…</option>${opcionesTipo().map(t => opt(t, it.tipo)).join('')}</select>
            ${!it.tipo ? '<small class="nota">Elige el tipo para traer el costo de la matriz</small>' : ''}`
          : `<select disabled><option>No aplica</option></select><small class="nota">Solo se llena cuando el producto es “Bandera”</small>`}</label>
        <label>Material
          ${selectGrupos('material', it.material, mats.deMatriz, mats.resto, 'Otro')}
          ${it.material === 'Otro' ? `<input data-f="materialOtro" value="${esc(it.materialOtro)}" placeholder="¿Qué material?">` : ''}</label>
        <label>Medida (m)
          ${selectGrupos('medida', it.medida, meds.deMatriz, meds.resto, 'Otra')}
          ${it.medida === 'Otra' ? `<input data-f="medidaOtra" value="${esc(it.medidaOtra)}" placeholder="Ej: 1,50 x 1,00">` : ''}</label>
        <label>Terminación
          <select data-f="vaina"><option value="">Elegir…</option>${VAINAS.concat(it.vaina && !VAINAS.includes(it.vaina) ? [it.vaina] : []).map(v => opt(v, it.vaina)).join('')}</select></label>
      </div>
      <div class="item-precio">
        <label>Cantidad<input type="number" min="0" data-f="cantidad" value="${esc(it.cantidad)}"></label>
        <label>Costo unit. neto<input data-money inputmode="numeric" data-f="costo" value="${miles(it.costo)}"><small class="nota">${notaCosto}</small></label>
        <div class="item-margen"><span class="lbl">Margen</span><span class="chips">${chipsHtml(it.margen, 'data-m')}</span></div>
      </div>
      <div class="item-res" data-res></div>
      <div class="item-desc">
        <textarea data-f="obs" rows="2" placeholder="Descripción para el cliente (sale en la cotización y en la OT): diseño, colores, escudo, flecos, etc.">${esc(it.obs)}</textarea>
      </div>
    </div>`;
  }).join('') || '<div class="empty">Sin productos. Agrega uno.</div>';
  recalc();
}

function recalc() {
  actualizarDespacho();
  renderDespacho();
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
  renderDescuento(t);
  $('#totales').innerHTML = `
    <div class="stat"><small>Productos (neto)</small><b>${clp(t.ventaProductos)}</b></div>
    <div class="stat"><small>${t.despIncluido ? 'Despacho (incluido en precios)' : 'Despacho cobrado'}</small><b>${clp(t.despCobro)}</b></div>
    <div class="stat"><small>${t.descuento ? `Total neto (con −${pct(t.pctDesc / 100)})` : 'Total neto'}</small><b>${clp(t.neto)}</b></div>
    <div class="stat"><small>IVA 19%</small><b>${clp(t.iva)}</b></div>
    <div class="stat big"><small>Total bruto (cliente paga)</small><b>${clp(t.bruto)}</b></div>
    <div class="stat"><small>Costo total (incl. despacho)</small><b>${clp(t.costo)}</b></div>
    <div class="stat ${t.margen < 0 ? 'bad' : 'hl'}"><small>Margen total</small><b>${clp(t.margen)}</b></div>
    <div class="stat ${t.margen < 0 ? 'bad' : 'hl'}"><small>Margen total %</small><b>${pct(t.margenPct)}</b></div>`;
  saveDraft();
}

function renderDescuento(t) {
  const v = +D.descuento || 0, rapido = DESCUENTOS_RAPIDOS.includes(v);
  const box = $('#chipsDesc');
  if (!box.contains(document.activeElement)) {
    box.innerHTML = `<button type="button" class="chip ${!v ? 'active' : ''}" data-desc="0">Sin descuento</button>` +
      DESCUENTOS_RAPIDOS.map(x => `<button type="button" class="chip ${v === x ? 'active' : ''}" data-desc="${x}">${x}%</button>`).join('') +
      `<span class="chip-input ${v && !rapido ? 'active' : ''}">otro <input type="number" min="0" max="90" step="0.5" data-desc-manual value="${v && !rapido ? v : ''}" placeholder="—">%</span>`;
  }
  $('#descInfo').innerHTML = t.descuento
    ? `−${clp(t.descuento)} · margen baja de <b>${pct(t.margenSinDesc)}</b> a <b class="${t.margen < 0 ? 'neg' : ''}">${pct(t.margenPct)}</b>` : '';
}
$('#chipsDesc').addEventListener('click', e => {
  if (e.target.dataset.desc == null) return;
  D.descuento = +e.target.dataset.desc; $('#chipsDesc').innerHTML = ''; recalc();
});
$('#chipsDesc').addEventListener('input', e => {
  if (!e.target.hasAttribute('data-desc-manual')) return;
  D.descuento = Math.min(90, Math.max(0, num(e.target.value)));
  $$('#chipsDesc .chip').forEach(c => c.classList.remove('active'));
  e.target.parentElement.classList.toggle('active', e.target.value !== '');
  recalc();
});

const itemDe = el => D.items.find(i => i.id === el.closest('.item')?.dataset.id);

const CAMPOS_DEF = ['producto', 'tipo', 'material', 'medida'];
$('#items').addEventListener('change', e => {
  if (e.target.matches('[data-file]')) {
    const it = itemDe(e.target), file = e.target.files[0];
    if (it && file) subirImagen(it, file);
    return;
  }
  const it = itemDe(e.target); const f = e.target.dataset.f; if (!it || !f) return;
  if (f === 'vaina') { it.vaina = e.target.value; saveDraft(); return; }
  if (f === 'medidaOtra') { it.medidaOtra = normMedida(e.target.value); e.target.value = it.medidaOtra; recalc(); return; }
  if (!CAMPOS_DEF.includes(f)) return;
  it[f] = e.target.value;
  if (f === 'producto') { if (!esBandera(it)) it.tipo = ''; actualizarTituloAuto(it); }
  if (f === 'tipo') {
    const ms = opcionesMaterial(it.tipo);
    if (it.material !== 'Otro' && ms.length && !ms.includes(it.material)) it.material = ms.length === 1 ? ms[0] : '';
    actualizarTituloAuto(it);
  }
  if (f === 'tipo' || f === 'material') {
    const ds = esBandera(it) && it.tipo && it.material && it.material !== 'Otro' ? opcionesMedida(it.tipo, it.material) : [];
    if (ds.length && it.medida !== 'Otra' && !ds.includes(it.medida)) it.medida = ds.length === 1 ? ds[0] : '';
  }
  const cm = costoMatriz(it);
  if (cm != null) { it.costo = cm; it.costoManual = false; }
  renderItems();
});
$('#items').addEventListener('input', e => {
  const it = itemDe(e.target); if (!it) return;
  const f = e.target.dataset.f;
  if (f === 'cantidad') { it.cantidad = num(e.target.value); recalc(); }
  else if (f === 'costo') { it.costo = num(e.target.value); it.costoManual = true; recalc(); }
  else if (f === 'productoOtro') {
    it.productoOtro = e.target.value;
    const antes = it.titulo; actualizarTituloAuto(it);
    if (it.titulo !== antes) e.target.closest('.item').querySelector('.item-nombre').value = it.titulo;
    saveDraft();
  }
  else if (f === 'materialOtro') { it.materialOtro = e.target.value; saveDraft(); }
  else if (f === 'medidaOtra') { it.medidaOtra = e.target.value; saveDraft(); }
  else if (f === 'descripcion' || f === 'obs' || f === 'titulo') { it[f] = e.target.value; saveDraft(); }
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
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'del') { D.items = D.items.filter(x => x !== it); renderItems(); renderChipsGlobal(); }
  if (act === 'dup') { const i = D.items.indexOf(it); D.items.splice(i + 1, 0, { ...it, id: uid() }); renderItems(); }
  if (act === 'img') e.target.closest('.item').querySelector('[data-file]').click();
  if (act === 'sinimg') { it.imagen = null; renderItems(); }
  if (act === 'matriz') { e.preventDefault(); it.costo = costoMatriz(it) ?? it.costo; it.costoManual = false; renderItems(); }
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
$$('[data-c]').forEach(i => i.oninput = () => { D.cliente[i.dataset.c] = i.value; saveDraft();
  if (i.dataset.c === 'comuna') recalc(); });
$$('[data-d]').forEach(i => i.oninput = () => { D[i.dataset.d] = i.value; saveDraft(); renderFechas(); });
$('#selRegion').innerHTML = '<option value="">Elegir…</option>' + REGIONES.map(r => `<option>${esc(r)}</option>`).join('');
$('#selRegion').onchange = e => { D.cliente.region = e.target.value; recalc(); };

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
$('#despCosto').oninput = e => { D.despacho.costo = num(e.target.value); recalc(); };
$('#despModo').onchange = e => { D.despacho.modo = e.target.value; D.despacho.cobroManual = false; recalc(); };
$('#despDestino').onchange = e => { D.despacho.destino = e.target.value; recalc(); };
$('#despSecundaria').onchange = e => { D.despacho.secundaria = e.target.checked; recalc(); };
$('#despCalc').addEventListener('change', e => {
  const id = e.target.dataset.caja; if (!id) return;
  const m = {}; $$('#despCalc [data-caja]').forEach(i => m[i.dataset.caja] = Math.max(0, num(i.value)));
  D.despacho.manual = m; recalc();
});
$('#despCalc').addEventListener('click', e => {
  if (!e.target.hasAttribute('data-caja-auto')) return;
  e.preventDefault(); D.despacho.manual = null; recalc();
});

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
const firmaCot = c => JSON.stringify([c.cliente, c.items, c.condPago, c.plazo, c.validez, c.garantia, c.obs, +c.descuento || 0,
  { ...c.despacho, calc: undefined }]);
async function guardarCotizacion(opciones = {}) {
  if (!validar()) return null;
  const snap = JSON.parse(JSON.stringify(D));
  snap.items = snap.items.filter(i => +i.cantidad > 0);
  snap.totales = totalesGuardables(snap);
  snap.actualizado = new Date().toISOString();
  if (!D.id) {
    Object.assign(snap, { id: uid(), numero: null, estado: 'Pendiente', fecha: hoy() });
  } else {
    const prev = COTS.find(c => c.id === D.id);
    snap.estado = prev?.estado || D.estado || 'Pendiente';
    if (prev?.otNumero) snap.otNumero = prev.otNumero;
    // Si ya se le había enviado el PDF al cliente y cambió algo, pasa a ser versión "actualizada" (N°-1, N°-2…)
    if (prev?.pdf && firmaCot(prev) !== firmaCot(snap)) { snap.version = (+prev.version || 0) + 1; snap.pdf = false; }
  }
  if (opciones.pdf) snap.pdf = true;
  try {
    if (nubeActiva()) Object.assign(snap, (await api('guardarCot', { cot: snap })).cot);
    else if (!snap.numero) { snap.numero = +CFG.nextCot || 1; CFG.nextCot = snap.numero + 1; saveCfg(); }
  } catch (e) { toast('No se pudo guardar: ' + e.message); return null; }
  const i = COTS.findIndex(c => c.id === snap.id);
  if (i >= 0) COTS[i] = snap; else COTS.unshift(snap);
  saveCots();
  D = JSON.parse(JSON.stringify(snap)); saveDraft();
  renderEditor();
  toast(`Cotización N° ${numDoc(snap)} guardada`);
  return snap;
}
$('#btnGuardar').onclick = conBoton($('#btnGuardar'), guardarCotizacion);
$$('[data-pdf]').forEach(b => b.onclick = conBoton(b, async () => {
  const c = await guardarCotizacion({ pdf: true });
  if (c) { if ($('#dlgVista').open) $('#dlgVista').close(); imprimirCotizacion(c); }
}));

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
/* Texto para el cliente: une saltos de línea sueltos y, si viene TODO EN MAYÚSCULAS,
   lo deja como oración (primera letra en mayúscula). Lo guardado no se modifica. */
function textoCliente(s) {
  s = String(s || '').replace(/\r/g, '').replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  const letras = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
  if (letras.length >= 8 && mayus / letras.length > 0.6) {
    s = s.toLowerCase().replace(/(^|[.!?]\s+|\n\s*)([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase());
    const nombres = (CFG.materiales || []).concat(['Bistrech', 'Trevira', 'Chile', 'Schoenstatt']);
    for (const n of nombres) s = s.replace(new RegExp('(^|[^a-záéíóúñü])' + n.toLowerCase() + '(?![a-záéíóúñü])', 'g'), (m, a) => a + n);
  }
  return s;
}
function htmlCotizacion(c) {
  const t = calcTotales(c);
  const cl = c.cliente || {};
  const br = s => esc(s).replace(/\n/g, '<br>');
  const medidaDoc = m => esc(String(m || '').replace(/\s*x\s*/i, ' × '));
  const filas = t.lineas.map((l, i) => {
    const it = normalizarItem(l.it), titulo = it.titulo || tituloAuto(it);
    return `<tr>
      <td class="n">${i + 1}</td>
      <td class="desc con-img">${imgDe(it.imagen) ? `<img class="fondo" src="${imgDe(it.imagen)}" alt="">`
        : `<div class="fondo vacio">${ICONO_BANDERA}<span>Sin imagen</span></div>`}
        <div class="txt"><div class="tit">${esc(titulo)}</div>${it.obs ? `<div class="det">${br(textoCliente(it.obs))}</div>` : ''}</div></td>
      <td class="c">${medidaDoc(medidaEf(it))}</td>
      <td class="c">${l.k.cant}</td>
      <td class="m">${clp(l.precioDoc)}</td>
      <td class="m b">${clp(l.totalDoc)}</td></tr>`;
  }).join('');
  const d = c.despacho || {};
  const destino = d.calc?.destino || d.destino || Envio.destinoDe(cl.region, cl.comuna) || '';
  const via = d.modo === 'sucursal' ? 'Correos de Chile, retiro en sucursal' : d.modo === 'domicilio' ? 'Correos de Chile a domicilio' : (d.nota || 'Despacho');
  const filaDesp = t.despEnLinea ? `<tr>
      <td class="n">${t.lineas.length + 1}</td>
      <td class="desc"><div class="tit">Despacho</div><div class="det">${esc(d.nota || via)}${destino && !d.nota ? ' · ' + esc(destino) : ''}</div></td>
      <td class="c"></td><td class="c">1</td><td class="c"></td>
      <td class="m">${clp(t.despCobro)}</td><td class="m b">${clp(t.despCobro)}</td></tr>` : '';
  const textoDesp = d.modo === 'retiro' ? 'Retiro en nuestro taller (Viña del Mar)'
    : d.modo === 'sucursal' ? 'Gratis · retiro en sucursal Correos de Chile'
    : d.modo === 'domicilio' ? 'Gratis · a domicilio' : 'Gratis';
  const plazo = esNumero(c.plazo)
    ? `${+c.plazo} días hábiles <span class="sub">(aprox. ${fechaCL(sumarDiasHabiles(c.fecha, +c.plazo))})</span>` : esc(c.plazo || '');
  const validez = esNumero(c.validez)
    ? `${+c.validez} días hábiles <span class="sub">(hasta ${fechaCL(sumarDiasHabiles(c.fecha, +c.validez))})</span>` : esc(c.validez || '');
  const fila = (k, v) => v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '';
  const contactos = String(CFG.contactos || '').split('\n').map(s => s.trim()).filter(Boolean);
  const num = c.numero ? numDoc(c) : '<span class="borrador">borrador</span>';
  return `<div class="cot">
    <header class="cot-top">
      <div class="cot-brand"><img src="logo.png" alt="Gary">
        ${CFG.lema ? `<div class="cot-lema">${br(CFG.lema)}</div>` : ''}</div>
      <div class="cot-titulo">
        <div class="cot-tag">Cotización</div>
        <div class="cot-nro">N° ${num}</div>
        ${c.version ? '<div class="cot-act">Versión actualizada</div>' : ''}
        <div class="cot-fecha">${fechaCL(c.fecha)}</div>
      </div>
    </header>

    <section class="cot-info">
      <div class="cot-card">
        <h5>Cliente</h5>
        <div class="cot-cliente">${esc(cl.nombre)}</div>
        ${fila('RUT', esc(cl.rut))}
        ${fila('Atención', esc(cl.contacto))}
        ${fila('Teléfono', esc(cl.telefono))}
        ${fila('Email', esc(cl.email))}
        ${fila('Dirección', esc([cl.direccion, cl.comuna, cl.region ? 'Región ' + cl.region : ''].filter(Boolean).join(', ')))}
      </div>
      <div class="cot-card">
        <h5>Condiciones comerciales</h5>
        ${fila('Condición de pago', esc(c.condPago))}
        ${fila('Plazo de entrega', plazo)}
        ${fila('Validez de la oferta', validez)}
        ${fila('Garantía de confección', esc(c.garantia))}
        ${fila('Despacho', esc(textoDesp))}
      </div>
    </section>

    <p class="cot-intro">Gracias por considerarnos para esta compra. A continuación le hacemos llegar nuestra propuesta:</p>

    <table class="cot-items">
      <thead><tr><th class="n">#</th><th>Descripción</th><th class="c">Medida (m)</th><th class="c">Cant.</th>
<th class="m">P. unitario</th><th class="m">Total neto</th></tr></thead>
      <tbody>${filas}${filaDesp}</tbody>
    </table>

    <section class="cot-bottom">
      <div class="cot-notas">
        ${c.obs ? `<div class="cot-nota">${br(textoCliente(c.obs))}</div>` : ''}
        ${d.modo !== 'retiro' ? `<div class="cot-gratis">${ICONO_CAMION}<span><b>Despacho gratis</b>${d.modo === 'sucursal' ? ' · retiro en sucursal Correos' : ' a domicilio'}</span></div>` : ''}
        <p class="cot-acepta">Para aceptar esta cotización, responda este correo o envíe su orden de compra indicando el N° ${c.numero ? numDoc(c) : 'de cotización'}.</p>
      </div>
      <table class="cot-tot">
        ${t.descuento ? `<tr><td>Subtotal</td><td>${clp(t.subtotal)}</td></tr>
        <tr class="dcto"><td>Descuento ${pct(t.pctDesc / 100)}</td><td>−${clp(t.descuento)}</td></tr>` : ''}
        <tr><td>Total neto</td><td>${clp(t.neto)}</td></tr>
        <tr><td>IVA 19%</td><td>${clp(t.iva)}</td></tr>
        <tr class="final"><td>Total</td><td>${clp(t.bruto)}</td></tr>
      </table>
    </section>

    <div class="cot-cierre">
    <section class="cot-pago">
      <div>
        <h5>Datos para transferencia</h5>
        ${CFG.empresa ? `<div class="fuerte">${esc(CFG.empresa)}</div>` : ''}
        ${fila('RUT', esc(CFG.rutEmpresa))}
        ${fila('Banco', esc(CFG.banco))}
        ${fila('Cuenta corriente', esc(CFG.cuentaCte))}
        ${fila('Email', esc(CFG.mailEmpresa))}
      </div>
      <div>
        <h5>Contactos</h5>
        ${contactos.map(x => `<div class="fuerte">${esc(x)}</div>`).join('')}
        ${CFG.fonoEmpresa ? `<div>${esc(CFG.fonoEmpresa)}</div>` : ''}
        ${CFG.mailEmpresa ? `<div>${esc(CFG.mailEmpresa)}</div>` : ''}
      </div>
      <div class="cot-sellos">
        <img src="sello-chilecompra.png" alt="Proveedores del Estado – ChileCompra" class="cc">
        <img src="sello-mujer.png" alt="Sello Empresa Mujer" class="sm">
      </div>
    </section>

    <footer class="cot-foot">
      <img src="logo-compacto.png" alt="">
      <div>${esc(CFG.empresa)}${CFG.dirEmpresa ? ' · ' + esc(CFG.dirEmpresa) : ''}${CFG.web ? ` · <span class="web">${esc(CFG.web)}</span>` : ''}</div>
    </footer>
    </div>
  </div>`;
}
async function imprimirCotizacion(c) {
  await asegurarImagenes(c.items);
  imprimir(htmlCotizacion(c), `Cotización ${numDoc(c)}${c.version ? ' (actualizada)' : ''} · ${c.cliente.nombre} · Banderas Gary`);
}

/* Vista previa: muestra la cotización tal como la recibe el cliente, sin guardar. */
async function verCotizacion() {
  await asegurarImagenes(D.items);
  const c = JSON.parse(JSON.stringify(D));
  c.items = c.items.filter(i => +i.cantidad > 0 && calcItem(i).precioU);
  if (!c.items.length) { toast('Agrega al menos un producto con costo para ver la cotización'); return; }
  if (!c.numero) c.fecha = hoy();
  $('#vistaDoc').innerHTML = htmlCotizacion(c);
  $('#dlgVista').showModal();
  ajustarVista();
  $('.vista-papel').scrollTop = 0;
}
/* En pantallas chicas, achica la hoja para que se vea completa (como un PDF). */
function ajustarVista() {
  const doc = $('#vistaDoc'), papel = $('.vista-papel');
  doc.style.zoom = 1;
  const disponible = papel.clientWidth - parseFloat(getComputedStyle(papel).paddingLeft) * 2;
  doc.style.zoom = Math.min(1, disponible / doc.offsetWidth);
}
window.addEventListener('resize', () => { if ($('#dlgVista').open) ajustarVista(); });
$$('[data-ver]').forEach(b => b.onclick = verCotizacion);
$('#btnVistaCerrar').onclick = () => $('#dlgVista').close();
async function imprimirOt(o) {
  await asegurarImagenes(o.items);
  const filas = o.items.map((it, i) => `<tr><td class="num">${i + 1}</td><td class="num">${+it.cantidad}</td>
    <td>${esc((normalizarItem(it), it.titulo || (esBandera(it) ? it.tipo : productoEf(it))))}${esBandera(it) && it.tipo && it.titulo ? '<br><small>' + esc(it.tipo) + '</small>' : ''}</td><td>${esc(materialEf(it))}${it.vaina ? '<br><small>' + esc(it.vaina) + '</small>' : ''}</td><td>${esc(medidaEf(it))}</td>
    <td>${imgDe(it.imagen) ? `<img src="${imgDe(it.imagen)}" style="height:60px;float:right;margin-left:8px;border-radius:4px">` : ''}${esc(it.obs)}</td><td style="width:60px"></td></tr>`).join('');
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
      return `<tr data-id="${c.id}"><td><b>${numDoc(c)}</b></td><td>${fechaCL(c.fecha)}</td><td>${esc(c.cliente.nombre)}</td>
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
$('#tablaCot').addEventListener('click', async e => {
  const a = e.target.dataset.a; if (!a) return;
  if (['rechazar', 'borrar', 'aprobar'].includes(a)) {
    if (e.target.disabled) return;
    e.target.disabled = true;
    try { await accionCot(a, e.target.closest('tr').dataset.id); }
    catch (err) { toast('No se pudo completar: ' + err.message); }
    finally { e.target.disabled = false; }
    return;
  }
  const c = COTS.find(x => x.id === e.target.closest('tr').dataset.id); if (!c) return;
  if (a === 'abrir') {
    D = JSON.parse(JSON.stringify(c)); saveDraft(); renderEditor(); mostrar('cotizar');
    asegurarImagenes(D.items).then(ok => { if (ok) renderItems(); });
  }
  if (a === 'pdf') imprimirCotizacion(c);
  if (a === 'duplicar') {
    D = JSON.parse(JSON.stringify(c)); Object.assign(D, { id: null, numero: null, fecha: hoy() });
    D.items.forEach(i => i.id = uid()); saveDraft(); renderEditor(); mostrar('cotizar'); toast('Copia lista para editar');
  }
});
async function accionCot(a, id) {
  const c = COTS.find(x => x.id === id); if (!c) return;
  if (a === 'rechazar') {
    const cot = { ...c, estado: 'Rechazada' };
    if (nubeActiva()) await api('guardarCot', { cot });
    c.estado = 'Rechazada';
  }
  if (a === 'borrar') {
    if (!confirm(`¿Borrar la cotización N° ${c.numero}? No se puede deshacer.`)) return;
    if (nubeActiva()) await api('borrarCot', { id: c.id });
    COTS = COTS.filter(x => x !== c);
  }
  if (a === 'aprobar') {
    let ot = OTS.find(o => o.cotId === c.id);
    if (!ot) {
      ot = { id: uid(), numero: null, fecha: hoy(), cotId: c.id, cotNumero: c.numero,
        cliente: { ...c.cliente }, plazo: c.plazo, obs: c.obs,
        despacho: [c.despacho.nota, [c.cliente.direccion, c.cliente.comuna, c.cliente.region].filter(Boolean).join(', ')].filter(Boolean).join(' — '),
        items: c.items.map(x => normalizarItem({ ...x })).map(({ producto, productoOtro, tipo, material, materialOtro, medida, medidaOtra, vaina, titulo, cantidad, obs, imagen }) =>
          ({ producto, productoOtro, tipo, material, materialOtro, medida, medidaOtra, vaina, titulo, cantidad, obs, imagen })),
        estado: 'Pendiente' };
    }
    if (nubeActiva()) {
      const j = await api('aprobar', { id: c.id, ot });
      Object.assign(c, j.cot); ot = j.ot;
    } else {
      if (!ot.numero) { ot.numero = +CFG.nextOt || 1; CFG.nextOt = ot.numero + 1; saveCfg(); }
      c.estado = 'Aprobada'; c.otNumero = ot.numero;
    }
    const k = OTS.findIndex(o => o.id === ot.id);
    if (k >= 0) OTS[k] = ot; else OTS.unshift(ot);
    saveOts();
    toast(`Cotización ${c.numero} aprobada → OT N° ${ot.numero} creada`);
  }
  saveCots(); renderCotizaciones();
}

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
$('#tablaOt').addEventListener('click', async e => {
  const a = e.target.dataset.a; const o = OTS.find(x => x.id === e.target.closest('tr')?.dataset.id); if (!o) return;
  if (a === 'pdf') imprimirOt(o);
  if (a === 'borrar' && confirm(`¿Borrar la OT N° ${o.numero}?`)) {
    try { if (nubeActiva()) await api('borrarOt', { id: o.id }); }
    catch (err) { toast('No se pudo borrar: ' + err.message); return; }
    OTS = OTS.filter(x => x !== o); saveOts(); renderOts();
  }
});
$('#tablaOt').addEventListener('change', async e => {
  if (e.target.dataset.a !== 'estado') return;
  const o = OTS.find(x => x.id === e.target.closest('tr').dataset.id); const antes = o.estado;
  o.estado = e.target.value;
  try { if (nubeActiva()) await api('guardarOt', { ot: o }); saveOts(); toast(`OT ${o.numero}: ${o.estado}`); }
  catch (err) { o.estado = antes; e.target.value = antes; toast('No se pudo guardar: ' + err.message); }
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
function tocarMatriz() { MATRIZ_EJEMPLO = false; saveMatriz(); $('#avisoEjemplo').style.display = 'none'; subirMatriz(); }
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
  subirConfig({ tipos: CFG.tipos, materiales: CFG.materiales }).catch(err => toast('No se pudo guardar: ' + err.message));
  toast(`${nuevas.length} filas importadas` + (malas.length ? ` · ${malas.length} ignoradas` : ''));
};

/* ---------------- Configuración ---------------- */
function llenarCondPago(sel, valor) {
  const ops = CONDICIONES_PAGO.concat(valor && !CONDICIONES_PAGO.includes(valor) ? [valor] : []);
  sel.innerHTML = '<option value="">Elegir…</option>' + ops.map(o => opt(o, valor)).join('');
}
function renderConfig() {
  llenarCondPago($('[data-cfg="condPago"]'), CFG.condPago); $$('[data-cfg]').forEach(i => i.value = CFG[i.dataset.cfg] ?? '');
  renderCajas();
}
function renderCajas() {
  $('#avisoCajas').style.display = CFG.cajasEjemplo ? '' : 'none';
  const cajas = CFG.cajas || [];
  $('#tablaCajas').innerHTML = `<thead><tr><th>Caja</th><th class="num">Largo cm</th><th class="num">Ancho cm</th><th class="num">Alto cm</th>
    <th class="num">Peso caja kg</th><th class="num">m² de bandera que caben</th><th class="num">Peso vol. kg</th></tr></thead><tbody>` +
    cajas.map(c => `<tr data-caja="${c.id}"><td><input data-k="nombre" value="${esc(c.nombre)}"></td>
      ${['largo', 'ancho', 'alto', 'pesoVacia', 'capM2'].map(k => `<td class="num"><input class="n" type="number" min="0" step="any" data-k="${k}" value="${esc(c[k])}"></td>`).join('')}
      <td class="num">${String(Math.round(Envio.volumetrico(c) * 10) / 10).replace('.', ',')}</td></tr>`).join('') + '</tbody>';
  const medidas = [...new Set(MATRIZ.map(r => r.medida).concat(Object.keys(CFG.capacidad || {})))]
    .sort((a, b) => areaDe(a) - areaDe(b));
  $('#tablaCapacidad').innerHTML = `<thead><tr><th>Medida (m)</th>${cajas.map(c => `<th class="num">${esc(c.nombre)}</th>`).join('')}</tr></thead><tbody>` +
    medidas.map(m => `<tr data-medida="${esc(m)}"><td>${esc(m)}</td>${cajas.map(c => {
      const v = (CFG.capacidad[m] || {})[c.id];
      const est = c.capM2 > 0 ? Math.floor(c.capM2 / areaDe(m)) : '';
      return `<td class="num"><input class="n" type="number" min="0" data-cap="${c.id}" value="${v ?? ''}" placeholder="≈${est}"></td>`;
    }).join('')}</tr>`).join('') + '</tbody>';
}
function guardarCajas() {
  CFG.cajasEjemplo = false; saveCfg(); renderCajas(); recalc();
  subirConfig({ cajas: CFG.cajas, capacidad: CFG.capacidad, cajasEjemplo: false })
    .then(() => toast('Guardado'), err => toast('No se pudo guardar: ' + err.message));
}
$('#tablaCajas').addEventListener('change', e => {
  const k = e.target.dataset.k, c = CFG.cajas.find(x => x.id === e.target.closest('tr')?.dataset.caja); if (!k || !c) return;
  c[k] = k === 'nombre' ? e.target.value : (parseFloat(String(e.target.value).replace(',', '.')) || 0);
  guardarCajas();
});
$('#tablaCapacidad').addEventListener('change', e => {
  const id = e.target.dataset.cap, m = e.target.closest('tr')?.dataset.medida; if (!id || !m) return;
  CFG.capacidad = CFG.capacidad || {};
  const fila = CFG.capacidad[m] = CFG.capacidad[m] || {};
  if (e.target.value === '') delete fila[id]; else fila[id] = Math.max(0, Math.floor(num(e.target.value)));
  if (!Object.keys(fila).length) delete CFG.capacidad[m];
  guardarCajas();
});
$$('[data-cfg]').forEach(i => i.onchange = () => {
  const k = i.dataset.cfg;
  CFG[k] = (k === 'plazo' || k === 'validez') ? (i.value === '' ? '' : num(i.value))
    : k === 'pesoM2' ? (parseFloat(String(i.value).replace(',', '.')) || 0)
    : i.type === 'number' || k === 'redondeo' ? num(i.value) : i.value;
  saveCfg();
  if (k === 'redondeo') recalc();
  subirConfig({ [k]: CFG[k] }).then(() => toast('Guardado'), err => toast('No se pudo guardar: ' + err.message));
  if (!nubeActiva()) toast('Guardado');
});
$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ config: CFG, matriz: MATRIZ, matrizEjemplo: MATRIZ_EJEMPLO, cotizaciones: COTS, ots: OTS }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `respaldo-cotizador-${hoy()}.json`; a.click();
};
$('#fileImport').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!confirm('Esto REEMPLAZA todos los datos (de todos los usuarios) por los del respaldo. ¿Seguir?')) return;
    CFG = Object.assign({}, CONFIG_DEF, j.config); MATRIZ = j.matriz || []; MATRIZ_EJEMPLO = !!j.matrizEjemplo;
    COTS = j.cotizaciones || []; OTS = j.ots || [];
    if (nubeActiva()) await api('restaurar', { config: CFG, matriz: MATRIZ, ejemplo: MATRIZ_EJEMPLO, cotizaciones: COTS, ots: OTS });
    saveCfg(); saveMatriz(); saveCots(); saveOts(); renderConfig(); toast('Respaldo restaurado');
  } catch (err) { alert('El archivo no es un respaldo válido.'); }
  e.target.value = '';
};

/* ---------------- Inicio ---------------- */
renderEditor();
asegurarImagenes(D.items).then(ok => { if (ok) renderItems(); });
if (nubeActiva()) {
  actualizar();
  // Mantener sincronizado: al volver a la pestaña y cada 60 s.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizar(); });
  setInterval(() => { if (!document.hidden) actualizar(); }, 60000);
} else {
  estadoNube('Solo este equipo', 'local');
}
