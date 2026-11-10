/**
 * Cotizador Gary — servidor (Google Apps Script dentro de la Google Sheet de datos).
 *
 * Guarda todo en pestañas de la planilla:
 *   Cotizaciones · OT · Matriz · Config
 * La pestaña "Matriz" se puede editar a mano directo en la planilla.
 *
 * INSTALACIÓN (una sola vez): ver README.md, sección "Nube".
 */

const HOJAS = {
  Cotizaciones: ['N°', 'Fecha', 'Cliente', 'RUT', 'Neto', 'Total bruto', 'Margen %', 'Estado', 'OT', 'id', 'datos'],
  OT: ['N°', 'Fecha', 'Cliente', 'Cotización', 'Estado', 'id', 'datos'],
  Matriz: ['Tipo', 'Material', 'Medida', 'Costo neto', 'id'],
  Config: ['clave', 'valor'],
};

/* ---------------- Entrada ---------------- */
function doGet(e) { return manejar_((e && e.parameter) || {}); }
function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (_) { /* cuerpo inválido */ }
  return manejar_(b);
}
function manejar_(b) {
  const fn = ACCIONES[b.accion];
  if (!fn) return out_({ ok: false, error: 'Acción desconocida' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out_({ ok: false, error: 'Servidor ocupado, intenta de nuevo' });
  try { return out_(Object.assign({ ok: true }, fn(b))); }
  catch (err) { return out_({ ok: false, error: String((err && err.message) || err) }); }
  finally { lock.releaseLock(); }
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Acciones ---------------- */
const ACCIONES = {
  cargar: () => ({
    config: leerConfig_(), matriz: leerMatriz_(),
    cotizaciones: leerJson_('Cotizaciones'), ots: leerJson_('OT'),
  }),

  guardarConfig: b => {
    const c = leerConfig_();
    Object.assign(c, b.config || {});
    escribirConfig_(c);
    return { config: c };
  },

  guardarMatriz: b => {
    escribirMatriz_(b.matriz || []);
    const c = leerConfig_(); c.matrizEjemplo = !!b.ejemplo; escribirConfig_(c);
    return {};
  },

  // Crea o actualiza una cotización. Si es nueva, el número correlativo lo asigna el servidor.
  guardarCot: b => {
    const cot = b.cot;
    if (!cot || !cot.id) throw new Error('Cotización inválida');
    if (!cot.numero) {
      const c = leerConfig_();
      cot.numero = Number(c.nextCot) || 1;
      c.nextCot = cot.numero + 1;
      escribirConfig_(c);
    }
    guardarFila_('Cotizaciones', cot.id, filaCot_(cot));
    return { cot };
  },

  borrarCot: b => { borrarFila_('Cotizaciones', b.id); return {}; },

  // Marca la cotización como aprobada y crea su OT (una sola vez) con el siguiente número.
  aprobar: b => {
    const r = filaDe_('Cotizaciones', b.id);
    if (r < 0) throw new Error('Cotización no encontrada');
    const cot = JSON.parse(hoja_('Cotizaciones').getRange(r, HOJAS.Cotizaciones.length).getValue());
    let ot = leerJson_('OT').find(o => o.cotId === cot.id);
    if (!ot) {
      ot = b.ot || {};
      const c = leerConfig_();
      ot.numero = Number(c.nextOt) || 1;
      c.nextOt = ot.numero + 1;
      escribirConfig_(c);
      ot.id = ot.id || Utilities.getUuid();
      ot.cotId = cot.id; ot.cotNumero = cot.numero;
      guardarFila_('OT', ot.id, filaOt_(ot));
    }
    cot.estado = 'Aprobada'; cot.otNumero = ot.numero;
    guardarFila_('Cotizaciones', cot.id, filaCot_(cot));
    return { cot, ot };
  },

  guardarOt: b => {
    if (!b.ot || !b.ot.id) throw new Error('OT inválida');
    guardarFila_('OT', b.ot.id, filaOt_(b.ot));
    return { ot: b.ot };
  },

  borrarOt: b => { borrarFila_('OT', b.id); return {}; },

  // Reemplaza todo con un respaldo.
  restaurar: b => {
    ['Cotizaciones', 'OT'].forEach(vaciar_);
    const c = Object.assign({}, b.config || {}, { matrizEjemplo: !!b.ejemplo });
    escribirConfig_(c);
    escribirMatriz_(b.matriz || []);
    (b.cotizaciones || []).forEach(x => guardarFila_('Cotizaciones', x.id, filaCot_(x)));
    (b.ots || []).forEach(x => guardarFila_('OT', x.id, filaOt_(x)));
    return {};
  },
};

/* ---------------- Planilla ---------------- */
function hoja_(nombre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(HOJAS[nombre]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HOJAS[nombre].length).setFontWeight('bold');
  }
  return sh;
}

function leerConfig_() {
  const sh = hoja_('Config'); const n = sh.getLastRow(); const c = {};
  if (n < 2) return c;
  sh.getRange(2, 1, n - 1, 2).getValues().forEach(r => {
    if (r[0] === '' || r[0] == null) return;
    try { c[r[0]] = JSON.parse(r[1]); } catch (_) { c[r[0]] = r[1]; }
  });
  return c;
}
function escribirConfig_(c) {
  const sh = hoja_('Config');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  const filas = Object.keys(c).map(k => [k, JSON.stringify(c[k])]);
  if (!filas.length) return;
  const rg = sh.getRange(2, 1, filas.length, 2);
  rg.setNumberFormat('@');
  rg.setValues(filas);
}

function leerMatriz_() {
  const sh = hoja_('Matriz'); const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 5).getDisplayValues()
    .filter(r => String(r[0]).trim())
    .map((r, i) => ({
      tipo: String(r[0]).trim(), material: String(r[1]).trim(), medida: String(r[2]).trim(),
      costo: Number(String(r[3]).replace(/[^\d]/g, '')) || 0,
      id: String(r[4] || '') || ('fila' + (i + 2)),
    }));
}
function escribirMatriz_(rows) {
  const sh = hoja_('Matriz');
  vaciar_('Matriz');
  if (!rows.length) return;
  const filas = rows.map(r => [r.tipo || '', r.material || '', r.medida || '', Number(r.costo) || 0, r.id || Utilities.getUuid()]);
  sh.getRange(2, 1, filas.length, 3).setNumberFormat('@');
  sh.getRange(2, 4, filas.length, 1).setNumberFormat('#,##0');
  sh.getRange(2, 1, filas.length, 5).setValues(filas);
}

function leerJson_(nombre) {
  const sh = hoja_(nombre); const n = sh.getLastRow();
  if (n < 2) return [];
  const col = HOJAS[nombre].length;
  return sh.getRange(2, col, n - 1, 1).getValues()
    .map(r => { try { return JSON.parse(r[0]); } catch (_) { return null; } })
    .filter(Boolean);
}
function filaDe_(nombre, id) {
  const sh = hoja_(nombre); const n = sh.getLastRow();
  if (n < 2) return -1;
  const col = HOJAS[nombre].indexOf('id') + 1;
  const ids = sh.getRange(2, col, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function guardarFila_(nombre, id, fila) {
  const sh = hoja_(nombre);
  let r = filaDe_(nombre, id);
  if (r < 0) r = sh.getLastRow() + 1;
  sh.getRange(r, fila.length).setNumberFormat('@');
  sh.getRange(r, 1, 1, fila.length).setValues([fila]);
}
function borrarFila_(nombre, id) {
  const r = filaDe_(nombre, id); if (r < 0) return;
  const sh = hoja_(nombre);
  // Sheets no permite borrar la única fila bajo el encabezado fijo: en ese caso se vacía.
  if (sh.getLastRow() <= 2) sh.getRange(r, 1, 1, HOJAS[nombre].length).clearContent();
  else sh.deleteRow(r);
}
function vaciar_(nombre) {
  const sh = hoja_(nombre); const n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, Math.max(sh.getLastColumn(), HOJAS[nombre].length)).clearContent();
}
function filaCot_(c) {
  const t = c.totales || {}, cl = c.cliente || {};
  return [c.numero, c.fecha || '', cl.nombre || '', cl.rut || '', t.neto || 0, t.bruto || 0,
    t.margenPct ? Math.round(t.margenPct * 1000) / 10 : 0, c.estado || '', c.otNumero || '', c.id, JSON.stringify(c)];
}
function filaOt_(o) {
  return [o.numero, o.fecha || '', (o.cliente || {}).nombre || '', o.cotNumero || '', o.estado || '', o.id, JSON.stringify(o)];
}
