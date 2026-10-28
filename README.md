# Cartas digitales de La Kabaña

Publicadas gratis con GitHub Pages (siempre en línea).

- **Portada (a donde lleva el QR):** https://lakabana.github.io/
  - **La Kabaña Restaurante:** https://lakabana.github.io/restaurante/
  - **La Kabaña Pollería:** https://lakabana.github.io/polleria/
- **Editor de las cartas:** https://lakabana.github.io/admin.html
- **Código QR para imprimir:** https://lakabana.github.io/qr.html

## Cómo cambiar las cartas

Entra al **editor** y elige arriba **Restaurante** o **Pollería**. Desde ahí puedes:

- cambiar precios, nombres y descripciones;
- agregar o eliminar platos;
- mover un plato a otra sección (menú **Sección**) o cambiar su orden (↑ ↓);
- marcar un plato como **Agotado**;
- agregar, renombrar u ordenar secciones;
- cambiar el nombre, WhatsApp, dirección, horario y redes sociales (Facebook, Instagram, TikTok) de cada local. Las redes del Restaurante también salen en la portada.

Al terminar, pulsa **Guardar cambios**. La carta pública se actualiza en 1 o 2 minutos.

La primera vez, el editor pide una **clave de GitHub**. Abajo del botón *Entrar* explica cómo crearla. Queda guardada solo en ese dispositivo.

## Archivos

- `index.html`: la portada para elegir restaurante o pollería.
- `restaurante/` y `polleria/`: cada carta, con su `menu.json` (lo escribe el editor).
- `app.js`, `redes.js`, `styles.css`: compartidos por las cartas y la portada.
- `admin.html`, `admin.js`, `admin.css`: el editor.
- `qr.html`: la tarjeta con el código QR.
