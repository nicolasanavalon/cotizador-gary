/* Cotizador Gary — flujo completo (cotización → envío → aprobación → OT → factura → pago),
   módulo de Facturación y Panel de indicadores (KPI).
   Usa las funciones y datos globales de app.js (COTS, OTS, api, clp, pct, fechaCL…). */

const ESTADOS_COT = ['Borrador', 'Enviada', 'Aprobada', 'Rechazada', 'Vencida'];
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
  if (e === 'Enviada' && esNumero(c.validez) && +c.validez > 0 && sumarDiasHabiles(c.fechaEnvio || c.fecha, +c.validez) < hoy()) e = 'Vencida';
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
    const ctl = c.type === 'select'
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
      for (const c of campos) { const v = $('#fc_' + c.k).value; out[c.k] = c.type === 'money' || c.type === 'number' ? num(v) : v.trim(); }
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
      const d = await pedirDatos(`Rechazar cotización N° ${numDoc(c)}`, c.cliente.nombre, [
        { k: 'motivo', label: 'Motivo', type: 'select', opciones: MOTIVOS_RECHAZO, value: 'Precio' },
        { k: 'detalle', label: 'Detalle (opcional)', placeholder: 'Ej: compró a $9.900 la unidad' }], 'Rechazar');
      if (!d) return;
      c.estado = 'Rechazada'; c.fechaRechazo = hoy(); c.motivoRechazo = d.motivo + (d.detalle ? ': ' + d.detalle : '');
      await guardarCotLista(c); toast(`Cotización ${numDoc(c)} rechazada`);
    }
  } catch (err) { Object.assign(c, JSON.parse(antes)); toast('No se pudo guardar: ' + err.message); }
  renderCotizaciones();
}

