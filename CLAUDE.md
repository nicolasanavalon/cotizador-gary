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
  Total A + B (el margen se elige en la tarjeta del producto). El margen es **sobre la venta**, igual que
  en Matriz (decisión del dueño: no se usa recargo sobre costo; 7.895 con 50 % → 15.790). Sin costo hasta que se costea.
- **Las fórmulas del Tradicional usan la medida del producto** (tela `=(largo*alto)/1,4*1,2`, vaina,
  argollas). Si el producto no tiene medida, se toma la escrita en el nombre/descripción ("1,50 x 1,00",
  "150x100 cm"); si no hay, el cuadro pide la medida (campo "Medida" arriba) y al aplicar pasa al producto.
  Al cambiar la medida del producto, el costeo se recalcula solo (lo editado a mano se respeta).
- **A mano:** tercer método (botón "A mano"): el costo unitario se escribe directo, sin desglose (productos
  comprados terminados, banderas importadas). Si el producto no es "Bandera" y no se ha costeado, pasa a "A mano".
- **Por defecto los productos nuevos usan el método Tradicional** (es el que usa el papá).
- La tarjeta del producto muestra costo unit., precio unit. neto, **margen unit.**, total neto, costo total y margen.

## Imágenes
- Biblioteca en la nube (Config `bibPartes`/`bib0..n`, en trozos por el límite de 50.000 caracteres
  por celda; miniaturas e imágenes en la hoja Imagenes). Galería: **Sugeridas** (por nombre del
  producto y por **cliente**; palabras genéricas como "Municipalidad" no cuentan), **De uso frecuente**
  (2+ usos) y **De uso poco frecuente**. Aprende de cada uso (nombre, cliente, cantidad de usos).
  Se importaron las fotos del panel de producción (taller-gary) con su producto, cliente, OT y usos.
  **Sin imágenes repetidas:** cada imagen tiene una firma visual (`firmaImagen`); si se sube una que ya
  está, se usa la existente. Las repetidas se fusionan en una sola entrada (nombres, clientes y usos
  sumados; ids antiguos en `a`). Imágenes casi iguales con otro nombre (ej. "Puerto Talca"/"Puerto
  Tepual") no se fusionan.
  **Revisión diaria del panel:** una tarea programada corre todos los días
  `herramientas/sincronizar_imagenes.py URL_PANEL` y sube las fotos nuevas del panel de producción
  (cada fila se revisa una vez; Config `panelVistos`). Si la foto ya existe, solo suma uso/nombre/cliente/OT. La cotización y la OT dicen que las imágenes son referenciales.

## Precios y margen
- El margen es **sobre el precio de venta**: `precio = costo / (1 − margen)`, redondeado hacia arriba.
- Descuento al cliente: % sobre el precio de venta; baja el neto y el margen.
- Márgenes se muestran sin decimales.

## Despacho
- Correos de Chile, Paquete Express, origen Valparaíso/Viña (tarifas exentas de IVA).
- Se calcula para el pedido completo (cajas del taller) y **nunca aparece como ítem** en la
  cotización: se prorratea en los precios y se muestra "Despacho gratis".
- Detalle por caja (corto): medidas de la caja, qué banderas lleva ("10 de 1,50×1,00 (caben 19)"), cuánto
  ocupa (%) y kg cobrado (el mayor entre peso real y volumen L×A×H÷4.000). Caben = m² que admite la caja
  (capM2) ÷ m² de la bandera, salvo que se indique la capacidad exacta en Configuración → Cajas.

## Documentos
- Cotización: texto de descripciones en tipo oración aunque se escriba en mayúsculas; sin
  columna Material; despacho gratis; descuento solo si se aplica.
- Cotización: plazo de entrega y validez muestran **solo "N días hábiles"** (la fecha calculada se ve en
  el editor). Nota de imágenes: solo "Imágenes referenciales."
- **Vista previa** ("Así la ve el cliente"): se abre **limpia**; con el botón **✎ Editar** (junto a Cerrar) se pincha y edita datos del cliente (nombre, ID,
  RUT, atención, teléfono, email, dirección, comuna), garantía, nombre y descripción de cada producto y
  la nota destacada al pie; se guarda en la cotización y en el formulario. **✓ Listo** vuelve a la vista limpia. El PDF sale sin marcas de edición.
- **"Guardar y generar PDF" descarga el archivo PDF** (no abre imprimir); igual para la OT. Se genera con
  html2pdf.js en el navegador; si no carga la librería, se abre imprimir como respaldo.
- **"Costos en Excel"** (junto a Ver cotización): descarga el cuadro de costos con **una columna por producto**
  (Cant. / Costo / Total), filas por componente, Subtotal A, flete/financiero/imprevisto, Subtotal B, costo
  unitario, margen, precio, cantidad y totales, con fórmulas de Excel (como el Excel del papá).
- OT: sin precios, sin checklist ni firmas; terminación en tipo oración.
- Validez y plazo de entrega en días hábiles (se descuentan feriados).

## Flujo, facturación y panel (panel.js)
- Estados de la cotización: **Borrador** (al guardar) → **Enviada** (botón "Enviada", fecha de envío) →
  **Aprobada** (pide N° OC del cliente y fecha; crea la OT) o **Rechazada** (solo confirma). **Sin estado "Vencida"
  y sin motivos de rechazo** (el dueño no los quiere: los clientes en general no responden). Las antiguas
  "Pendiente" se muestran como Enviada. Tasa de aprobación = aprobadas ÷ enviadas al cliente.
- Tabla de OT: OT, ID, fecha, entrega, cliente, productos, **neto y margen $** (de la cotización), estado.
- OT: Pendiente → En producción → Terminada → Despachada → Entregada (se guardan las fechas). Atrasada = pasó la
  fecha de entrega y no está terminada.
- **Facturación**: ventas aprobadas → "Emitir factura" (N° a mano, fecha, días de crédito según condición de pago,
  monto neto editable para anticipos) → "Registrar pago". Estados: Por facturar, Por cobrar, Vencida, Pagada.
  Se guarda en `cot.factura`. Integración con SII pendiente.
- **La aplicación abre en el Panel.** Menú: Panel · Cotizar · Cotizaciones · Órdenes de trabajo · Producción ·
  Facturación; Matriz de costos y Configuración van dentro de **⚙ Ajustes** (arriba a la derecha).
- **Panel** (KPI, interactivo tipo Power BI): cotizado, vendido, tasa de aprobación, margen de lo vendido, venta
  promedio y **por cobrar** (sin "días para aprobar", "en carpeta", embudo ni cuadro de producción: el dueño no los quiere).
  Gráficos: cotizado/aprobado por mes, estado de las cotizaciones + motivos de rechazo, mejores clientes, **ventas por
  tipo de producto** (según el tipo elegido en las listas, no el nombre escrito), requiere atención, ventas por región.
  **Todo se puede pinchar**: lleva a Cotizaciones (o Facturación/OT) con el filtro aplicado ("Filtro del panel ✕").
  Ese filtro es solo de esa vista: **al entrar por el menú la lista parte sin filtros**.
- **Producción** (solo lectura): lee el panel de producción del taller (taller-gary, misma URL que usa la revisión
  diaria de imágenes) y muestra las OT en curso, atrasadas, próximas 7 días y entregadas, con foto, etapa y compromiso.
  No escribe nada; los cambios se hacen en el panel de producción.
- **Facturación**: se puede **adjuntar el archivo de la factura** y el **comprobante de pago** (PDF o foto, máx. 4 MB;
  se guardan en la hoja Imagenes como `fac…`/`pag…`; `cot.factura.archivo` / `cot.factura.comprobante`).
- Cotizaciones: sin columna "Siguiente paso"; Enviada / Aprobar / Rechazar van junto a Abrir, PDF, Duplicar, Borrar.
- **Datos de ejemplo**: cotizaciones E1–E11 y OT 543–548 marcadas `demo: true`, sin usar la numeración real.
  Se borran en Configuración → "Borrar datos de ejemplo".

## Otros
- Medidas siempre con el número mayor primero ("3,00 x 2,00").
- Tela "Bistrech" (no "Poliéster"). Terminación "Huincha" (no "Wincha").
- Todo en español de Chile.
