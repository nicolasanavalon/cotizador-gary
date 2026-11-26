/* Cotizador Gary — PDF de la cotización dibujado directamente (texto real, no una "foto" de la página).
   Así sale igual en Safari, Chrome y el celular: ancho completo, texto nítido y seleccionable.
   Usa jsPDF (se carga solo al generar). */
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const PDF_COL = { oro: '#a8801f', oroSuave: '#f7efda', tinta: '#1c1c1e', gris: '#6b6b70', linea: '#e7e3da', tarjeta: '#faf8f3', verde: '#1f7a4d', verdeSuave: '#e8f4ec' };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function cargarImagen(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
/* Imagen del producto con el borde izquierdo difuminado (como en la vista previa), lista para el PDF. */
async function imagenDifuminada(src, wmm, hmm) {
  const img = await cargarImagen(src); if (!img) return null;
  const k = 12, cv = document.createElement('canvas'); cv.width = Math.round(wmm * k); cv.height = Math.round(hmm * k);
  const g = cv.getContext('2d');
  const z = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight), dw = img.naturalWidth * z, dh = img.naturalHeight * z;
  g.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
  g.globalCompositeOperation = 'destination-in';
  g.save(); g.translate(cv.width, cv.height / 2); g.scale(cv.width, cv.height * 1.2);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(.35, 'rgba(0,0,0,.6)'); gr.addColorStop(.62, 'rgba(0,0,0,.3)'); gr.addColorStop(.92, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
  return cv.toDataURL('image/png');
}
async function imagenProducto(src, wmm, hmm) {
  const img = await cargarImagen(src); if (!img) return null;
  const k = 12, cv = document.createElement('canvas'); cv.width = Math.round(wmm * k); cv.height = Math.round(hmm * k);
  const g = cv.getContext('2d');
  const z = Math.min(cv.width / img.naturalWidth, cv.height / img.naturalHeight), dw = img.naturalWidth * z, dh = img.naturalHeight * z;
  const x0 = (cv.width - dw) / 2, y0 = (cv.height - dh) / 2, r = 2.2 * k;
  g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + dw, y0, x0 + dw, y0 + dh, r); g.arcTo(x0 + dw, y0 + dh, x0, y0 + dh, r); g.arcTo(x0, y0 + dh, x0, y0, r); g.arcTo(x0, y0, x0 + dw, y0, r); g.closePath(); g.clip();
  g.drawImage(img, x0, y0, dw, dh);
  return cv.toDataURL('image/png');
}
async function imagenPlana(src) {
  const img = await cargarImagen(src); if (!img) return null;
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
  return { data: cv.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight };
}
async function imagenConTransparencia(src) {
  const img = await cargarImagen(src); if (!img) return null;
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  cv.getContext('2d').drawImage(img, 0, 0);
  return { data: cv.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
}

async function pdfCotizacion(c) {
  const { jsPDF } = await cargarScript(JSPDF_URL, 'jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 14, W = PW - 2 * M, X = M;
  const PT = 0.3528;
  const t = calcTotales(c), cl = c.cliente || {};
  const color = (h, tipo = 'text') => { const [r, g, b] = rgb(h); if (tipo === 'text') doc.setTextColor(r, g, b); else if (tipo === 'fill') doc.setFillColor(r, g, b); else doc.setDrawColor(r, g, b); };
  const fuente = (tam, estilo = 'normal', col = PDF_COL.tinta) => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); color(col); };
  const alto = (tam, lh = 1.3) => tam * PT * lh;
  const texto = (s, x, y, o = {}) => {
    if (o.charSpace && o.align && typeof s === 'string') {
      const w = doc.getTextWidth(s) + o.charSpace * s.length, { align, ...r } = o;
      return doc.text(s, align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y, { baseline: 'top', ...r });
    }
    return doc.text(typeof s === 'string' ? s : s ?? '', x, y, { baseline: 'top', ...o });
  };
  const limpio = s => String(s ?? '').replace(/[\s\u00a0]+/g, ' ').trim();
  const partir = (s, ancho) => doc.splitTextToSize(limpio(s), ancho);
  const etiqueta = (s, x, y) => { fuente(7, 'bold', PDF_COL.oro); texto(String(s).toUpperCase(), x, y, { charSpace: 0.6 }); };
  const linea = (x1, y1, x2, y2, col = PDF_COL.linea, ancho = 0.25) => { color(col, 'draw'); doc.setLineWidth(ancho); doc.line(x1, y1, x2, y2); };
  let y = M;
  const nuevaPagina = () => { doc.addPage(); y = M; };
  const asegurar = h => { if (y + h > PH - M) nuevaPagina(); };

  // ---------- encabezado ----------
  const logo = await imagenPlana('logo.png');
  if (logo) doc.addImage(logo.data, 'JPEG', X - 1.5, y, 20 * logo.w / logo.h, 20);
  let yIzq = y + 21;
  if (CFG.lema) { fuente(6, 'bold', PDF_COL.gris); const ls = partir(String(CFG.lema).toUpperCase(), 112); texto(ls, X, yIzq, { lineHeightFactor: 1.4 }); yIzq += ls.length * alto(6, 1.4); }
  fuente(24, 'normal', PDF_COL.tinta); texto('COTIZACIÓN', X + W, y + 1, { align: 'right', charSpace: 2.2 });
  fuente(15, 'bold', PDF_COL.oro); texto(`N° ${c.numero ? numDoc(c) : 'borrador'}`, X + W, y + 12, { align: 'right' });
  let yDer = y + 19.5;
  if (c.version) {
    fuente(6.5, 'bold', '#7a5c12'); const tx = 'VERSIÓN ACTUALIZADA', tw = doc.getTextWidth(tx) + 0.5 * tx.length + 6;
    color(PDF_COL.oroSuave, 'fill'); doc.roundedRect(X + W - tw, yDer, tw, 4.6, 2.3, 2.3, 'F');
    texto(tx, X + W - tw / 2, yDer + 1.1, { align: 'center', charSpace: 0.5 }); yDer += 6.2;
  }
  fuente(9, 'normal', PDF_COL.gris); texto(fechaCL(c.fecha), X + W, yDer, { align: 'right' }); yDer += alto(9);
  y = Math.max(yIzq, yDer) + 2;
  linea(X, y, X + W, y, PDF_COL.oro, 0.6); y += 4;

  // ---------- tarjetas Cliente / Condiciones ----------
  const plazo = esNumero(c.plazo) ? `${+c.plazo} días hábiles` : (c.plazo || '');
  const validez = esNumero(c.validez) ? `${+c.validez} días hábiles` : (c.validez || '');
  const d = c.despacho || {};
  const textoDesp = d.modo === 'retiro' ? 'Retiro en nuestro taller (Viña del Mar)' : d.modo === 'sucursal' ? 'Gratis · retiro en sucursal Correos de Chile' : d.modo === 'domicilio' ? 'Gratis · a domicilio' : 'Gratis';
  const filasCli = [['ID cotización', c.idExterno], ['RUT', cl.rut], ['Atención', cl.contacto], ['Teléfono', cl.telefono], ['Email', cl.email],
    ['Dirección', [cl.direccion, cl.comuna, cl.region ? 'Región ' + cl.region : ''].filter(Boolean).join(', ')]].filter(f => f[1]);
  const filasCond = [['Condición de pago', c.condPago], ['Plazo de entrega', plazo], ['Validez de la oferta', validez], ['Garantía de confección', c.garantia], ['Despacho', textoDesp]].filter(f => f[1]);
  const gap = 4, cw = (W - gap) / 2, pad = 4;
  const medirKv = (filas, ancho) => filas.map(([k, v]) => {
    fuente(8, 'normal'); const wk = doc.getTextWidth(k) + 3;
    fuente(8, 'bold'); const lineas = partir(v, Math.max(25, ancho - wk));
    return { k, lineas, h: Math.max(1, lineas.length) * alto(8) + 1.6 };
  });
  fuente(11, 'bold'); const nombreL = partir(cl.nombre || '', cw - 2 * pad);
  const kvCli = medirKv(filasCli, cw - 2 * pad), kvCond = medirKv(filasCond, cw - 2 * pad);
  const hCli = pad + 4.5 + nombreL.length * alto(11) + 1.5 + kvCli.reduce((s, f) => s + f.h, 0) + pad - 1;
  const hCond = pad + 4.5 + kvCond.reduce((s, f) => s + f.h, 0) + pad - 1;
  const hCards = Math.max(hCli, hCond, 24);
  const tarjeta = (x, w, h) => { color(PDF_COL.tarjeta, 'fill'); color(PDF_COL.linea, 'draw'); doc.setLineWidth(0.25); doc.roundedRect(x, y, w, h, 2, 2, 'FD'); };
  const pintarKv = (lista, x, w, yy) => {
    for (const f of lista) {
      fuente(8, 'normal', PDF_COL.gris); texto(f.k, x, yy);
      fuente(8, 'bold', PDF_COL.tinta); f.lineas.forEach((l, i) => texto(l, x + w, yy + i * alto(8), { align: 'right' }));
      yy += f.h; linea(x, yy - 0.8, x + w, yy - 0.8, '#ebe7de', 0.15);
    }
  };
  tarjeta(X, cw, hCards); tarjeta(X + cw + gap, cw, hCards);
  etiqueta('Cliente', X + pad, y + pad);
  fuente(11, 'bold'); texto(nombreL, X + pad, y + pad + 4.5);
  pintarKv(kvCli, X + pad, cw - 2 * pad, y + pad + 4.5 + nombreL.length * alto(11) + 1.5);
  etiqueta('Condiciones comerciales', X + cw + gap + pad, y + pad);
  pintarKv(kvCond, X + cw + gap + pad, cw - 2 * pad, y + pad + 4.5);
  y += hCards + 3.5;

  fuente(8.5, 'normal'); texto('Gracias por considerarnos para esta compra. A continuación le hacemos llegar nuestra propuesta:', X, y); y += alto(8.5) + 2;

  // ---------- tabla de productos ----------
  const cols = [['#', 7, 'center'], ['Descripción', 100, 'left'], ['Medida (m)', 21, 'center'], ['Cant.', 12, 'center'], ['P. unitario', 23, 'right'], ['Total neto', W - 7 - 100 - 21 - 12 - 23, 'right']];
  const ANCHO_IMG = 36;
  const xs = []; cols.reduce((acc, col) => { xs.push(acc); return acc + col[1]; }, X);
  const cabecera = () => {
    color(PDF_COL.tinta, 'fill'); doc.rect(X, y, W, 7, 'F');
    fuente(6.8, 'bold', '#ffffff');
    cols.forEach(([n, w, al], i) => { const tx = n.toUpperCase(), xx = al === 'right' ? xs[i] + w - 2 : al === 'center' ? xs[i] + w / 2 : xs[i] + 2; texto(tx, xx, y + 2.2, { align: al, charSpace: 0.35 }); });
    y += 7;
  };
  cabecera();
  const medidaDoc = m => String(m || '').replace(/\s*x\s*/i, ' × ');
  for (const [idx, l] of t.lineas.entries()) {
    const it = normalizarItem(l.it), titulo = it.titulo || tituloAuto(it), det = it.obs ? textoCliente(it.obs) : '';
    const src = imgDe(it.imagen), anchoTxt = cols[1][1] - 4 - (src ? ANCHO_IMG + 2 : 0);
    fuente(9, 'bold'); const titL = partir(titulo, anchoTxt);
    fuente(8, 'normal'); const detL = det ? partir(det, anchoTxt) : [];
    const h = Math.max(src ? 17 : 10, 3 + titL.length * alto(9) + (detL.length ? 1 + detL.length * alto(8) : 0) + 3);
    if (y + h > PH - M - 10) { nuevaPagina(); cabecera(); }
    if (idx % 2 === 1) { color('#fbfaf7', 'fill'); doc.rect(X, y, W, h, 'F'); }
    if (src) { const ih = Math.min(h - 3, 24), im = await imagenProducto(src, ANCHO_IMG, ih); if (im) doc.addImage(im, 'PNG', xs[1] + cols[1][1] - ANCHO_IMG - 1, y + (h - ih) / 2, ANCHO_IMG, ih); }
    fuente(8.5, 'normal', PDF_COL.gris); texto(String(idx + 1), xs[0] + cols[0][1] / 2, y + 3, { align: 'center' });
    fuente(9, 'bold', PDF_COL.tinta); texto(titL, xs[1] + 2, y + 3);
    if (detL.length) { fuente(8, 'normal', '#45454a'); texto(detL, xs[1] + 2, y + 3 + titL.length * alto(9) + 1); }
    fuente(8.5, 'normal', PDF_COL.tinta);
    texto(medidaDoc(medidaEf(it)), xs[2] + cols[2][1] / 2, y + 3, { align: 'center' });
    texto(String(l.k.cant), xs[3] + cols[3][1] / 2, y + 3, { align: 'center' });
    texto(clp(l.precioDoc), xs[4] + cols[4][1] - 2, y + 3, { align: 'right' });
    fuente(8.5, 'bold'); texto(clp(l.totalDoc), xs[5] + cols[5][1] - 2, y + 3, { align: 'right' });
    y += h; linea(X, y, X + W, y);
  }
  if (t.lineas.some(l => l.it.imagen)) { y += 1.5; fuente(7, 'italic', PDF_COL.gris); texto('Imágenes referenciales.', X, y); y += alto(7); }
  y += 3;

  // ---------- notas y totales ----------
  const anchoTot = 70, anchoIzq = W - anchoTot - 6;
  fuente(9, 'bold'); const notaL = c.obs ? partir(textoCliente(c.obs), anchoIzq - 8) : [];
  const acepta = `Para aceptar esta cotización, responda este correo o envíe su orden de compra indicando el N° ${c.numero ? numDoc(c) : 'de cotización'}.`;
  fuente(7.5, 'normal'); const aceptaL = partir(acepta, anchoIzq);
  const hNota = notaL.length ? notaL.length * alto(9) + 5 : 0, hDesp = d.modo !== 'retiro' ? 8 : 0;
  const filasTot = (t.descuento ? [['Subtotal', clp(t.subtotal)], [`Descuento ${pct(t.pctDesc / 100)}`, '-' + clp(t.descuento)]] : []).concat([['Total neto', clp(t.neto)], ['IVA 19%', clp(t.iva)]]);
  const hTot = filasTot.length * 6.5 + 10;
  asegurar(Math.max(hNota + 2 + hDesp + 2 + aceptaL.length * alto(7.5), hTot));
  let yl = y;
  if (notaL.length) {
    color(PDF_COL.oroSuave, 'fill'); doc.rect(X, yl, anchoIzq, hNota, 'F'); color(PDF_COL.oro, 'fill'); doc.rect(X, yl, 1, hNota, 'F');
    fuente(9, 'bold', PDF_COL.tinta); texto(notaL, X + 4.5, yl + 2.5); yl += hNota + 2;
  }
  if (hDesp) {
    color(PDF_COL.verdeSuave, 'fill'); doc.roundedRect(X, yl, anchoIzq, hDesp, 1.8, 1.8, 'F');
    fuente(9, 'bold', PDF_COL.verde); texto('Despacho gratis', X + 4, yl + 2.4);
    const wb = doc.getTextWidth('Despacho gratis '); fuente(9, 'normal', PDF_COL.verde);
    texto(d.modo === 'sucursal' ? '· retiro en sucursal Correos' : 'a domicilio', X + 4 + wb, yl + 2.4); yl += hDesp + 2;
  }
  fuente(7.5, 'normal', PDF_COL.gris); texto(aceptaL, X, yl); yl += aceptaL.length * alto(7.5);
  let yr = y; const xt = X + W - anchoTot;
  for (const [k, v] of filasTot) {
    fuente(8.5, 'normal', k.startsWith('Descuento') ? '#b42318' : PDF_COL.tinta); texto(k, xt + 3, yr + 1.5);
    texto(v, X + W - 3, yr + 1.5, { align: 'right' }); yr += 6.5; linea(xt, yr - 0.6, X + W, yr - 0.6);
  }
  color(PDF_COL.tinta, 'fill'); doc.roundedRect(xt, yr + 0.5, anchoTot, 9.5, 1.8, 1.8, 'F');
  fuente(8.5, 'bold', '#ffffff'); doc.text('TOTAL', xt + 3.5, yr + 5.25, { baseline: 'middle', charSpace: 0.5 });
  fuente(12, 'bold', '#e8c76a'); doc.text(clp(t.bruto), X + W - 3.5, yr + 5.25, { baseline: 'middle', align: 'right' }); yr += 10.5;
  y = Math.max(yl, yr) + 5;

  // ---------- transferencia, contactos y sellos ----------
  const contactos = String(CFG.contactos || '').split('\n').map(s => s.trim()).filter(Boolean);
  const filasBanco = [['RUT', CFG.rutEmpresa], ['Banco', CFG.banco], ['Cuenta corriente', CFG.cuentaCte], ['Email', CFG.mailEmpresa]].filter(f => f[1]);
  const lineasCont = contactos.concat([CFG.fonoEmpresa, CFG.mailEmpresa].filter(Boolean));
  const hCierre = 4 + 5 + Math.max((CFG.empresa ? 4.6 : 0) + filasBanco.length * 4.6, lineasCont.length * 4.2, 19) + 3 + 12;
  if (y + hCierre > PH - 8) nuevaPagina();   // el pie puede ir más cerca del borde
  linea(X, y, X + W, y); y += 4;
  const c1 = X, c2 = X + 74, wc1 = 66;
  etiqueta('Datos para transferencia', c1, y); etiqueta('Contactos', c2, y);
  let y1 = y + 5;
  if (CFG.empresa) { fuente(8.5, 'bold'); texto(CFG.empresa, c1, y1); y1 += 4.6; }
  for (const [k, v] of filasBanco) { fuente(8, 'normal', PDF_COL.gris); texto(k, c1, y1); fuente(8, 'bold', PDF_COL.tinta); texto(v, c1 + wc1, y1, { align: 'right' }); y1 += 4.6; }
  let y2 = y + 5;
  contactos.forEach(x => { fuente(8.5, 'bold'); texto(x, c2, y2); y2 += 4.2; });
  [CFG.fonoEmpresa, CFG.mailEmpresa].filter(Boolean).forEach(x => { fuente(8.5, 'normal'); texto(x, c2, y2); y2 += 4.2; });
  const cc = await imagenConTransparencia('sello-chilecompra.png'), sm = await imagenConTransparencia('sello-mujer.png');
  if (sm) doc.addImage(sm.data, 'PNG', X + W - 17, y + 2, 17, 17);
  if (cc) doc.addImage(cc.data, 'PNG', X + W - 20 - 35, y + 5.5, 33, 33 * cc.h / cc.w);
  y = Math.max(y1, y2, y + 21) + 3;

  // ---------- pie ----------
  linea(X, y, X + W, y, PDF_COL.oro, 0.6); y += 2.5;
  const lc = await imagenPlana('logo-compacto.png');
  if (lc) doc.addImage(lc.data, 'JPEG', X, y, 9 * lc.w / lc.h, 9);
  const pie = [CFG.empresa, CFG.dirEmpresa].filter(Boolean).join(' · ');
  fuente(7.5, 'normal', PDF_COL.gris); texto(pie + (CFG.web ? ' · ' : ''), X + 25, y + 3);
  if (CFG.web) { const wp = doc.getTextWidth(pie + ' ·') + 1.6; fuente(7.5, 'bold', PDF_COL.oro); texto(CFG.web, X + 25 + wp, y + 3); }

  // número de página si son varias
  const n = doc.getNumberOfPages();
  if (n > 1) for (let i = 1; i <= n; i++) { doc.setPage(i); fuente(7, 'normal', PDF_COL.gris); texto(`Página ${i} de ${n}`, X + W, PH - 8, { align: 'right' }); }
  return doc;
}
/* Reemplaza la descarga de la cotización: PDF dibujado (si falla, el método anterior). */
async function imprimirCotizacion(c) {
  await asegurarImagenes(c.items);
  const nombre = `Cotización ${numDoc(c)}${c.version ? ' (actualizada)' : ''} - ${c.cliente.nombre || 'cliente'} - Banderas Gary`;
  toast('Generando PDF…');
  try {
    const doc = await pdfCotizacion(c);
    const archivo = nombre.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() + '.pdf';
    doc.save(archivo);
    toast('PDF descargado: ' + archivo);
  } catch (e) {
    console.error(e);
    await descargarPdf(htmlCotizacion(c), nombre);
  }
}
