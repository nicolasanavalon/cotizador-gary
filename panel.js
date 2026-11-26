/* Cotizador Gary — flujo completo (cotización → envío → aprobación → OT → factura → pago),
   módulo de Facturación y Panel de indicadores (KPI).
   Usa las funciones y datos globales de app.js (COTS, OTS, api, clp, pct, fechaCL…). */

const ESTADOS_COT = ['Borrador', 'Enviada', 'Aprobada', 'Rechazada'];
/* Campos que se registran desde las listas y que el editor no debe pisar al guardar. */
const CAMPOS_CICLO = ['fechaEnvio', 'fechaAprob', 'oc', 'fechaRechazo', 'motivoRechazo', 'factura', 'demo'];
const MOTIVOS_RECHAZO = ['Precio', 'Plazo de entrega', 'Compró a otro proveedor', 'Sin respuesta del cliente', 'Proyecto cancelado', 'Otro'];
const MEDIOS_PAGO = ['Transferencia', 'Cheque', 'Efectivo', 'Tarjeta', 'Orden de compra / Mercado Público'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* ---------------- Estados ---------------- */
function estadoCot(c) {
  let e = c.estado || 'Borrador';
  if (e === 'Pendiente') e = 'Enviada';                       // cotizaciones antiguas
  return e;
}
const venceCot = c => esNumero(c.validez) && +c.validez > 0 ? sumarDiasHabiles(c.fechaEnvio || c.fecha, +c.validez) : '';
function diasCredito(cond) { const m = String(cond || '').match(/(\d+)\s*d[ií]as/i); return m ? +m[1] : 0; }
function sumarDias(iso, n) { const d = new Date((iso || hoy()) + 'T12:00:00'); d.setDate(d.getDate() + (+n || 0)); return d.toISOString().slice(0, 10); }
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
function estadoFactura(c) {
  if (estadoCot(c) !== 'Aprobada') return { codigo: '', texto: '', clase: '' };
  const f = c.factura;
  if (!f || !f.numero) return { codigo: 'porFacturar', texto: 'Por facturar', clase: 'pf' };
  if (f.pagada) return { codigo: 'pagada', texto: `Factura ${f.numero} · pagada`, clase: 'ok' };
  if (f.vence && f.vence < hoy()) return { codigo: 'vencida', texto: `Factura ${f.numero} · vencida`, clase: 'bad' };
  return { codigo: 'emitida', texto: `Factura ${f.numero} · por cobrar`, clase: 'pend' };
}
const otDe = c => OTS.find(o => o.cotId === c.id);
function marcarFechaOt(o) {
  if (o.estado === 'Terminada' && !o.fechaTermino) o.fechaTermino = hoy();
  if (o.estado === 'Despachada' && !o.fechaDespacho) o.fechaDespacho = hoy();
  if (o.estado === 'Entregada' && !o.fechaEntregada) o.fechaEntregada = hoy();
}
function otAtrasada(o) {
  const e = otEntrega(o);
  return !!e && e < hoy() && !['Terminada', 'Despachada', 'Entregada'].includes(o.estado);   // terminada = lista, ya no está atrasada en producción
}

/* ---------------- Formulario corto (aprobar, rechazar, facturar, pagar) ---------------- */
function pedirDatos(titulo, sub, campos, textoOk = 'Guardar') {
  const dlg = $('#dlgForm');
  $('#formTitulo').textContent = titulo; $('#formSub').textContent = sub || ''; $('#formOk').textContent = textoOk;
  $('#formCampos').innerHTML = campos.map(c => {
    const id = 'fc_' + c.k;
    const ctl = c.type === 'file' ? `<input id="${id}" type="file" accept="application/pdf,image/*">`
      : c.type === 'select'
      ? `<select id="${id}">${c.opciones.map(o => opt(o, c.value)).join('')}</select>`
      : `<input id="${id}" type="${c.type === 'money' ? 'text' : c.type || 'text'}" ${c.type === 'money' ? 'data-money inputmode="numeric"' : ''}
          value="${esc(c.type === 'money' ? miles(c.value) : c.value ?? '')}" placeholder="${esc(c.placeholder || '')}" ${c.requerido ? 'required' : ''}>`;
    return `<label>${esc(c.label)}${ctl}${c.ayuda ? `<small class="nota">${esc(c.ayuda)}</small>` : ''}</label>`;
  }).join('');
  dlg.returnValue = '';
  dlg.showModal();
  setTimeout(() => $('#formCampos input, #formCampos select')?.focus(), 30);
  return new Promise(res => {
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return res(null);
      const out = {};
      for (const c of campos) { const el = $('#fc_' + c.k), v = el.value; out[c.k] = c.type === 'file' ? (el.files[0] || null) : c.type === 'money' || c.type === 'number' ? num(v) : v.trim(); }
      res(out);
    }, { once: true });
  });
}
async function guardarCotLista(c) {
  if (nubeActiva()) Object.assign(c, (await api('guardarCot', { cot: c })).cot);
  saveCots();
}
/* Pasos del flujo desde la lista de cotizaciones. */
async function pasoCot(a, id) {
  const c = COTS.find(x => x.id === id); if (!c) return;
  const antes = JSON.stringify(c);
  try {
    if (a === 'enviada') {
      const d = await pedirDatos(`Cotización N° ${numDoc(c)} enviada`, c.cliente.nombre, [
        { k: 'fecha', label: 'Fecha de envío', type: 'date', value: hoy(), requerido: true }], 'Marcar enviada');
      if (!d) return;
      c.estado = 'Enviada'; c.fechaEnvio = d.fecha || hoy();
      await guardarCotLista(c); toast(`Cotización ${numDoc(c)} marcada como enviada`);
    }
    if (a === 'aprobar') {
      const d = await pedirDatos(`Aprobar cotización N° ${numDoc(c)}`, `${c.cliente.nombre} · ${clp(c.totales?.neto)} neto. Se crea la orden de trabajo.`, [
        { k: 'oc', label: 'N° orden de compra del cliente (opcional)', value: c.oc || '', placeholder: 'Ej: 4500123456 o ID Mercado Público' },
        { k: 'fecha', label: 'Fecha de aprobación', type: 'date', value: hoy(), requerido: true }], 'Aprobar y crear OT');
      if (!d) return;
      c.oc = d.oc; c.fechaAprob = d.fecha || hoy();
      await accionCot('aprobar', id);
      return;
    }
    if (a === 'rechazar') {
      if (!confirm(`¿Marcar la cotización ${numDoc(c)} (${c.cliente.nombre}) como rechazada?`)) return;
      c.estado = 'Rechazada'; c.fechaRechazo = hoy();
      await guardarCotLista(c); toast(`Cotización ${numDoc(c)} rechazada`);
    }
  } catch (err) { Object.assign(c, JSON.parse(antes)); toast('No se pudo guardar: ' + err.message); }
  renderCotizaciones();
}

