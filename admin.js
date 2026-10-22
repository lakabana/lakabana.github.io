(function () {
  "use strict";

  // Dónde vive la carta en GitHub.
  const REPO = "lakabana/lakabana.github.io";
  const API = "https://api.github.com";
  const LLAVE_ALMACEN = "carta-editor-clave";
  const LLAVE_CARTA = "carta-editor-actual";

  // Cada carta tiene su carpeta con su propio menu.json.
  const CARTAS = {
    restaurante: { nombre: "Restaurante", archivo: "restaurante/menu.json", pagina: "restaurante/" },
    polleria: { nombre: "Pollería", archivo: "polleria/menu.json", pagina: "polleria/" },
  };

  let clave = leerClaveGuardada();
  let cartaActual = leerAlmacen(LLAVE_CARTA);
  if (!CARTAS[cartaActual]) cartaActual = "restaurante";
  let datos = null;          // { restaurante, secciones } tal como está en menu.json
  let sha = null;            // versión de menu.json que se cargó (GitHub la exige al guardar)
  let hayCambios = false;
  let guardando = false;

  const abiertas = new Set();          // secciones desplegadas en pantalla
  const preciosInvalidos = new Set();  // platos cuyo precio escrito no es un número
  const tarjetas = new Map();          // plato o sección → su elemento, para devolver el foco

  const $ = (selector) => document.querySelector(selector);

  // Crea un elemento con atributos e hijos (texto o nodos) sin usar innerHTML.
  function el(tag, attrs, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [clave, valor] of Object.entries(attrs || {})) {
      if (valor == null || valor === false) continue;
      if (clave === "class") nodo.className = valor;
      else if (clave.startsWith("on")) nodo.addEventListener(clave.slice(2), valor);
      else if (valor === true) nodo.setAttribute(clave, "");
      else nodo.setAttribute(clave, valor);
    }
    for (const hijo of hijos.flat()) {
      if (hijo == null || hijo === false) continue;
      nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
    }
    return nodo;
  }

  // ---------- Clave guardada en este dispositivo ----------

  function leerAlmacen(llave) {
    try { return localStorage.getItem(llave) || ""; } catch { return ""; }
  }

  function escribirAlmacen(llave, valor) {
    try {
      if (valor) localStorage.setItem(llave, valor);
      else localStorage.removeItem(llave);
    } catch { /* sin almacenamiento: el dato dura mientras la página esté abierta */ }
  }

  function leerClaveGuardada() {
    return leerAlmacen(LLAVE_ALMACEN);
  }

  function recordarClave(valor) {
    escribirAlmacen(LLAVE_ALMACEN, valor);
  }

  // ---------- GitHub ----------

  function api(ruta, opciones = {}) {
    return fetch(API + ruta, {
      ...opciones,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${clave}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }

  function aBase64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let binario = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binario);
  }

  function desdeBase64(b64) {
    const binario = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
  }

  async function comprobarClave() {
    const respuesta = await api(`/repos/${REPO}`);
    if (respuesta.status === 401) throw new Error("La clave no es válida. Revisa que la copiaste completa.");
    if (respuesta.status === 404) throw new Error("Esta clave no tiene acceso a la carta de La Kabaña.");
    if (!respuesta.ok) throw new Error(`No se pudo comprobar la clave (error ${respuesta.status}).`);
    const repo = await respuesta.json();
    if (!repo.permissions || !repo.permissions.push) {
      throw new Error("Esta clave puede ver la carta, pero no modificarla.");
    }
  }

  async function leerArchivo() {
    const respuesta = await api(`/repos/${REPO}/contents/${CARTAS[cartaActual].archivo}`);
    if (respuesta.status === 401) {
      const error = new Error("Tu clave ya no es válida. Ingresa una nueva.");
      error.claveInvalida = true;
      throw error;
    }
    if (!respuesta.ok) throw new Error(`No se pudo cargar la carta (error ${respuesta.status}).`);
    const archivo = await respuesta.json();
    return { sha: archivo.sha, datos: JSON.parse(desdeBase64(archivo.content)) };
  }

  // ---------- Preparar los datos para guardar ----------

  function normalizar(texto) {
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function convertirPrecio(texto) {
    const limpio = String(texto).trim().replace(",", ".");
    if (limpio === "") return null;
    if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return undefined;
    return Number(limpio);
  }

  function limpiarWhatsapp(texto) {
    const numeros = String(texto || "").replace(/\D/g, "");
    // Celular peruano sin código de país (9 dígitos): se le agrega el 51.
    return numeros.length === 9 ? `51${numeros}` : numeros;
  }

  function completarIds() {
    const usados = new Set();
    for (const seccion of datos.secciones) {
      let base = seccion.id || normalizar(seccion.titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seccion";
      let id = base;
      for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
      seccion.id = id;
      usados.add(id);
    }
  }

  // Copia ordenada y sin campos vacíos de lo que hay en pantalla.
  function datosParaGuardar() {
    const r = datos.restaurante;
    return {
      restaurante: {
        nombre: r.nombre.trim(),
        eslogan: (r.eslogan || "").trim(),
        moneda: r.moneda || "S/",
        whatsapp: limpiarWhatsapp(r.whatsapp),
        direccion: (r.direccion || "").trim(),
        horario: (r.horario || "").trim(),
      },
      secciones: datos.secciones.map((seccion) => ({
        id: seccion.id,
        titulo: seccion.titulo.trim(),
        platos: seccion.platos.map((plato) => {
          const limpio = { nombre: plato.nombre.trim() };
          if (plato.detalle && plato.detalle.trim()) limpio.detalle = plato.detalle.trim();
          limpio.precio = plato.precio == null ? null : plato.precio;
          if (plato.agotado) limpio.agotado = true;
          return limpio;
        }),
      })),
    };
  }

  // Devuelve un mensaje si algo impide guardar, y lleva al usuario hasta el problema.
  function buscarProblema() {
    if (!datos.restaurante.nombre || !datos.restaurante.nombre.trim()) {
      $(".datos").open = true;
      $("#campo-nombre").focus();
      return "Falta el nombre en «Datos del local».";
    }
    for (const seccion of datos.secciones) {
      if (!seccion.titulo.trim()) {
        abrirYEnfocar(seccion, seccion, ".campo-titulo");
        return "Hay una sección sin nombre.";
      }
      for (const plato of seccion.platos) {
        if (!plato.nombre.trim()) {
          abrirYEnfocar(seccion, plato, ".campo-nombre");
          return `Hay un plato sin nombre en «${seccion.titulo}».`;
        }
        if (preciosInvalidos.has(plato)) {
          abrirYEnfocar(seccion, plato, ".campo-precio");
          return `El precio de «${plato.nombre}» no es válido. Escribe solo el número, por ejemplo 25 o 12.50.`;
        }
      }
    }
    return null;
  }

  function abrirYEnfocar(seccion, objeto, selector) {
    abiertas.add(seccion);
    const caja = tarjetas.get(seccion);
    if (caja) caja.open = true;
    const campo = tarjetas.get(objeto)?.querySelector(selector);
    if (campo) {
      campo.scrollIntoView({ block: "center" });
      campo.focus();
    }
  }

  async function guardar() {
    if (guardando || !hayCambios) return;
    const problema = buscarProblema();
    if (problema) {
      avisar(problema, "error");
      return;
    }

    completarIds();
    const texto = JSON.stringify(datosParaGuardar(), null, 2) + "\n";
    guardando = true;
    ponerEstado("Guardando…", "pendiente");
    $("#guardar").disabled = true;

    try {
      const respuesta = await api(`/repos/${REPO}/contents/${CARTAS[cartaActual].archivo}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `Actualizar carta (${CARTAS[cartaActual].nombre}) desde el editor`,
          content: aBase64(texto),
          sha,
        }),
      });

      if (respuesta.status === 409) {
        guardando = false;
        const sobrescribir = confirm(
          "La carta fue modificada desde otro dispositivo mientras editabas.\n\n" +
          "¿Guardar tus cambios encima? (Lo que se cambió en el otro dispositivo se perderá.)"
        );
        if (!sobrescribir) {
          ponerEstado("Cambios sin guardar", "pendiente");
          $("#guardar").disabled = false;
          return;
        }
        sha = (await leerArchivo()).sha;
        return guardar();
      }
      if (respuesta.status === 401) throw new Error("Tu clave ya no es válida. Sal y vuelve a entrar con una nueva.");
      if (!respuesta.ok) throw new Error(`No se pudo guardar (error ${respuesta.status}). Inténtalo otra vez.`);

      sha = (await respuesta.json()).content.sha;
      hayCambios = false;
      ponerEstado("Guardado ✓ La carta se actualiza en 1–2 minutos", "ok");
      avisar("¡Cambios guardados! La carta pública se actualiza en 1 a 2 minutos.");
    } catch (error) {
      ponerEstado("Cambios sin guardar", "pendiente");
      $("#guardar").disabled = false;
      avisar(error.message === "Failed to fetch" ? "Sin conexión a internet. Inténtalo otra vez." : error.message, "error");
    } finally {
      guardando = false;
    }
  }

  // ---------- Estado y avisos ----------

  function ponerEstado(texto, tipo) {
    const estado = $("#estado");
    estado.textContent = texto;
    estado.dataset.tipo = tipo || "";
  }

  function marcarCambio() {
    hayCambios = true;
    $("#guardar").disabled = false;
    ponerEstado("Cambios sin guardar", "pendiente");
  }

  let temporizadorAviso;
  function avisar(texto, tipo) {
    const aviso = $("#aviso");
    aviso.textContent = texto;
    aviso.dataset.tipo = tipo || "";
    aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, tipo === "error" ? 7000 : 3500);
  }

  // ---------- Datos del restaurante ----------

  function pintarDatosRestaurante() {
    const r = datos.restaurante;
    const campo = (clave, etiqueta, ayuda, extra = {}) => {
      const id = `campo-${clave}`;
      const input = el("input", { id, type: "text", autocomplete: "off", ...extra });
      input.value = r[clave] || "";
      input.addEventListener("input", () => { r[clave] = input.value; marcarCambio(); });
      return el("div", { class: "campo" },
        el("label", { for: id }, etiqueta),
        input,
        ayuda ? el("small", {}, ayuda) : null
      );
    };

    $("#datos-restaurante").replaceChildren(
      campo("nombre", "Nombre (título de la carta)"),
      campo("eslogan", "Frase debajo del nombre"),
      campo("whatsapp", "WhatsApp", "Celular, por ejemplo 992681294. Déjalo vacío para no mostrar el botón.", { inputmode: "tel" }),
      campo("direccion", "Dirección"),
      campo("horario", "Horario", "Por ejemplo: Horario: 9:00 a. m. – 10:00 p. m.")
    );
  }

  // ---------- Secciones y platos ----------

  function pintarSecciones(foco) {
    tarjetas.clear();
    $("#secciones").replaceChildren(...datos.secciones.map(pintarSeccion));

    // Tras subir/bajar, el foco sigue en el mismo botón para poder tocarlo varias veces.
    const destino = foco && tarjetas.get(foco.objeto);
    if (destino) {
      const boton = destino.querySelector(`[data-accion="${foco.accion}"]`);
      if (boton && !boton.disabled) boton.focus({ preventScroll: true });
      (destino.matches("details") ? destino.querySelector("summary") : destino).scrollIntoView({ block: "nearest" });
    }
  }

  function pintarSeccion(seccion, indice, todas) {
    const caja = el("details", { class: "tarjeta seccion" });
    caja.open = abiertas.has(seccion);
    caja.addEventListener("toggle", () => {
      if (caja.open) abiertas.add(seccion); else abiertas.delete(seccion);
    });
    tarjetas.set(seccion, caja);

    const nombreVisible = el("span", { class: "seccion-nombre" }, seccion.titulo || "Sección sin nombre");
    const contador = el("span", { class: "contador" }, String(seccion.platos.length));

    const titulo = el("input", { type: "text", class: "campo-titulo", "aria-label": "Nombre de la sección", placeholder: "Nombre de la sección" });
    titulo.value = seccion.titulo;
    titulo.addEventListener("input", () => {
      seccion.titulo = titulo.value;
      nombreVisible.textContent = titulo.value || "Sección sin nombre";
      marcarCambio();
    });

    const acciones = el("div", { class: "acciones" },
      el("button", {
        type: "button", class: "boton-icono", "data-accion": "subir-seccion", "aria-label": "Subir sección",
        title: "Subir sección", disabled: indice === 0,
        onclick: () => moverEnLista(todas, indice, -1, { objeto: seccion, accion: "subir-seccion" }),
      }, "↑"),
      el("button", {
        type: "button", class: "boton-icono", "data-accion": "bajar-seccion", "aria-label": "Bajar sección",
        title: "Bajar sección", disabled: indice === todas.length - 1,
        onclick: () => moverEnLista(todas, indice, 1, { objeto: seccion, accion: "bajar-seccion" }),
      }, "↓"),
      el("button", {
        type: "button", class: "boton-texto peligro",
        onclick: () => eliminarSeccion(seccion),
      }, "Eliminar sección")
    );

    const lista = el("ol", { class: "platos" }, seccion.platos.map((plato, j) => pintarPlato(plato, j, seccion)));

    const agregar = el("button", {
      type: "button", class: "boton boton-linea boton-ancho",
      onclick: () => agregarPlato(seccion),
    }, "+ Agregar plato");

    caja.append(
      el("summary", {}, nombreVisible, contador),
      el("div", { class: "seccion-cuerpo" },
        el("div", { class: "seccion-cabecera" }, titulo, acciones),
        seccion.platos.length ? lista : el("p", { class: "vacio" }, "Esta sección no tiene platos. No se mostrará en la carta."),
        agregar
      )
    );
    return caja;
  }

  function pintarPlato(plato, indice, seccion) {
    const tarjeta = el("li", { class: plato.agotado ? "plato agotado" : "plato" });
    tarjetas.set(plato, tarjeta);

    const nombre = el("input", { type: "text", class: "campo-nombre", placeholder: "Nombre del plato", "aria-label": "Nombre del plato" });
    nombre.value = plato.nombre;
    nombre.addEventListener("input", () => { plato.nombre = nombre.value; marcarCambio(); });

    const precio = el("input", {
      type: "text", class: "campo-precio", inputmode: "decimal", placeholder: "Consultar",
      "aria-label": `Precio de ${plato.nombre || "este plato"}`,
    });
    precio.value = plato.precio == null ? "" : Number(plato.precio).toFixed(2);
    precio.addEventListener("input", () => {
      const valor = convertirPrecio(precio.value);
      const invalido = valor === undefined;
      precio.classList.toggle("invalido", invalido);
      if (invalido) preciosInvalidos.add(plato);
      else {
        preciosInvalidos.delete(plato);
        plato.precio = valor;
      }
      marcarCambio();
    });

    const detalle = el("textarea", { class: "campo-detalle", rows: "2", placeholder: "Descripción (opcional)", "aria-label": "Descripción" });
    detalle.value = plato.detalle || "";
    detalle.addEventListener("input", () => { plato.detalle = detalle.value; marcarCambio(); });

    const selector = el("select", { "aria-label": "Mover a otra sección" },
      datos.secciones.map((s, i) => {
        const opcion = el("option", { value: String(i) }, s.titulo || "Sección sin nombre");
        opcion.selected = s === seccion;
        return opcion;
      })
    );
    selector.addEventListener("change", () => moverASeccion(plato, seccion, datos.secciones[Number(selector.value)]));

    const agotado = el("input", { type: "checkbox" });
    agotado.checked = !!plato.agotado;
    agotado.addEventListener("change", () => {
      plato.agotado = agotado.checked;
      tarjeta.classList.toggle("agotado", agotado.checked);
      marcarCambio();
    });

    tarjeta.append(
      el("div", { class: "fila" },
        nombre,
        el("label", { class: "precio" }, el("span", { "aria-hidden": "true" }, datos.restaurante.moneda || "S/"), precio)
      ),
      detalle,
      el("div", { class: "fila acciones-plato" },
        el("label", { class: "mover" }, el("span", {}, "Sección"), selector),
        el("label", { class: "check" }, agotado, el("span", {}, "Agotado")),
        el("div", { class: "acciones" },
          el("button", {
            type: "button", class: "boton-icono", "data-accion": "subir", "aria-label": "Subir plato", title: "Subir",
            disabled: indice === 0,
            onclick: () => moverEnLista(seccion.platos, indice, -1, { objeto: plato, accion: "subir" }),
          }, "↑"),
          el("button", {
            type: "button", class: "boton-icono", "data-accion": "bajar", "aria-label": "Bajar plato", title: "Bajar",
            disabled: indice === seccion.platos.length - 1,
            onclick: () => moverEnLista(seccion.platos, indice, 1, { objeto: plato, accion: "bajar" }),
          }, "↓"),
          el("button", {
            type: "button", class: "boton-icono peligro", "aria-label": "Eliminar plato", title: "Eliminar",
            onclick: () => eliminarPlato(plato, seccion),
          }, "✕")
        )
      )
    );
    return tarjeta;
  }

  function moverEnLista(lista, indice, paso, foco) {
    const otro = indice + paso;
    if (otro < 0 || otro >= lista.length) return;
    [lista[indice], lista[otro]] = [lista[otro], lista[indice]];
    marcarCambio();
    pintarSecciones(foco);
  }

  function moverASeccion(plato, origen, destino) {
    if (!destino || destino === origen) return;
    origen.platos.splice(origen.platos.indexOf(plato), 1);
    destino.platos.push(plato);
    marcarCambio();
    pintarSecciones();
    avisar(`«${plato.nombre || "Plato"}» se movió al final de ${destino.titulo}.`);
  }

  function agregarPlato(seccion) {
    const plato = { nombre: "", detalle: "", precio: null };
    seccion.platos.push(plato);
    abiertas.add(seccion);
    marcarCambio();
    pintarSecciones();
    const campo = tarjetas.get(plato).querySelector(".campo-nombre");
    campo.scrollIntoView({ block: "center" });
    campo.focus();
  }

  function eliminarPlato(plato, seccion) {
    if (!confirm(`¿Eliminar «${plato.nombre || "este plato"}» de la carta?`)) return;
    seccion.platos.splice(seccion.platos.indexOf(plato), 1);
    preciosInvalidos.delete(plato);
    marcarCambio();
    pintarSecciones();
  }

  function agregarSeccion() {
    const seccion = { id: "", titulo: "", platos: [] };
    datos.secciones.push(seccion);
    abiertas.add(seccion);
    marcarCambio();
    pintarSecciones();
    const campo = tarjetas.get(seccion).querySelector(".campo-titulo");
    campo.scrollIntoView({ block: "center" });
    campo.focus();
  }

  function eliminarSeccion(seccion) {
    if (seccion.platos.length) {
      avisar("Primero mueve o elimina los platos de esta sección.", "error");
      return;
    }
    if (!confirm(`¿Eliminar la sección «${seccion.titulo || "sin nombre"}»?`)) return;
    datos.secciones.splice(datos.secciones.indexOf(seccion), 1);
    abiertas.delete(seccion);
    marcarCambio();
    pintarSecciones();
  }

  // ---------- Pantallas ----------

  function mostrar(pantalla) {
    $("#cargando").hidden = pantalla !== "cargando";
    $("#acceso").hidden = pantalla !== "acceso";
    $("#editor").hidden = pantalla !== "editor";
    $("#salir").hidden = pantalla !== "editor";
  }

  function mostrarAcceso(mensaje) {
    mostrar("acceso");
    const error = $("#error-acceso");
    error.textContent = mensaje || "";
    error.hidden = !mensaje;
  }

  function marcarCartaActual() {
    for (const pestana of document.querySelectorAll(".pestana")) {
      pestana.setAttribute("aria-pressed", String(pestana.dataset.carta === cartaActual));
    }
    $("#ver-carta").href = CARTAS[cartaActual].pagina;
  }

  async function cambiarCarta(nueva) {
    if (nueva === cartaActual || guardando) return;
    if (hayCambios && !confirm(`Tienes cambios sin guardar en ${CARTAS[cartaActual].nombre}. ¿Cambiar de carta y perderlos?`)) return;
    const anterior = cartaActual;
    cartaActual = nueva;
    escribirAlmacen(LLAVE_CARTA, nueva);
    mostrar("cargando");
    try {
      await abrirEditor();
    } catch (error) {
      cartaActual = anterior;
      escribirAlmacen(LLAVE_CARTA, anterior);
      if (error.claveInvalida) {
        salir(error.message);
        return;
      }
      mostrar("editor");
      marcarCartaActual();
      avisar(error.message === "Failed to fetch" ? "Sin conexión a internet. Inténtalo otra vez." : error.message, "error");
    }
  }

  async function abrirEditor() {
    const archivo = await leerArchivo();
    sha = archivo.sha;
    datos = archivo.datos;
    datos.restaurante = datos.restaurante || {};
    datos.secciones = (datos.secciones || []).map((s) => ({ ...s, platos: s.platos || [] }));
    hayCambios = false;
    abiertas.clear();
    preciosInvalidos.clear();
    pintarDatosRestaurante();
    pintarSecciones();
    ponerEstado("Sin cambios");
    $("#guardar").disabled = true;
    marcarCartaActual();
    mostrar("editor");
  }

  function salir(mensaje) {
    clave = "";
    recordarClave("");
    hayCambios = false;
    $("#clave").value = "";
    mostrarAcceso(mensaje);
  }

  $("#form-acceso").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("#entrar");
    boton.disabled = true;
    boton.textContent = "Comprobando…";
    clave = $("#clave").value.trim();
    try {
      await comprobarClave();
      recordarClave(clave);
      await abrirEditor();
    } catch (error) {
      clave = "";
      mostrarAcceso(error.message === "Failed to fetch" ? "Sin conexión a internet. Inténtalo otra vez." : error.message);
    } finally {
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });

  $("#salir").addEventListener("click", () => {
    if (hayCambios && !confirm("Tienes cambios sin guardar. ¿Salir de todos modos?")) return;
    salir();
  });

  for (const pestana of document.querySelectorAll(".pestana")) {
    pestana.addEventListener("click", () => cambiarCarta(pestana.dataset.carta));
  }

  $("#guardar").addEventListener("click", guardar);
  $("#agregar-seccion").addEventListener("click", agregarSeccion);

  window.addEventListener("beforeunload", (evento) => {
    if (!hayCambios) return;
    evento.preventDefault();
    evento.returnValue = "";
  });

  (async function iniciar() {
    if (!clave) {
      mostrarAcceso();
      return;
    }
    mostrar("cargando");
    try {
      await abrirEditor();
    } catch (error) {
      if (error.claveInvalida) salir(error.message);
      else mostrarAcceso(error.message === "Failed to fetch" ? "Sin conexión a internet. Recarga la página." : error.message);
    }
  })();
})();
