# Carta digital del restaurante

Página web con la carta del restaurante, publicada gratis con GitHub Pages (siempre en línea).

- **Carta:** `index.html`
- **Código QR para imprimir:** `qr.html` (abre la página y pulsa *Imprimir*)

## Cómo cambiar precios o platos

Todo está en un solo archivo: **`menu.js`**.

1. En GitHub, abre el archivo `menu.js` y pulsa el ícono del lápiz (*Edit this file*).
2. Cambia lo que necesites:
   - **Precio:** cambia el número después de `precio:` (ej. `precio: 25`).
   - **Sin precio:** `precio: null` muestra "Consultar".
   - **Plato agotado:** agrega `agotado: true` al plato.
   - **Nombre del restaurante, WhatsApp, dirección y horario:** al inicio del archivo, en `RESTAURANTE`.
3. Pulsa **Commit changes**. La página se actualiza sola en 1 o 2 minutos.

Cuida las comas y comillas: cada plato va entre `{ }` y termina en `},`.