/* ---------------- Facturación ---------------- */
let FILTRO_FACT = '';
const ETQ_FACT = { porFacturar: 'Por facturar', cobrar: 'Por cobrar', vencida: 'Vencidas', pagada: 'Pagadas' };
const enFiltroFact = (cod, filtro) => !filtro || cod === filtro || (filtro === 'cobrar' && (cod === 'emitida' || cod === 'vencida'));
function renderFacturas() {
  const mes = hoy().slice(0, 7);
  const filas = COTS.filter(c => estadoCot(c) === 'Aprobada').map(c => ({ c, f: estadoFactura(c), ot: otDe(c) }))
    .sort((a, b) => String(b.c.fechaAprob || b.c.fecha).localeCompare(String(a.c.fechaAprob || a.c.fecha)));
  const suma = arr => arr.reduce((s, x) => s + (x.c.factura?.total ?? x.c.totales?.bruto ?? 0), 0);
  const de = cod => filas.filter(x => x.f.codigo === cod);
  const facturadoMes = filas.filter(x => x.c.factura?.fecha?.startsWith(mes));
  const cobradoMes = filas.filter(x => x.c.factura?.pagada && x.c.factura.fechaPago?.startsWith(mes));
  $('#factKpis').innerHTML = [
    kpi('Por facturar', clp(suma(de('porFacturar'))), `${de('porFacturar').length} venta(s) aprobada(s) sin factura`),
    kpi(`Facturado en ${MESES_LARGO[+mes.slice(5) - 1]}`, clp(suma(facturadoMes)), `${facturadoMes.length} factura(s)`),
    kpi('Por cobrar', clp(suma(de('emitida')) + suma(de('vencida'))), `${de('emitida').length + de('vencida').length} factura(s) emitida(s)`),
    kpi('Vencido', clp(suma(de('vencida'))), `${de('vencida').length} factura(s) fuera de plazo`, de('vencida').length ? 'bad' : ''),
    kpi(`Cobrado en ${MESES_LARGO[+mes.slice(5) - 1]}`, clp(suma(cobradoMes)), `${cobradoMes.length} pago(s)`, 'ok'),
  ].join('');
  $('#filtrosFact').innerHTML = [['', 'Todas', filas.length], ...Object.entries(ETQ_FACT).map(([k, l]) => [k, l, filas.filter(x => enFiltroFact(x.f.codigo, k)).length])]
    .map(([v, l, n]) => `<button type="button" class="chip ${FILTRO_FACT === v ? 'active' : ''}" data-ff="${v}">${l} <small>${n}</small></button>`).join('');
  const vis = filas.filter(x => enFiltroFact(x.f.codigo, FILTRO_FACT));
  if (!vis.length) { $('#tablaFact').innerHTML = `<tr><td class="empty">${filas.length ? 'Nada en este filtro.' : 'Aún no hay ventas aprobadas. Al aprobar una cotización aparece aquí para facturarla.'}</td></tr>`; return; }
  $('#tablaFact').innerHTML = `<thead><tr><th>Cotización</th><th>OT</th><th>Cliente</th><th>Condición de pago</th><th class="num">Total</th><th>Factura</th><th>Emisión</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>` +
    vis.map(({ c, f, ot }) => {
      const fa = c.factura || {};
      const acc = f.codigo === 'porFacturar' ? '<button class="btn sm primary" data-fa="facturar">Emitir factura</button>'
        : f.codigo === 'pagada' ? `<small class="muted" title="${esc(fa.medioPago || '')}">pagada ${fechaCL(fa.fechaPago)}</small> ${fa.comprobante ? linkAdj(fa.comprobante, 'comprobante', 'comprobante') : '<a href="#" class="adj add" data-adjuntar="comprobante">+ comprobante</a>'}`
        : '<button class="btn sm ok" data-fa="pagar">Registrar pago</button>';
      const estado = { porFacturar: ['Por facturar', 'PorFacturar'], emitida: ['Por cobrar', 'PorCobrar'], vencida: [`Vencida (${diasEntre(fa.vence, hoy())} días)`, 'Vencida'], pagada: ['Pagada', 'Pagada'] }[f.codigo];
      return `<tr data-id="${c.id}"><td><b>${esc(numDoc(c))}</b>${c.demo ? ' <span class="badge Ejemplo">ejemplo</span>' : ''}${c.oc ? `<br><small class="muted">${/^oc\b/i.test(c.oc) ? '' : 'OC '}${esc(c.oc)}</small>` : ''}</td>
        <td>${ot ? `${esc(ot.numero)}<br><small class="muted">${esc(ot.estado)}</small>` : '—'}</td>
        <td>${esc(c.cliente.nombre)}</td><td><small>${esc(c.condPago || '—')}</small></td>
        <td class="num">${clp(fa.total ?? c.totales?.bruto)}</td>
        <td>${fa.numero ? `<b>N° ${esc(fa.numero)}</b><br>${fa.archivo ? linkAdj(fa.archivo, 'archivo', 'ver factura') : '<a href="#" class="adj add" data-adjuntar="archivo">+ adjuntar</a>'}` : '—'}</td><td>${fechaCL(fa.fecha) || '—'}</td><td>${fechaCL(fa.vence) || '—'}</td>
        <td><span class="badge ${estado[1]}">${estado[0]}</span></td><td class="acc">${acc}</td></tr>`;
    }).join('') + '</tbody>';
}
$('#filtrosFact').addEventListener('click', e => { const b = e.target.closest('[data-ff]'); if (!b) return; FILTRO_FACT = b.dataset.ff; renderFacturas(); });
$('#tablaFact').addEventListener('click', async e => {
  const a = e.target.dataset.fa; if (!a) return;
  const c = COTS.find(x => x.id === e.target.closest('tr').dataset.id); if (!c) return;
  const antes = JSON.stringify(c.factura || null);
  try {
    if (a === 'facturar') {
      const t = c.totales || {}, dias = diasCredito(c.condPago);
      const d = await pedirDatos(`Emitir factura · cotización N° ${numDoc(c)}`, `${c.cliente.nombre} · neto ${clp(t.neto)} + IVA = ${clp(t.bruto)}`, [
        { k: 'numero', label: 'N° de factura', placeholder: 'Ej: 1523', requerido: true },
        { k: 'fecha', label: 'Fecha de emisión', type: 'date', value: hoy(), requerido: true },
        { k: 'dias', label: 'Días de crédito', type: 'number', value: dias, ayuda: `Según la condición de pago: ${c.condPago || 'sin condición'}` },
        { k: 'neto', label: 'Monto neto', type: 'money', value: t.neto, ayuda: 'Cámbialo si se factura una parte (ej. anticipo del 50%)' },
        { k: 'archivo', label: 'Adjuntar la factura (PDF o foto, opcional)', type: 'file' }], 'Emitir factura');
      if (!d) return;
      const neto = Math.round(d.neto || t.neto || 0), iva = Math.round(neto * IVA);
      const archivo = await subirAdjunto(d.archivo, 'fac');
      c.factura = { numero: d.numero, fecha: d.fecha, vence: sumarDias(d.fecha, d.dias), neto, iva, total: neto + iva, pagada: false, archivo };
    }
    if (a === 'pagar') {
      const fa = c.factura;
      const d = await pedirDatos(`Registrar pago · factura N° ${fa.numero}`, `${c.cliente.nombre} · total ${clp(fa.total)}`, [
        { k: 'fecha', label: 'Fecha de pago', type: 'date', value: hoy(), requerido: true },
        { k: 'medio', label: 'Medio de pago', type: 'select', opciones: MEDIOS_PAGO, value: 'Transferencia' },
        { k: 'monto', label: 'Monto recibido', type: 'money', value: fa.total },
        { k: 'archivo', label: 'Adjuntar comprobante de pago (opcional)', type: 'file' }], 'Registrar pago');
      if (!d) return;
      if (d.archivo) fa.comprobante = await subirAdjunto(d.archivo, 'pag');
      Object.assign(fa, { pagada: true, fechaPago: d.fecha, medioPago: d.medio, montoPagado: d.monto || fa.total });
    }
    await guardarCotLista(c);
    toast(a === 'facturar' ? `Factura N° ${c.factura.numero} registrada` : 'Pago registrado');
  } catch (err) { c.factura = JSON.parse(antes); toast('No se pudo guardar: ' + err.message); }
  renderFacturas();
});