/* ---------------- Facturación ---------------- */
let FILTRO_FACT = '';
const ETQ_FACT = { porFacturar: 'Por facturar', emitida: 'Por cobrar', vencida: 'Vencidas', pagada: 'Pagadas' };
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
  $('#filtrosFact').innerHTML = [['', 'Todas', filas.length], ...Object.entries(ETQ_FACT).map(([k, l]) => [k, l, de(k).length])]
    .map(([v, l, n]) => `<button type="button" class="chip ${FILTRO_FACT === v ? 'active' : ''}" data-ff="${v}">${l} <small>${n}</small></button>`).join('');
  const vis = filas.filter(x => !FILTRO_FACT || x.f.codigo === FILTRO_FACT);
  if (!vis.length) { $('#tablaFact').innerHTML = `<tr><td class="empty">${filas.length ? 'Nada en este filtro.' : 'Aún no hay ventas aprobadas. Al aprobar una cotización aparece aquí para facturarla.'}</td></tr>`; return; }
  $('#tablaFact').innerHTML = `<thead><tr><th>Cotización</th><th>OT</th><th>Cliente</th><th>Condición de pago</th><th class="num">Total</th><th>Factura</th><th>Emisión</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>` +
    vis.map(({ c, f, ot }) => {
      const fa = c.factura || {};
      const acc = f.codigo === 'porFacturar' ? '<button class="btn sm primary" data-fa="facturar">Emitir factura</button>'
        : f.codigo === 'pagada' ? `<small class="muted" title="${esc(fa.medioPago || '')}">pagada ${fechaCL(fa.fechaPago)}</small>`
        : '<button class="btn sm ok" data-fa="pagar">Registrar pago</button>';
      const estado = { porFacturar: ['Por facturar', 'PorFacturar'], emitida: ['Por cobrar', 'PorCobrar'], vencida: [`Vencida (${diasEntre(fa.vence, hoy())} días)`, 'Vencida'], pagada: ['Pagada', 'Pagada'] }[f.codigo];
      return `<tr data-id="${c.id}"><td><b>${esc(numDoc(c))}</b>${c.demo ? ' <span class="badge Ejemplo">ejemplo</span>' : ''}${c.oc ? `<br><small class="muted">${/^oc\b/i.test(c.oc) ? '' : 'OC '}${esc(c.oc)}</small>` : ''}</td>
        <td>${ot ? `${esc(ot.numero)}<br><small class="muted">${esc(ot.estado)}</small>` : '—'}</td>
        <td>${esc(c.cliente.nombre)}</td><td><small>${esc(c.condPago || '—')}</small></td>
        <td class="num">${clp(fa.total ?? c.totales?.bruto)}</td>
        <td>${fa.numero ? `<b>N° ${esc(fa.numero)}</b>` : '—'}</td><td>${fechaCL(fa.fecha) || '—'}</td><td>${fechaCL(fa.vence) || '—'}</td>
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
        { k: 'neto', label: 'Monto neto', type: 'money', value: t.neto, ayuda: 'Cámbialo si se factura una parte (ej. anticipo del 50%)' }], 'Emitir factura');
      if (!d) return;
      const neto = Math.round(d.neto || t.neto || 0), iva = Math.round(neto * IVA);
      c.factura = { numero: d.numero, fecha: d.fecha, vence: sumarDias(d.fecha, d.dias), neto, iva, total: neto + iva, pagada: false };
    }
    if (a === 'pagar') {
      const fa = c.factura;
      const d = await pedirDatos(`Registrar pago · factura N° ${fa.numero}`, `${c.cliente.nombre} · total ${clp(fa.total)}`, [
        { k: 'fecha', label: 'Fecha de pago', type: 'date', value: hoy(), requerido: true },
        { k: 'medio', label: 'Medio de pago', type: 'select', opciones: MEDIOS_PAGO, value: 'Transferencia' },
        { k: 'monto', label: 'Monto recibido', type: 'money', value: fa.total }], 'Registrar pago');
      if (!d) return;
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
  const aprob = de('Aprobada'), rech = de('Rechazada'), venc = de('Vencida'), env = de('Enviada');
  const suma = (arr, k = 'neto') => arr.reduce((s, x) => s + (+x.t[k] || 0), 0);
  return { desde, cots, aprob, rech, venc, env, suma };
}
function renderPanel() {
  $('#panelPeriodo').innerHTML = PERIODOS.map(([k, l]) => `<button type="button" class="chip ${PERIODO === k ? 'active' : ''}" data-per="${k}">${l}</button>`).join('');
  const { cots, aprob, rech, venc, env, suma } = datosPanel();
  if (!COTS.length) { $('#panelCuerpo').innerHTML = '<div class="card empty">Todavía no hay cotizaciones. Los indicadores aparecen a medida que se cotiza.</div>'; return; }
  const decididas = aprob.length + rech.length + venc.length;
  const tasa = decididas ? aprob.length / decididas : null;
  const tasaMonto = suma(aprob) + suma(rech) + suma(venc) ? suma(aprob) / (suma(aprob) + suma(rech) + suma(venc)) : null;
  const venta = suma(aprob), margen = suma(aprob, 'margen');
  const dias = aprob.filter(x => x.c.fechaAprob).map(x => diasEntre(x.c.fechaEnvio || x.c.fecha, x.c.fechaAprob));
  const porVencer = env.filter(x => { const v = venceCot(x.c); return v && v <= sumarDiasHabiles(hoy(), 3); });
  const todas = COTS.filter(c => estadoCot(c) === 'Aprobada').map(c => ({ c, f: estadoFactura(c) }));
  const totF = arr => arr.reduce((s, x) => s + (x.c.factura?.total ?? x.c.totales?.bruto ?? 0), 0);
  const porCobrar = todas.filter(x => ['emitida', 'vencida'].includes(x.f.codigo)), vencido = todas.filter(x => x.f.codigo === 'vencida');
  const porFacturar = todas.filter(x => x.f.codigo === 'porFacturar');
  const otsAbiertas = OTS.filter(o => !['Entregada'].includes(o.estado));
  const atrasadas = OTS.filter(otAtrasada);

  const kpis = [
    kpi('Cotizado (neto)', corto(suma(cots)), `${cots.length} cotizacion${cots.length === 1 ? '' : 'es'}`),
    kpi('Vendido (neto)', corto(venta), `${aprob.length} aprobada${aprob.length === 1 ? '' : 's'}`, 'ok'),
    kpi('Tasa de aprobación', tasa == null ? '—' : pct(tasa), tasaMonto == null ? 'sin cotizaciones resueltas' : `${pct(tasaMonto)} del monto · ${aprob.length} de ${decididas}`),
    kpi('Margen de lo vendido', venta ? pct(margen / venta) : '—', venta ? `${corto(margen)} de margen` : ''),
    kpi('Venta promedio', aprob.length ? corto(venta / aprob.length) : '—', 'por cotización aprobada'),
    kpi('Días para aprobar', dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) + ' días' : '—', 'desde el envío, en promedio'),
    kpi('En carpeta', corto(suma(env)), `${env.length} enviada${env.length === 1 ? '' : 's'} esperando respuesta${porVencer.length ? ` · <b>${porVencer.length} vence${porVencer.length === 1 ? '' : 'n'} pronto</b>` : ''}`, porVencer.length ? 'warn' : ''),
    kpi('Por cobrar', corto(totF(porCobrar)), vencido.length ? `<b>${corto(totF(vencido))} vencido</b> · ${vencido.length} factura${vencido.length === 1 ? '' : 's'}` : `${porCobrar.length} factura${porCobrar.length === 1 ? '' : 's'} al día`, vencido.length ? 'bad' : ''),
  ].join('');

  // embudo del período
  const conOt = aprob.filter(x => otDe(x.c)), entregadas = conOt.filter(x => ['Despachada', 'Entregada'].includes(otDe(x.c).estado));
  const facturadas = aprob.filter(x => x.c.factura?.numero), pagadas = aprob.filter(x => x.c.factura?.pagada);
  const enviadas = cots.filter(x => x.e !== 'Borrador');
  const embudo = [['Cotizadas', cots], ['Enviadas', enviadas], ['Aprobadas', aprob], ['Con OT', conOt], ['Despachadas / entregadas', entregadas], ['Facturadas', facturadas], ['Pagadas', pagadas]]
    .map(([l, arr]) => ({ l, n: arr.length, v: suma(arr) }));
  const max0 = Math.max(1, embudo[0].n);
  const htmlEmbudo = embudo.map((x, i) => `<div class="hb" data-tip="${tip(x.l, `${x.n} cotizaciones · ${clp(x.v)} neto`, i ? `${pct(x.n / max0)} de las cotizadas` : '')}" tabindex="0">
      <span class="hb-l">${esc(x.l)}</span><span class="hb-t"><i style="width:${Math.max(x.n ? 2 : 0, x.n / max0 * 100)}%"></i></span>
      <span class="hb-v"><b>${x.n}</b> <small>${i ? pct(x.n / max0) : ''}</small></span></div>`).join('');

  // por mes (últimos 6 meses, por fecha de la cotización)
  const h = hoy(), y = +h.slice(0, 4), m = +h.slice(5, 7);
  const meses = Array.from({ length: 6 }, (_, k) => { const d = new Date(y, m - 6 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const porMes = meses.map(mm => {
    const del = COTS.filter(c => String(c.fecha).startsWith(mm));
    const ap = del.filter(c => estadoCot(c) === 'Aprobada');
    return { mm, cot: del.reduce((s, c) => s + (+c.totales?.neto || 0), 0), apr: ap.reduce((s, c) => s + (+c.totales?.neto || 0), 0), n: del.length, na: ap.length };
  });

  // clientes y productos (lo vendido en el período)
  const porCliente = {};
  for (const x of aprob) { const k = x.c.cliente.nombre || '—'; porCliente[k] = (porCliente[k] || 0) + (+x.t.neto || 0); }
  const topCli = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const porProd = {};
  for (const x of aprob) for (const it of x.c.items || []) {
    const k = categoriaProducto(it), k2 = calcItem(it);
    porProd[k] = porProd[k] || { v: 0, c: 0, u: 0 }; porProd[k].v += k2.venta; porProd[k].c += k2.costo; porProd[k].u += k2.cant;
  }
  const topProd = Object.entries(porProd).sort((a, b) => b[1].v - a[1].v).slice(0, 6);
  const motivos = {};
  for (const x of rech) { const k = String(x.c.motivoRechazo || 'Sin motivo').split(':')[0]; motivos[k] = (motivos[k] || 0) + 1; }

  const barras = (filas, max) => filas.map(f => `<div class="hb" data-tip="${f.tip}" tabindex="0"><span class="hb-l">${esc(f.l)}</span>
      <span class="hb-t"><i style="width:${Math.max(2, f.v / max * 100)}%"></i></span><span class="hb-v">${f.txt}</span></div>`).join('');
  const maxCli = Math.max(1, ...topCli.map(x => x[1])), maxProd = Math.max(1, ...topProd.map(x => x[1].v));

  // requiere atención
  const alertas = [];
  for (const o of atrasadas) alertas.push(['bad', `OT ${o.numero} atrasada`, `${o.cliente?.nombre || ''} · entrega ${fechaCL(otEntrega(o))} · ${o.estado}`, 'ots']);
  for (const x of vencido) alertas.push(['bad', `Factura N° ${x.c.factura.numero} vencida`, `${x.c.cliente.nombre} · ${clp(x.c.factura.total)} · venció ${fechaCL(x.c.factura.vence)}`, 'facturas']);
  for (const x of porVencer) alertas.push(['warn', `Cotización N° ${numDoc(x.c)} vence ${fechaCL(venceCot(x.c))}`, `${x.c.cliente.nombre} · ${clp(x.t.neto)} neto · hacer seguimiento`, 'cotizaciones']);
  for (const x of COTS.filter(c => estadoCot(c) === 'Vencida').slice(0, 5)) alertas.push(['warn', `Cotización N° ${numDoc(x)} venció sin respuesta`, `${x.cliente.nombre} · ${clp(x.totales?.neto)} neto · llamar o marcar rechazada`, 'cotizaciones']);
  for (const x of porFacturar.filter(x => ['Despachada', 'Entregada', 'Terminada'].includes(otDe(x.c)?.estado))) alertas.push(['info', `Cotización N° ${numDoc(x.c)} lista para facturar`, `${x.c.cliente.nombre} · OT ${otDe(x.c).estado.toLowerCase()} · ${clp(x.c.totales?.bruto)}`, 'facturas']);
  const proximas = OTS.filter(o => !otAtrasada(o) && !['Despachada', 'Entregada'].includes(o.estado) && otEntrega(o) >= hoy() && otEntrega(o) <= sumarDias(hoy(), 7));
  for (const o of proximas) alertas.push(['info', `OT ${o.numero} se entrega ${fechaCL(otEntrega(o))}`, `${o.cliente?.nombre || ''} · ${o.estado}`, 'ots']);

  const prod = ESTADOS_OT.map(e => [e, OTS.filter(o => o.estado === e).length]);

  $('#panelCuerpo').innerHTML = `
    <div class="kpis">${kpis}</div>
    <div class="viz-grid">
      <div class="card viz"><h3>Cotizado y aprobado por mes</h3><p class="hint">Neto, según la fecha de la cotización · últimos 6 meses</p>
        <div class="leyenda"><span><i class="sw a"></i>Cotizado</span><span><i class="sw b"></i>Aprobado</span></div>
        ${graficoMeses(porMes)}
        <details class="tabla-datos"><summary>Ver datos</summary><table class="list"><thead><tr><th>Mes</th><th class="num">Cotizado</th><th class="num">Aprobado</th><th class="num">N°</th></tr></thead>
          <tbody>${porMes.map(x => `<tr><td>${MESES_LARGO[+x.mm.slice(5) - 1]} ${x.mm.slice(0, 4)}</td><td class="num">${clp(x.cot)}</td><td class="num">${clp(x.apr)}</td><td class="num">${x.na} de ${x.n}</td></tr>`).join('')}</tbody></table></details></div>
      <div class="card viz"><h3>Embudo comercial</h3><p class="hint">Cuántas cotizaciones del período llegaron a cada paso</p>
        <div class="hbars embudo">${htmlEmbudo}</div></div>
      <div class="card viz"><h3>Mejores clientes</h3><p class="hint">Venta neta aprobada en el período</p>
        <div class="hbars">${topCli.length ? barras(topCli.map(([l, v]) => ({ l, v, txt: corto(v), tip: tip(l, clp(v) + ' neto') })), maxCli) : '<p class="empty">Sin ventas en el período.</p>'}</div></div>
      <div class="card viz"><h3>Qué se vende</h3><p class="hint">Venta neta por tipo de producto y su margen</p>
        <div class="hbars">${topProd.length ? barras(topProd.map(([l, x]) => ({ l, v: x.v, txt: `${corto(x.v)} <small>${pct(x.v ? (x.v - x.c) / x.v : 0)} mg</small>`, tip: tip(l, `${clp(x.v)} neto · ${x.u} u.`, `Margen ${pct(x.v ? (x.v - x.c) / x.v : 0)} (${clp(x.v - x.c)})`) })), maxProd) : '<p class="empty">Sin ventas en el período.</p>'}</div></div>
    </div>
    <div class="viz-grid">
      <div class="card"><h3>Requiere atención <small class="muted">${alertas.length}</small></h3>
        ${alertas.length ? `<ul class="alertas">${alertas.slice(0, 12).map(([t, a, b, v]) => `<li class="${t}" data-ir="${v}"><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul>` : '<p class="empty">Todo al día. 👌</p>'}</div>
      <div class="card"><h3>Producción</h3>
        <div class="prod">${prod.map(([e, n]) => `<div class="${n && e !== 'Entregada' ? '' : 'cero'}"><b>${n}</b><span>${e}</span></div>`).join('')}</div>
        <p class="hint">${otsAbiertas.length} OT abiertas${atrasadas.length ? ` · <b class="atraso">${atrasadas.length} atrasada${atrasadas.length === 1 ? '' : 's'}</b>` : ' · ninguna atrasada'}</p>
        <h3 style="margin-top:18px">Motivos de rechazo</h3>
        ${Object.keys(motivos).length ? `<div class="hbars">${barras(Object.entries(motivos).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v, txt: String(v), tip: tip(l, `${v} cotización(es)`) })), Math.max(...Object.values(motivos)))}</div>` : '<p class="empty">Sin rechazos en el período.</p>'}
        <h3 style="margin-top:18px">Cobranza</h3>
        <div class="kpis mini">${kpi('Por facturar', corto(totF(porFacturar)), `${porFacturar.length} venta(s)`)}${kpi('Por cobrar', corto(totF(porCobrar)), '')}${kpi('Vencido', corto(totF(vencido)), '', vencido.length ? 'bad' : '')}</div>
      </div>
    </div>`;
}
function categoriaProducto(it) {
  normalizarItem(it);
  if (!esBandera(it)) return productoEf(it) || 'Otro';
  const t = String(it.tipo || '');
  if (/pabell/i.test(t)) return 'Pabellón nacional';
  if (/sublimad/i.test(t)) return 'Bandera sublimada';
  if (/aplicaci/i.test(t)) return 'Bandera con aplicación';
  if (/cuadra/i.test(t)) return 'Banderas de cuadra';
  if (/uniones/i.test(t)) return 'Bandera de uniones';
  return t ? t.replace(/\s*\(.*?\)/, '').replace(/\s*\d\/Faz/i, '') : 'Bandera';
}
/* Barras agrupadas por mes (SVG). Un eje, marcas delgadas, puntas redondeadas y tooltip por mes. */
function graficoMeses(datos) {
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
    const x0 = L + gw * i + (gw - (bw * 2 + 2)) / 2;
    g += `<path d="${barra(x0, d.cot)}" class="s-a"/><path d="${barra(x0 + bw + 2, d.apr)}" class="s-b"/>`;
    g += `<text x="${L + gw * i + gw / 2}" y="${H - 8}" class="ax" text-anchor="middle">${MESES[+d.mm.slice(5) - 1]}</text>`;
    g += `<rect x="${L + gw * i}" y="${T}" width="${gw}" height="${H - T - B}" class="hit" tabindex="0" data-tip="${tip(`${MESES_LARGO[+d.mm.slice(5) - 1]} ${d.mm.slice(0, 4)}`, `Cotizado: ${clp(d.cot)} (${d.n})`, `Aprobado: ${clp(d.apr)} (${d.na})`)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img" aria-label="Cotizado y aprobado por mes">${g}</svg>`;
}
$('#panelPeriodo').addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (!b) return; PERIODO = b.dataset.per; renderPanel(); });
$('#panelCuerpo').addEventListener('click', e => { const li = e.target.closest('[data-ir]'); if (li) mostrar(li.dataset.ir); });

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
  $$('#tabs button').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'config') info(); }));
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
