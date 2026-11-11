/* Cotizador Gary — cálculo de despacho Correos de Chile.
 *
 * Tarifas: Brochure Empresa CorreosChile, vigencia desde octubre 2025 (exentas de IVA),
 * servicio "Paquete Express", ORIGEN VALPARAÍSO / VIÑA DEL MAR.
 *   - Domicilio: entrega en domicilio (2.1.1).
 *   - Sucursal: retiro en sucursal/agencia (2.1.2).
 * Rangos de peso (kg) hasta 1,5 · 3 · 6 · 10 · 15 y luego valor por kilo adicional.
 * Se cobra el mayor entre peso físico y volumétrico (largo×ancho×alto en cm / 4000).
 * Zonas secundarias: +20%. Máx. 50 kg físicos / 250 kg volumen por pieza; suma de lados ≤ 3 m.
 */
'use strict';

const Envio = (() => {
  const RANGOS = [1.5, 3, 6, 10, 15];
  // destino: [hasta 1,5, 3, 6, 10, 15, kilo adicional]
  const TARIFAS = {
    domicilio: {
      'Arica, Iquique': [12100, 24040, 46297, 76216, 76216, 3201],
      'Antofagasta': [10478, 18032, 32533, 52859, 56999, 2753],
      'Calama': [11886, 21628, 39042, 66591, 66591, 2860],
      'Copiapó': [6007, 7394, 8877, 12932, 13732, 758],
      'La Serena, Coquimbo': [6413, 7640, 10446, 12335, 13071, 715],
      'Valparaíso, Viña del Mar': [4652, 4823, 5346, 5527, 6199, 352],
      'Santiago': [5954, 7330, 9752, 11833, 12537, 726],
      'Rancagua, San Fernando': [6029, 6989, 9688, 11673, 12388, 694],
      'Curicó, Talca, Chillán, Concepción, Los Ángeles': [6029, 6903, 9390, 11886, 12612, 843],
      'Temuco, Valdivia, Osorno': [6317, 7330, 10446, 12441, 13209, 928],
      'Puerto Montt, Pto. Varas, Castro': [6583, 8664, 11940, 12772, 14191, 928],
      'Coyhaique': [13530, 20945, 38519, 60179, 73580, 3649],
      'Punta Arenas': [14138, 20764, 38199, 59976, 73324, 3649],
    },
    sucursal: {
      'Arica, Iquique': [11492, 22834, 43982, 72407, 72407, 3041],
      'Antofagasta': [9955, 17136, 30911, 50213, 54150, 2614],
      'Calama': [11289, 20550, 37089, 63262, 63262, 2721],
      'Copiapó': [5708, 7021, 8429, 12281, 13049, 715],
      'La Serena, Coquimbo': [6093, 7256, 9923, 11716, 12420, 683],
      'Valparaíso, Viña del Mar': [4417, 4577, 5079, 5250, 5890, 331],
      'Santiago': [5655, 6968, 9262, 11246, 11908, 694],
      'Rancagua, San Fernando': [5730, 6637, 9208, 11086, 11769, 662],
      'Curicó, Talca, Chillán, Concepción, Los Ángeles': [5730, 6562, 8920, 11289, 11982, 800],
      'Temuco, Valdivia, Osorno': [5997, 6968, 9923, 11822, 12548, 886],
      'Puerto Montt, Pto. Varas, Castro': [6253, 8227, 11342, 12132, 13487, 886],
      'Coyhaique': [12857, 19900, 36598, 57170, 69899, 3468],
      'Punta Arenas': [13434, 19729, 36289, 56978, 69654, 3468],
    },
  };
  const DESTINOS = Object.keys(TARIFAS.domicilio);

  const sinTilde = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* Destino Correos según región (y comuna cuando la región tiene más de un destino). */
  function destinoDe(region, comuna) {
    const r = sinTilde(region), c = sinTilde(comuna);
    if (!r) return '';
    if (r.includes('arica') || r.includes('tarapaca')) return 'Arica, Iquique';
    if (r.includes('antofagasta')) return c.includes('calama') ? 'Calama' : 'Antofagasta';
    if (r.includes('atacama')) return 'Copiapó';
    if (r.includes('coquimbo')) return 'La Serena, Coquimbo';
    if (r.includes('valparaiso')) return 'Valparaíso, Viña del Mar';
    if (r.includes('metropolitana')) return 'Santiago';
    if (r.includes('higgins')) return 'Rancagua, San Fernando';
    if (r.includes('maule') || r.includes('nuble') || r.includes('biobio')) return 'Curicó, Talca, Chillán, Concepción, Los Ángeles';
    if (r.includes('araucania') || r.includes('los rios')) return 'Temuco, Valdivia, Osorno';
    if (r.includes('los lagos')) return c.includes('osorno') ? 'Temuco, Valdivia, Osorno' : 'Puerto Montt, Pto. Varas, Castro';
    if (r.includes('aysen')) return 'Coyhaique';
    if (r.includes('magallanes')) return 'Punta Arenas';
    return '';
  }

  /* Tarifa de UNA pieza. */
  function tarifa(servicio, destino, kg, secundaria) {
    const t = (TARIFAS[servicio] || {})[destino];
    if (!t) return null;
    let v;
    const i = RANGOS.findIndex(r => kg <= r + 1e-9);
    if (i >= 0) v = t[i];
    else v = t[4] + Math.ceil(kg - 15 - 1e-9) * t[5];
    return Math.round(v * (secundaria ? 1.2 : 1));
  }

  const volumetrico = c => (+c.largo * +c.ancho * +c.alto) / 4000;

  /* Cuántas banderas de una medida caben en una caja:
     1) la capacidad exacta que se haya indicado para esa medida; si no,
     2) estimación por m² de bandera que caben en la caja. */
  function capacidad(caja, medida, area, tabla) {
    const fila = (tabla || {})[medida];
    if (fila && +fila[caja.id] > 0) return { n: +fila[caja.id], estimada: false };
    if (+caja.capM2 > 0 && area > 0) return { n: Math.floor(+caja.capM2 / area), estimada: true };
    return { n: 0, estimada: true };
  }

  /* Empaca TODO el pedido y elige la combinación de cajas más barata.
     piezas: [{ medida, area, cantidad }] · cajas: [{ id, nombre, largo, ancho, alto, pesoVacia, capM2 }] */
  function empacar(piezas, cajas, opts) {
    const { tabla, pesoM2 = 0.2, servicio, destino, secundaria } = opts;
    piezas = piezas.filter(p => p.cantidad > 0 && p.area > 0);
    if (!piezas.length || !cajas.length) return { cajas: [], costo: 0, avisos: [] };
    const avisos = [];
    let estimada = false;
    // fracción de cada caja que ocupa el pedido completo
    const fill = cajas.map(c => {
      let f = 0;
      for (const p of piezas) {
        const cap = capacidad(c, p.medida, p.area, tabla);
        if (cap.estimada) estimada = true;
        if (cap.n < 1) return Infinity;
        f += p.cantidad / cap.n;
      }
      return f;
    });
    const kgBanderas = piezas.reduce((s, p) => s + p.cantidad * p.area * pesoM2, 0);
    const precio = (combo) => {
      const nTot = combo.reduce((s, x) => s + x.n, 0);
      let total = 0;
      const det = combo.filter(x => x.n > 0).map(x => {
        const c = cajas[x.i];
        const kgFis = (+c.pesoVacia || 0) + kgBanderas / nTot;
        const kg = Math.max(volumetrico(c), kgFis);
        const v = tarifa(servicio, destino, kg, secundaria);
        total += (v ?? 0) * x.n;
        return { id: c.id, nombre: c.nombre, n: x.n, kg: Math.round(kg * 10) / 10, unitario: v };
      });
      return { cajas: det, costo: total, nCajas: nTot };
    };
    const candidatos = [];
    cajas.forEach((_, b) => {
      if (!isFinite(fill[b])) return;
      candidatos.push([{ i: b, n: Math.max(1, Math.ceil(fill[b] - 1e-9)) }]);
      const nb = Math.floor(fill[b] + 1e-9), r = fill[b] - nb;
      if (r > 1e-9) cajas.forEach((__, c) => {
        if (c === b || !isFinite(fill[c])) return;
        if (r * fill[c] / fill[b] <= 1 + 1e-9) candidatos.push([{ i: b, n: nb }, { i: c, n: 1 }]);
      });
    });
    if (!candidatos.length) {
      // Ninguna caja alcanza para alguna medida: una bandera por caja en la caja más grande.
      const g = cajas.reduce((a, c, i) => volumetrico(c) > volumetrico(cajas[a]) ? i : a, 0);
      avisos.push('Hay banderas que no caben en ninguna caja: se calculó una por caja en la más grande. Revisa las cajas.');
      candidatos.push([{ i: g, n: piezas.reduce((s, p) => s + p.cantidad, 0) }]);
    }
    let mejor = null;
    for (const c of candidatos) {
      const p = precio(c);
      if (!mejor || p.costo < mejor.costo || (p.costo === mejor.costo && p.nCajas < mejor.nCajas)) mejor = p;
    }
    if (estimada) avisos.push('Capacidad de cajas estimada por m²: confírmala en Configuración → Cajas.');
    return { ...mejor, avisos };
  }

  /* Costo con cajas puestas a mano: { idCaja: cantidad } */
  function precioManual(manual, cajas, opts) {
    const { servicio, destino, secundaria } = opts;
    let costo = 0;
    const det = cajas.filter(c => +manual[c.id] > 0).map(c => {
      const kg = Math.max(volumetrico(c), +c.pesoVacia || 0);
      const v = tarifa(servicio, destino, kg, secundaria);
      costo += (v ?? 0) * +manual[c.id];
      return { id: c.id, nombre: c.nombre, n: +manual[c.id], kg: Math.round(kg * 10) / 10, unitario: v };
    });
    return { cajas: det, costo, avisos: [] };
  }

  return { DESTINOS, destinoDe, tarifa, empacar, precioManual, volumetrico };
})();
