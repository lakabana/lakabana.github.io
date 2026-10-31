// Botones de WhatsApp y de redes sociales de un local. Los usan la portada y las cartas.
(function () {
  "use strict";

  const REDES = [
    {
      clave: "facebook",
      nombre: "Facebook",
      icono: '<path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21z"/>',
    },
    {
      clave: "instagram",
      nombre: "Instagram",
      icono: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>',
    },
    {
      clave: "tiktok",
      nombre: "TikTok",
      icono: '<path fill="currentColor" d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v3c-1.4.1-2.7-.3-3.9-1.1v5.7c0 3.6-2.7 6.1-6 6.1-3.2 0-5.8-2.5-5.8-5.7 0-3.6 3.2-6.2 6.9-5.6v3.1c-1.8-.4-3.6.8-3.6 2.6 0 1.4 1.1 2.6 2.6 2.6 1.6 0 2.7-1.2 2.7-3V3z"/>',
    },
  ];

  // Solo enlaces web normales; cualquier otra cosa no se muestra.
  function enlaceSeguro(texto) {
    try {
      const url = new URL(String(texto || "").trim());
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  }

  const ICONO_WHATSAPP =
    '<path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/>';

  // Botón verde de WhatsApp. El chat se abre con el mensaje del editor ya escrito.
  // Devuelve null si el local no tiene número cargado.
  window.pintarWhatsapp = function (local) {
    const numero = String((local && local.whatsapp) || "").replace(/\D/g, "");
    if (!numero) return null;
    const mensaje = String(local.mensajeWhatsapp || "").trim();

    const boton = document.createElement("a");
    boton.className = "whatsapp";
    boton.href = `https://wa.me/${numero}` + (mensaje ? `?text=${encodeURIComponent(mensaje)}` : "");
    boton.target = "_blank";
    boton.rel = "noopener";
    boton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONO_WHATSAPP}</svg>`;
    boton.append("Escríbenos por WhatsApp");
    return boton;
  };

  // Devuelve la fila de botones, o null si el local no tiene redes cargadas.
  window.pintarRedes = function (local) {
    const enlaces = REDES
      .map((red) => ({ red, url: enlaceSeguro(local && local[red.clave]) }))
      .filter((x) => x.url);
    if (!enlaces.length) return null;

    const fila = document.createElement("div");
    fila.className = "redes";
    for (const { red, url } of enlaces) {
      const boton = document.createElement("a");
      boton.className = "red";
      boton.href = url;
      boton.target = "_blank";
      boton.rel = "noopener";
      boton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${red.icono}</svg>`;
      boton.append(red.nombre);
      fila.append(boton);
    }
    return fila;
  };
})();