/* ---------------- Panel de indicadores ---------------- */
let PERIODO = 'anio';
const PERIODOS = [['mes', 'Este mes'], ['3m', 'Últimos 3 meses'], ['anio', 'Este año'], ['todo', 'Todo']];
function desdePeriodo(p) {
  const h = hoy(), y = +h.slice(0, 4), m = +h.slice(5, 7);
  if (p === 'mes') return h.slice(0, 7) + '-01';
  if (p === '3m') { const d = new Date(y, m - 3, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
  if (p === 'anio') return `${y}-01-01`;
  return '';
}
const corto = n => { n = Math.round(n || 0); const a = Math.abs(n);
  return a >= 1e6 ? '$ ' + (n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' M' : a >= 1e4 ? '$ ' + Math.round(n / 1e3).toLocaleString('es-CL') + ' mil' : clp(n); };
const kpi = (titulo, valor, sub, tono = '') => `<div class="kpi ${tono}"><small>${esc(titulo)}</small><b>${valor}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
const tip = (...lineas) => esc(lineas.filter(Boolean).join('\n'));

function datosPanel() {
  const desde = desdePeriodo(PERIODO);
  const cots = COTS.filter(c => !desde || String(c.fecha) >= desde).map(c => ({ c, e: estadoCot(c), t: c.totales || {} }));
  const de = e => cots.filter(x => x.e === e);
  const aprob = de('Aprobada'), rech = de('Rechazada'), env = de('Enviada');
  const suma = (arr, k = 'neto') => arr.reduce((s, x) => s + (+x.t[k] || 0), 0);
  return { desde, cots, aprob, rech, env, suma };
}
function renderPanel() {
  $('#panelPeriodo').innerHTML = PERIODOS.map(([k, l]) => `<button type="button" class="chip ${PERIODO === k ? 'active' : ''}" data-per="${k}">${l}</button>`).join('');
  const { desde, cots, aprob, rech, env: envP, suma } = datosPanel();
  if (!COTS.length) { $('#panelCuerpo').innerHTML = '<div class="card empty">Todavía no hay cotizaciones. Los indicadores aparecen a medida que se cotiza.</div>'; return; }
  const etqPer = (PERIODOS.find(p => p[0] === PERIODO) || [])[1] || '';
  const conDesde = extra => desde ? { ...extra, desde, etiqueta: [extra.etiqueta, etqPer.toLowerCase()].filter(Boolean).join(' · ') } : extra;
  const acc = o => `data-accion="${esc(JSON.stringify(o))}" tabindex="0"`;
  const enviadasP = [...aprob, ...rech, ...envP], decididas = enviadasP.length;   // tasa sobre lo enviado al cliente
  const tasa = decididas ? aprob.length / decididas : null;
  const tasaMonto = suma(enviadasP) ? suma(aprob) / suma(enviadasP) : null;
  const venta = suma(aprob), margen = suma(aprob, 'margen');
  const todas = COTS.filter(c => estadoCot(c) === 'Aprobada').map(c => ({ c, f: estadoFactura(c) }));
  const totF = arr => arr.reduce((s, x) => s + (x.c.factura?.total ?? x.c.totales?.bruto ?? 0), 0);
  const porCobrar = todas.filter(x => ['emitida', 'vencida'].includes(x.f.codigo)), vencido = todas.filter(x => x.f.codigo === 'vencida');
  const porFacturar = todas.filter(x => x.f.codigo === 'porFacturar');
  const verCot = (estado, etiqueta) => acc({ ir: 'cot', estado, extra: desde ? { tipo: 'desde', valor: desde, etiqueta: etqPer.toLowerCase() } : null });

  const kpis = [
    `<div class="kpi clic" ${verCot('', 'todas')}><small>Cotizado (neto)</small><b>${corto(suma(cots))}</b><span>${cots.length} cotizacion${cots.length === 1 ? '' : 'es'}</span></div>`,
    `<div class="kpi ok clic" ${verCot('Aprobada')}><small>Vendido (neto)</small><b>${corto(venta)}</b><span>${aprob.length} aprobada${aprob.length === 1 ? '' : 's'}</span></div>`,
    kpi('Tasa de aprobación', tasa == null ? '—' : pct(tasa), tasaMonto == null ? 'sin cotizaciones enviadas' : `${aprob.length} de ${decididas} enviadas · ${pct(tasaMonto)} del monto`),
    kpi('Margen de lo vendido', venta ? pct(margen / venta) : '—', venta ? `${corto(margen)} de margen` : ''),
    kpi('Venta promedio', aprob.length ? corto(venta / aprob.length) : '—', 'por cotización aprobada'),
    `<div class="kpi clic ${vencido.length ? 'bad' : ''}" ${acc({ ir: 'fact', filtro: 'cobrar' })}><small>Por cobrar</small><b>${corto(totF(porCobrar))}</b>
      <span>${vencido.length ? `<b>${corto(totF(vencido))} vencido</b> · ${vencido.length} factura${vencido.length === 1 ? '' : 's'}` : `${porCobrar.length} factura${porCobrar.length === 1 ? '' : 's'} al día`}${porFacturar.length ? ` · ${corto(totF(porFacturar))} por facturar` : ''}</span></div>`,
  ].join('');

  // por mes (últimos 6 meses, por fecha de la cotización)
  const h = hoy(), y = +h.slice(0, 4), m = +h.slice(5, 7);
  const meses = Array.from({ length: 6 }, (_, k) => { const d = new Date(y, m - 6 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const porMes = meses.map(mm => {
    const del = COTS.filter(c => String(c.fecha).startsWith(mm));
    const ap = del.filter(c => estadoCot(c) === 'Aprobada');
    return { mm, cot: del.reduce((s, c) => s + (+c.totales?.neto || 0), 0), apr: ap.reduce((s, c) => s + (+c.totales?.neto || 0), 0), n: del.length, na: ap.length };
  });

  const barras = filas => { const max = Math.max(1, ...filas.map(f => f.v));
    return filas.map(f => `<div class="hb ${f.accion ? 'clic' : ''}" data-tip="${f.tip}" ${f.accion ? acc(f.accion) : 'tabindex="0"'}><span class="hb-l">${esc(f.l)}</span>
      <span class="hb-t"><i style="width:${Math.max(2, f.v / max * 100)}%"></i></span><span class="hb-v">${f.txt}</span></div>`).join(''); };
  const agrupar = (arr, clave) => { const o = {}; for (const x of arr) { const k = clave(x); o[k] = o[k] || { v: 0, n: 0, mg: 0 }; o[k].v += +x.t.neto || 0; o[k].mg += +x.t.margen || 0; o[k].n++; } return Object.entries(o).sort((a, b) => b[1].v - a[1].v); };

  // estado de las cotizaciones del período
  const porEstado = ESTADOS_COT.map(e => { const arr = cots.filter(x => x.e === e); return { e, n: arr.length, v: suma(arr) }; }).filter(x => x.n);
  // clientes, tipos de producto y regiones (lo vendido en el período)
  const topCli = agrupar(aprob, x => x.c.cliente.nombre || '—').slice(0, 7);
  const porTipo = {};
  for (const x of aprob) for (const it of x.c.items || []) {
    const k = tipoProducto(it), k2 = calcItem(it);
    porTipo[k] = porTipo[k] || { v: 0, c: 0, u: 0 }; porTipo[k].v += k2.venta; porTipo[k].c += k2.costo; porTipo[k].u += k2.cant;
  }
  const topTipo = Object.entries(porTipo).sort((a, b) => b[1].v - a[1].v).slice(0, 7);
  const porRegion = agrupar(aprob, x => x.c.cliente.region || 'Sin región').slice(0, 7);

  // requiere atención
  const alertas = [];
  const env = cots.filter(x => x.e === 'Enviada');
  for (const o of OTS.filter(otAtrasada)) alertas.push(['bad', `OT ${o.numero} atrasada`, `${o.cliente?.nombre || ''} · entrega ${fechaCL(otEntrega(o))} · ${o.estado}`, { ir: 'ots' }]);
  for (const x of vencido) alertas.push(['bad', `Factura N° ${x.c.factura.numero} vencida`, `${x.c.cliente.nombre} · ${clp(x.c.factura.total)} · venció ${fechaCL(x.c.factura.vence)}`, { ir: 'fact', filtro: 'vencida' }]);
  for (const x of porFacturar.filter(x => ['Despachada', 'Entregada', 'Terminada'].includes(otDe(x.c)?.estado))) alertas.push(['info', `Cotización ${numDoc(x.c)} lista para facturar`, `${x.c.cliente.nombre} · OT ${otDe(x.c).estado.toLowerCase()} · ${clp(x.c.totales?.bruto)}`, { ir: 'fact', filtro: 'porFacturar' }]);
  for (const o of OTS.filter(o => !['Terminada', 'Despachada', 'Entregada'].includes(o.estado) && otEntrega(o) >= hoy() && otEntrega(o) <= sumarDias(hoy(), 7)))
    alertas.push(['info', `OT ${o.numero} se entrega ${fechaCL(otEntrega(o))}`, `${o.cliente?.nombre || ''} · ${o.estado}`, { ir: 'ots' }]);

  const vacio = '<p class="empty">Sin ventas en el período.</p>';
  $('#panelCuerpo').innerHTML = `
    <div class="kpis seis">${kpis}</div>
    <div class="viz-grid">
      <div class="card viz"><h3>Cotizado y aprobado por mes</h3><p class="hint">Neto, según la fecha de la cotización · <b>pincha una barra</b> para ver esas cotizaciones</p>
        <div class="leyenda"><span><i class="sw a"></i>Cotizado</span><span><i class="sw b"></i>Aprobado</span></div>
        ${graficoMeses(porMes, acc)}
        <details class="tabla-datos"><summary>Ver datos</summary><table class="list"><thead><tr><th>Mes</th><th class="num">Cotizado</th><th class="num">Aprobado</th><th class="num">N°</th></tr></thead>
          <tbody>${porMes.map(x => `<tr><td>${MESES_LARGO[+x.mm.slice(5) - 1]} ${x.mm.slice(0, 4)}</td><td class="num">${clp(x.cot)}</td><td class="num">${clp(x.apr)}</td><td class="num">${x.na} de ${x.n}</td></tr>`).join('')}</tbody></table></details></div>
      <div class="card viz"><h3>Estado de las cotizaciones</h3><p class="hint">Del período · cantidad y monto neto</p>
        <div class="hbars">${barras(porEstado.map(x => ({ l: x.e, v: x.v, txt: `<b>${x.n}</b> <small>${corto(x.v)}</small>`, tip: tip(x.e, `${x.n} cotizaciones · ${clp(x.v)} neto`, 'Clic para verlas'),
          accion: { ir: 'cot', estado: x.e, extra: desde ? { tipo: 'desde', valor: desde, etiqueta: etqPer.toLowerCase() } : null } })))}</div>
</div>
      <div class="card viz"><h3>Mejores clientes</h3><p class="hint">Venta neta aprobada en el período · clic para ver sus cotizaciones</p>
        <div class="hbars">${topCli.length ? barras(topCli.map(([l, x]) => ({ l, v: x.v, txt: corto(x.v), tip: tip(l, `${clp(x.v)} neto · ${x.n} venta${x.n === 1 ? '' : 's'}`),
          accion: { ir: 'cot', estado: '', extra: { tipo: 'cliente', valor: l, etiqueta: l } } }))) : vacio}</div></div>
      <div class="card viz"><h3>Ventas por tipo de producto</h3><p class="hint">Según el tipo elegido en cada producto · venta neta y margen</p>
        <div class="hbars">${topTipo.length ? barras(topTipo.map(([l, x]) => ({ l, v: x.v, txt: `${corto(x.v)} <small>${pct(x.v ? (x.v - x.c) / x.v : 0)} mg</small>`,
          tip: tip(l, `${clp(x.v)} neto · ${x.u} u.`, `Margen ${pct(x.v ? (x.v - x.c) / x.v : 0)} (${clp(x.v - x.c)})`),
          accion: { ir: 'cot', estado: 'Aprobada', extra: conDesde({ tipo: 'producto', valor: l, etiqueta: l }) } }))) : vacio}</div></div>
      <div class="card"><h3>Requiere atención <small class="muted">${alertas.length}</small></h3>
        ${alertas.length ? `<ul class="alertas">${alertas.slice(0, 10).map(([t, a, b, o]) => `<li class="${t}" ${acc(o)}><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul>` : '<p class="empty">Todo al día. 👌</p>'}</div>
      <div class="card viz"><h3>Ventas por región</h3><p class="hint">Venta neta aprobada en el período, según la región del cliente</p>
        <div class="hbars">${porRegion.length ? barras(porRegion.map(([l, x]) => ({ l, v: x.v, txt: corto(x.v), tip: tip(l, `${clp(x.v)} neto · ${x.n} venta${x.n === 1 ? '' : 's'}`),
          accion: { ir: 'cot', estado: 'Aprobada', extra: conDesde({ tipo: 'region', valor: l, etiqueta: 'Región ' + l }) } }))) : vacio}</div></div>
    </div>`;
}
/* Tipo de producto según lo elegido en las listas (no según el nombre escrito). */
function tipoProducto(it) {
  normalizarItem(it);
  if (esBandera(it)) return it.tipo || 'Bandera (sin tipo)';
  return it.producto === 'Otro' ? 'Otros productos' : it.producto || 'Otros productos';
}
/* Filtros que llegan desde el panel a la lista de cotizaciones. */
function coincideExtra(c, x) {
  if (!x) return true;
  if (x.desde && String(c.fecha) < x.desde) return false;
  if (x.tipo === 'mes') return String(c.fecha).startsWith(x.valor);
  if (x.tipo === 'cliente') return (c.cliente.nombre || '—') === x.valor;
  if (x.tipo === 'region') return (c.cliente.region || 'Sin región') === x.valor;
  if (x.tipo === 'producto') return (c.items || []).some(it => tipoProducto({ ...it }) === x.valor);
  return true;
}
function ejecutarAccion(o) {
  if (o.ir === 'cot') { FILTRO_COT = o.estado || ''; FILTRO_EXTRA = o.extra || null; $('#buscaCot').value = ''; mostrar('cotizaciones'); }
  else if (o.ir === 'fact') { FILTRO_FACT = o.filtro || ''; mostrar('facturas'); }
  else if (o.ir) mostrar(o.ir);
}
/* Barras agrupadas por mes (SVG). Cada barra se puede pinchar: lleva a las cotizaciones de ese mes. */
function graficoMeses(datos, acc) {
  const W = 640, H = 230, L = 58, R = 8, T = 12, B = 28, n = datos.length;
  const max = Math.max(1, ...datos.map(d => Math.max(d.cot, d.apr)));
  const paso = Math.pow(10, Math.floor(Math.log10(max))), tope = Math.ceil(max / paso / 2) * paso * 2 || paso;
  const yv = v => T + (H - T - B) * (1 - v / tope), gw = (W - L - R) / n, bw = Math.min(28, (gw - 18) / 2);
  const barra = (x, v) => { const y = yv(v), h = H - B - y; if (h <= 0.5) return ''; const r = Math.min(4, h, bw / 2);
    return `M${x},${H - B}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${H - B}Z`; };
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = tope * k / 4, y = yv(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 8}" y="${y + 4}" class="ax" text-anchor="end">${corto(v).replace('$ ', '$')}</text>`; }
  datos.forEach((d, i) => {
    const x0 = L + gw * i + (gw - (bw * 2 + 2)) / 2, nombre = `${MESES_LARGO[+d.mm.slice(5) - 1]} ${d.mm.slice(0, 4)}`;
    const t = tip(nombre, `Cotizado: ${clp(d.cot)} (${d.n})`, `Aprobado: ${clp(d.apr)} (${d.na})`, 'Clic para ver esas cotizaciones');
    g += `<path d="${barra(x0, d.cot)}" class="s-a"/><path d="${barra(x0 + bw + 2, d.apr)}" class="s-b"/>`;
    g += `<text x="${L + gw * i + gw / 2}" y="${H - 8}" class="ax" text-anchor="middle">${MESES[+d.mm.slice(5) - 1]}</text>`;
    const ex = { tipo: 'mes', valor: d.mm, etiqueta: nombre };
    g += `<rect x="${L + gw * i}" y="${T}" width="${gw / 2}" height="${H - T - B}" class="hit" data-tip="${t}" ${acc({ ir: 'cot', estado: '', extra: ex })}/>`;
    g += `<rect x="${L + gw * i + gw / 2}" y="${T}" width="${gw / 2}" height="${H - T - B}" class="hit" data-tip="${t}" ${acc({ ir: 'cot', estado: 'Aprobada', extra: ex })}/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img" aria-label="Cotizado y aprobado por mes">${g}</svg>`;
}
$('#panelPeriodo').addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (!b) return; PERIODO = b.dataset.per; renderPanel(); });
const accionPanel = e => { const el = e.target.closest('[data-accion]'); if (!el) return; e.preventDefault(); document.getElementById('vizTip').style.display = 'none'; ejecutarAccion(JSON.parse(el.dataset.accion)); };
$('#panelCuerpo').addEventListener('click', accionPanel);
$('#panelCuerpo').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') accionPanel(e); });


/* Tooltip único para los gráficos (texto plano). */
(() => {
  const t = document.createElement('div'); t.id = 'vizTip'; t.setAttribute('role', 'tooltip'); document.body.appendChild(t);
  const mostrarTip = (el, x, y) => {
    t.textContent = '';
    el.dataset.tip.split('\n').forEach((l, i) => { const s = document.createElement(i ? 'span' : 'b'); s.textContent = l; t.appendChild(s); });
    t.style.display = 'flex';
    const w = t.offsetWidth, hgt = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    t.style.top = Math.max(8, y - hgt - 12) + 'px';
  };
  document.addEventListener('pointermove', e => { const el = e.target.closest?.('[data-tip]'); if (el && el.closest('#view-panel')) mostrarTip(el, e.clientX, e.clientY); else t.style.display = 'none'; });
  document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-tip]'); if (el && el.closest('#view-panel')) { const r = el.getBoundingClientRect(); mostrarTip(el, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', () => { t.style.display = 'none'; });
})();

/* ---------------- Datos de ejemplo: borrar ---------------- */
(() => {
  const vista = $('#view-config'); if (!vista) return;
  const card = document.createElement('div'); card.className = 'card'; card.id = 'cardEjemplos';
  card.innerHTML = `<h2>Datos de ejemplo</h2><p class="hint">Las cotizaciones y OT marcadas como <span class="badge Ejemplo">ejemplo</span> (N° E1, E2…) son inventadas para mostrar cómo
    funciona el sistema completo. No usan la numeración real. Bórralas cuando empiecen a trabajar en serio.</p>
    <button class="btn ghost danger" id="btnBorrarEjemplos">Borrar datos de ejemplo</button> <span class="hint" id="infoEjemplos"></span>`;
  vista.appendChild(card);
  const info = () => { const n = COTS.filter(c => c.demo).length, m = OTS.filter(o => o.demo).length; $('#infoEjemplos').textContent = n || m ? `${n} cotizaciones y ${m} OT de ejemplo` : 'No hay datos de ejemplo.'; };
  $$('.topbar [data-view="config"]').forEach(b => b.addEventListener('click', info));
  $('#btnBorrarEjemplos').onclick = conBoton($('#btnBorrarEjemplos'), async () => {
    const cs = COTS.filter(c => c.demo), os = OTS.filter(o => o.demo);
    if (!cs.length && !os.length) { toast('No hay datos de ejemplo'); return; }
    if (!confirm(`¿Borrar ${cs.length} cotizaciones y ${os.length} OT de ejemplo? Las reales no se tocan.`)) return;
    try {
      for (const o of os) { if (nubeActiva()) await api('borrarOt', { id: o.id }); OTS = OTS.filter(x => x !== o); }
      for (const c of cs) { if (nubeActiva()) await api('borrarCot', { id: c.id }); COTS = COTS.filter(x => x !== c); }
      saveCots(); saveOts(); toast('Datos de ejemplo borrados');
    } catch (e) { toast('No se pudo terminar: ' + e.message); }
    info();
  });
})();

/* ---------------- Adjuntos de facturación (factura y comprobante de pago) ---------------- */
const MAX_ADJUNTO = 4 * 1024 * 1024;
function leerComoDataUrl(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('no se pudo leer el archivo')); r.readAsDataURL(file); });
}
async function subirAdjunto(file, prefijo) {
  if (!file) return null;
  if (file.size > MAX_ADJUNTO) throw new Error('el archivo pesa más de 4 MB');
  const data = await leerComoDataUrl(file), id = prefijo + uid();
  if (nubeActiva()) await api('guardarImagen', { id, data });
  IMGS.set(id, data);
  return { id, nombre: file.name || 'archivo', tipo: file.type || '' };
}
async function verAdjunto(adj) {
  const w = window.open('', '_blank');   // se abre antes de esperar, para que el navegador no lo bloquee
  try {
    let data = IMGS.get(adj.id);
    if (!data && nubeActiva()) { data = (await api('leerImagenes', { ids: [adj.id] })).imagenes?.[adj.id]; if (data) IMGS.set(adj.id, data); }
    if (!data) throw new Error('no se encontró el archivo');
    const blob = await (await fetch(data)).blob(), url = URL.createObjectURL(blob);
    if (w) w.location = url; else window.location.href = url;
  } catch (e) { if (w) w.close(); toast('No se pudo abrir el archivo: ' + e.message); }
}
const linkAdj = (adj, k, texto) => adj ? `<a href="#" class="adj" data-adj="${k}" title="${esc(adj.nombre)}">📎 ${texto}</a>` : '';
$('#tablaFact').addEventListener('click', async e => {
  const a = e.target.closest('[data-adj], [data-adjuntar]'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  const c = COTS.find(x => x.id === a.closest('tr').dataset.id); if (!c?.factura) return;
  if (a.dataset.adj) { verAdjunto(c.factura[a.dataset.adj]); return; }
  const k = a.dataset.adjuntar, esFact = k === 'archivo';
  const d = await pedirDatos(esFact ? `Adjuntar factura N° ${c.factura.numero}` : 'Adjuntar comprobante de pago', c.cliente.nombre,
    [{ k: 'f', label: esFact ? 'Archivo de la factura (PDF o foto)' : 'Comprobante (PDF o foto)', type: 'file' }], 'Adjuntar');
  if (!d?.f) return;
  const antes = JSON.stringify(c.factura);
  try { c.factura[k] = await subirAdjunto(d.f, esFact ? 'fac' : 'pag'); await guardarCotLista(c); toast('Archivo adjuntado'); }
  catch (err) { c.factura = JSON.parse(antes); toast('No se pudo adjuntar: ' + err.message); }
  renderFacturas();
}, true);

/* ---------------- Producción (solo lectura, desde el panel de producción del taller) ---------------- */
const PANEL_PROD_URL = 'https://script.google.com/macros/s/AKfycbwAACl5LecQlRplOQqxINxjcPsoppWspspEyBN3xmsr2o7lrzMFhc6-1m-qydVLUrgP/exec';
const PANEL_PROD_WEB = 'https://nicolasanavalon.github.io/taller-gary/';
let PROD = null, PROD_CARGA = null, PROD_ERROR = '', FILTRO_PROD = 'curso';
const textoOk = s => { s = String(s ?? '').trim(); if (/Ã|Â/.test(s)) { try { return decodeURIComponent(escape(s)); } catch (_) {} } return s; };
const siNo = v => v === true || v === 'true' || v === 'True';
function cargarProduccion(forzar) {
  if (PROD && !forzar) return Promise.resolve(PROD);
  if (PROD_CARGA) return PROD_CARGA;
  PROD_ERROR = '';
  PROD_CARGA = fetch(PANEL_PROD_URL).then(r => { if (!r.ok) throw new Error('el panel respondió ' + r.status); return r.json(); }).then(d => {
    const filas = (d.rows || []).map(r => ({
      ot: String(r.ot || '').trim(), cliente: textoOk(r.cliente), comuna: textoOk(r.comuna), producto: textoOk(r.producto),
      cant: +r.cant || 0, medida: textoOk(r.medida), tela: textoOk(r.tela), etapa: textoOk(r.etapa), obs: textoOk(r.obs),
      fCom: String(r.fCom || '').slice(0, 10), entregada: siNo(r.entregada), sublimada: siNo(r.sublimacion), aplicada: siNo(r.aplicada),
      foto: typeof r.foto === 'string' && r.foto.startsWith('data:image') ? r.foto : '' }));
    const enSublimacion = Array.isArray(d.sublimacion?.sublimado) ? d.sublimacion.sublimado.length : 0;
    PROD = { filas, enSublimacion, hora: new Date() };
    return PROD;
  }).catch(e => { PROD_ERROR = e.message; throw e; }).finally(() => { PROD_CARGA = null; });
  return PROD_CARGA;
}
function otsProduccion() {
  const m = new Map();
  for (const f of PROD.filas) {
    const k = f.ot || '—';
    if (!m.has(k)) m.set(k, { ot: k, cliente: f.cliente, comuna: f.comuna, fCom: f.fCom, items: [] });
    const o = m.get(k); o.items.push(f); if (f.fCom && (!o.fCom || f.fCom < o.fCom)) o.fCom = f.fCom;
  }
  return [...m.values()].map(o => {
    o.entregada = o.items.every(i => i.entregada);
    o.unidades = o.items.filter(i => !i.entregada).reduce((s, i) => s + i.cant, 0);
    o.atrasada = !o.entregada && o.fCom && o.fCom < hoy();
    o.semana = !o.entregada && !o.atrasada && o.fCom && o.fCom <= sumarDias(hoy(), 7);
    return o;
  });
}
const ETQ_PROD = [['curso', 'En curso'], ['atrasadas', 'Atrasadas'], ['semana', 'Próximos 7 días'], ['entregadas', 'Entregadas'], ['todas', 'Todas']];
const enFiltroProd = (o, f) => f === 'todas' || (f === 'curso' && !o.entregada) || (f === 'atrasadas' && o.atrasada) || (f === 'semana' && o.semana) || (f === 'entregadas' && o.entregada);
function renderProduccion() {
  if (!PROD) {
    $('#prodKpis').innerHTML = ''; $('#filtrosProd').innerHTML = '';
    $('#prodCuerpo').innerHTML = PROD_ERROR
      ? `<div class="card empty">No se pudo leer el panel de producción (${esc(PROD_ERROR)}). <a href="${PANEL_PROD_WEB}" target="_blank" rel="noopener">Abrir el panel de producción ↗</a> · <a href="#" data-prod-recargar>Reintentar</a></div>`
      : '<div class="card empty">Cargando el panel de producción…</div>';
    if (!PROD_ERROR) cargarProduccion().then(renderProduccion, renderProduccion);
    return;
  }
  const ots = otsProduccion(), curso = ots.filter(o => !o.entregada);
  const unidades = curso.reduce((s, o) => s + o.unidades, 0);
  const atr = curso.filter(o => o.atrasada), sem = curso.filter(o => o.semana);
  const clicK = (f, html) => `<div class="kpi clic ${FILTRO_PROD === f ? 'sel' : ''}" data-fprod="${f}" tabindex="0">${html}</div>`;
  $('#prodKpis').innerHTML = [
    clicK('curso', `<small>OT en curso</small><b>${curso.length}</b><span>${unidades} producto${unidades === 1 ? '' : 's'} por entregar</span>`),
    clicK('atrasadas', `<small>Atrasadas</small><b class="${atr.length ? 'neg' : ''}">${atr.length}</b><span>pasó la fecha comprometida</span>`),
    clicK('semana', `<small>Se entregan en 7 días</small><b>${sem.length}</b><span>OT comprometidas esta semana</span>`),
    clicK('entregadas', `<small>Entregadas</small><b>${ots.length - curso.length}</b><span>OT completas en el panel</span>`),
    kpi('En sublimación', String(PROD.enSublimacion), 'en la cola de sublimado'),
  ].join('');
  $('#filtrosProd').innerHTML = ETQ_PROD.map(([k, l]) => `<button type="button" class="chip ${FILTRO_PROD === k ? 'active' : ''}" data-fprod="${k}">${l} <small>${ots.filter(o => enFiltroProd(o, k)).length}</small></button>`).join('') +
    `<span class="prod-act">Actualizado ${PROD.hora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · <a href="#" data-prod-recargar>actualizar</a> · <a href="${PANEL_PROD_WEB}" target="_blank" rel="noopener">abrir panel de producción ↗</a></span>`;
  const q = normTxt($('#buscaProd').value || '');
  const vis = ots.filter(o => enFiltroProd(o, FILTRO_PROD) && (!q || normTxt([o.ot, o.cliente, o.comuna, ...o.items.map(i => i.producto)].join(' ')).includes(q)))
    .sort((a, b) => FILTRO_PROD === 'entregadas' || FILTRO_PROD === 'todas' ? (+b.ot || 0) - (+a.ot || 0) : String(a.fCom || '9999').localeCompare(String(b.fCom || '9999')));
  $('#prodCuerpo').innerHTML = vis.length ? `<div class="prod-ots">${vis.slice(0, 120).map(o => `
    <div class="card prod-ot ${o.atrasada ? 'atr' : ''}">
      <div class="po-head"><b>OT ${esc(o.ot)}</b><span>${esc(o.cliente)}${o.comuna ? ' · ' + esc(o.comuna) : ''}</span>
        <span class="po-fecha">${o.entregada ? '<span class="badge Entregada">Entregada</span>' : `${o.atrasada ? '<span class="badge Vencida">Atrasada</span>' : ''} compromiso <b>${fechaCL(o.fCom) || '—'}</b>`}</span></div>
      ${o.items.map(i => `<div class="po-item ${i.entregada ? 'ok' : ''}">
        ${i.foto ? `<img src="${i.foto}" alt="" loading="lazy">` : `<span class="po-sinfoto">${ICONO_BANDERA}</span>`}
        <div class="po-txt"><b>${esc(i.producto || 'Producto')}</b>
          <span>${i.cant} u.${i.medida ? ' · ' + esc(i.medida) : ''}${i.tela ? ' · ' + esc(i.tela) : ''}${i.sublimada ? ' · sublimada' : ''}${i.aplicada ? ' · aplicada' : ''}</span>
          ${i.obs ? `<small>${esc(i.obs)}</small>` : ''}</div>
        <span class="po-etapa">${i.entregada ? '✓ entregado' : esc(i.etapa || 'sin etapa')}</span></div>`).join('')}
    </div>`).join('')}</div>${vis.length > 120 ? '<p class="hint">Se muestran las primeras 120 OT. Usa el buscador para encontrar otras.</p>' : ''}`
    : '<div class="card empty">No hay OT en este filtro.</div>';
}
$('#view-produccion').addEventListener('click', e => {
  const f = e.target.closest('[data-fprod]'); if (f) { FILTRO_PROD = f.dataset.fprod; renderProduccion(); return; }
  if (e.target.closest('[data-prod-recargar]')) { e.preventDefault(); PROD = null; PROD_ERROR = ''; renderProduccion(); }
});
$('#buscaProd').addEventListener('input', () => { if (PROD) renderProduccion(); });

/* ---------------- Menú de ajustes (Matriz de costos y Configuración) ---------------- */
$('#btnAjustes').addEventListener('click', e => {
  e.stopPropagation(); const a = $('#ajustes'); a.classList.toggle('abierto'); $('#btnAjustes').setAttribute('aria-expanded', a.classList.contains('abierto'));
});
document.addEventListener('click', e => { if (!e.target.closest('#ajustes')) $('#ajustes').classList.remove('abierto'); });

/* La aplicación parte en el Panel. */
if (vistaActual() === 'panel') { document.body.dataset.vista = 'panel'; renderPanel(); }
