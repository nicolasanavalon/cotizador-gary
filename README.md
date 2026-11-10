# Cotizador Gary

Cotizador de banderas del Taller Gary.

- Seleccionar banderas desde la matriz de costos (tipo × material × medida).
- Definir margen por producto (20 / 30 / 40 / 50 % o manual), margen sobre precio de venta.
- Ver costo, margen, neto, IVA y bruto por producto y total, incluyendo despacho Correos de Chile.
- Generar la cotización en PDF con correlativo.
- Al aprobarla, generar automáticamente la Orden de Trabajo interna.

> En construcción.

## Uso

Abrir `index.html` (publicado en GitHub Pages). Pestañas:

- **Cotizar**: cliente, productos (tipo → material → medida → costo desde la matriz), margen por producto
  (20/30/40/50 % o manual; margen sobre precio de venta), despacho, y resumen con neto, IVA, bruto, costo y margen.
- **Cotizaciones**: correlativo, PDF, aprobar (crea la OT automáticamente), rechazar, duplicar.
- **Órdenes de trabajo**: OTs generadas, estado e impresión (sin precios).
- **Matriz de costos**: editable o pegando 4 columnas desde Excel (Tipo, Material, Medida, Costo neto).
- **Configuración**: datos de la empresa, valores por defecto, redondeo y correlativos.

## Nube (datos compartidos)

Los datos viven en una **Google Sheet** ("Cotizador Gary – datos") con pestañas
`Cotizaciones`, `OT`, `Matriz` y `Config`. La app habla con ella a través de un
Apps Script publicado como aplicación web (`servidor/Codigo.gs`).

- Los números correlativos de cotización y OT los asigna el servidor (no se repiten aunque
  dos personas guarden a la vez).
- La pestaña `Matriz` se puede editar directo en la planilla.
- La URL del script va en `NUBE_URL` (app.js). Si está vacía, la app funciona solo en el navegador.

Instalación (una vez): crear la planilla → Extensiones → Apps Script → pegar el código → Implementar → Nueva implementación → Aplicación web (Ejecutar como: yo; Acceso:
cualquier persona) → copiar la URL a `NUBE_URL`.
