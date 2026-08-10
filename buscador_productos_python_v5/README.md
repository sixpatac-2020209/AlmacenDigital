V5
- Prioriza Pacifiko.com y luego fabricante/sitio oficial.
- Genera texto propio de catálogo a partir de datos objetivos encontrados, sin copiar párrafos largos.
- Estructura: nombre, descripción, características, especificaciones, fuente e imágenes.
- Descarga hasta 5 imágenes por producto con más consultas de respaldo.
- Baja el mínimo a 180x180 y hace menos agresivo el filtro de duplicados.
- Genera productos_sin_5_imagenes.csv.
- Crea ficha.html en cada carpeta de producto.

Nuevo flujo recomendado (sin cuota de Firebase Storage)
- El CSV de salida ahora incluye la columna `imagenes_urls` con hasta 5 URLs por producto.
- En AlmacenDigital, importa ese CSV directamente.
- El importador toma `imagenes_urls` y guarda esas URLs en Firestore sin subir archivos a Firebase Storage.
- Resultado: proceso rapido, simple y sin consumir cuota del bucket de Firebase Storage.

Comportamiento actual del script
- Por defecto `DESCARGAR_IMAGENES=False` en `main.py`.
- Esto significa que el script NO descarga archivos de imagen; solo recopila URLs (`imagenes_urls`).
- Si en algun momento quieres volver a descargar imagenes locales, cambia `DESCARGAR_IMAGENES=True`.

Rendimiento (para que corra mas rapido)
- `MODO_RAPIDO=True` (recomendado): reduce consultas y tiempo de espera para acelerar el proceso.
- `USAR_BUSQUEDA_IMAGENES=False` (recomendado): evita consultas extra de imagen y usa primero URLs detectadas en la pagina fuente.
- `SOLO_PACIFIKO=True` (recomendado): fuerza resultados solo de `pacifiko.com` para mantener consistencia y velocidad.
- Si quieres mas cobertura (a costa de tiempo), usa:
	- `MODO_RAPIDO=False`
	- `USAR_BUSQUEDA_IMAGENES=True`
