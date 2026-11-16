# Cotizador Gary — reglas de negocio

Estas reglas las definió el dueño del taller. Respetarlas siempre; no cambiarlas sin consultar.

## Costos
- **Medida que no está en la tabla de costos:** se toma la medida **más cercana en m²** que sí
  tenga costo (mismo tipo de bandera y misma tela) y se **escala por la proporción de m²**:
  `costo = costo_ref × (m²_nueva / m²_ref)`.
  Ej.: 3,00 × 2,00 = 6 m² cuesta $10.000 → 6,00 × 4,00 = 24 m² → 24/6 = 4 → $40.000.
  Implementado en `estimarPorM2()` (app.js), usado por el cotizador (`costoInfo`) y por la
  tabla de costos por componentes (`costoComponentes`). Nunca dejar un costo en 0 si hay
  una medida de referencia.
- Tabla de costos por componentes: por tipo de bandera; medidas hacia abajo (tarifario 2025:
  23 regulares + 7 monumentales); columnas Tela, Sublimado, Huincha, Argollas, Armado,
  Cortado, Varios. Armado = valores de "Confección" del tarifario de mano de obra 2025.
- **Tela:** 4 columnas (Tela Bistrech, Raso, Microperforado, Oxford), cada una con su precio
  editable arriba (Bistrech $730). Fórmula: `tela = (lado mayor ÷ 1,4) × 1,2 × precio`
  (ej. 1,50 × 1,00 con $730 → $939). El costo total usa la tela elegida (por defecto Bistrech).
- El costo unitario siempre se puede escribir a mano.

## Precios y margen
- El margen es **sobre el precio de venta**: `precio = costo / (1 − margen)`, redondeado hacia arriba.
- Descuento al cliente: % sobre el precio de venta; baja el neto y el margen.
- Márgenes se muestran sin decimales.

## Despacho
- Correos de Chile, Paquete Express, origen Valparaíso/Viña (tarifas exentas de IVA).
- Se calcula para el pedido completo (cajas del taller) y **nunca aparece como ítem** en la
  cotización: se prorratea en los precios y se muestra "Despacho gratis".

## Documentos
- Cotización: texto de descripciones en tipo oración aunque se escriba en mayúsculas; sin
  columna Material; despacho gratis; descuento solo si se aplica.
- OT: sin precios, sin checklist ni firmas; terminación en tipo oración.
- Validez y plazo de entrega en días hábiles (se descuentan feriados).

## Otros
- Medidas siempre con el número mayor primero ("3,00 x 2,00").
- Tela "Bistrech" (no "Poliéster"). Terminación "Huincha" (no "Wincha").
- Todo en español de Chile.
