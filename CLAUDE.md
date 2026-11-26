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
- **Sublimado:** `sublimado = (lado mayor ÷ 1,4 × 1,2) × 2 × precio sublimado` (precio editable,
  $2.800; ej. 1,50 × 1,00 → $7.200). Se puede desmarcar por tipo de bandera ("no lleva").
- **Huincha:** `huincha = (lado menor + 0,10 m) × precio por metro` (precio editable, $350;
  ej. 1,50 × 1,00 → 1,10 × 350 = $385).
- **Argollas:** `argollas = cantidad × precio por argolla` (precio editable). Cantidad según la
  Tabla Confección del taller (ARGOLLAS_DEF en app.js); si la medida no está, se **interpola**
  entre la medida de abajo y la de arriba según m² (`interpolarPorM2`), **redondeada al entero**.
- **Argollas:** precio por argolla $200.
- **Cortado:** según tarifado de corte (CORTADO_DEF en app.js, valores revisados); si la medida
  no está, se **interpola** entre la de abajo y la de arriba según m² (decisión del dueño, para que
  nunca baje al crecer la bandera). Fuera del rango del cuadro se usa la proporción de m².
- Sin tabla de "valores de referencia" (hora calandra, etc.): el dueño no la quiere.
- **El cotizador toma el costo de la tabla de costos por componentes** (tipo de bandera + tela +
  medida) con `desgloseMatriz()`: tela/sublimado/huincha por fórmula (cualquier medida), argollas y
  cortado por cuadro con interpolación, armado y varios de la tabla (regla de m² si la medida no está).
  La matriz anterior ya no se usa.
- Al pinchar el costo unitario se abre el **desglose** editable (cada componente o el total; si se
  edita el total, la diferencia queda como "Ajuste manual"). "Volver a la matriz" deshace los cambios.
- El costo unitario siempre se puede escribir a mano.

## Método por producto
- **Matriz:** costo desde la tabla de costos por componentes; margen sobre el precio de venta.
- **Tradicional:** réplica del Excel "COSTO BISTRECH" del taller (cuadro al pinchar el costo):
  tela = (largo × alto) ÷ 1,4 × 1,2 × precio tela; crea = tela/12 (1 faz); extra tela = tela (2/Faz);
  vaina, argollas, armado (×1), cortado/festón/limpieza/embolsado = % del armado; sublimado =
  extra tela × 2 × precio; Subtotal A; flete 20 % + costo financiero 7 % + imprevisto 7 % = Subtotal B;
  costo = A + B. La columna Cantidad acepta **fórmulas tipo Excel** (`=(1,5*1)/1,4*1,2`, `=tela/12`,
  `=extra*2`): al pinchar se ve la fórmula, al salir el resultado. El cuadro llega solo hasta el
  Total A + B (el margen se elige en la tarjeta del producto). **"Margen" del Excel = recargo sobre el costo** (precio = costo × (1 + %)); se muestra
  además el margen real sobre venta. Sin costo hasta que se costea.

## Imágenes
- Biblioteca en la nube (Config `biblioteca` + miniaturas en la hoja Imagenes): al agregar imagen se
  abre una galería con sugeridas por nombre del producto, las de uso frecuente y el resto; aprende
  de cada uso. La cotización y la OT dicen que las imágenes son referenciales.

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
