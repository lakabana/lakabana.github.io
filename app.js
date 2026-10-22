(function () {
  "use strict";

  // Se llenan desde el menu.json de la carpeta de cada carta (lo edita admin.html).
  let restaurante = {};
  let secciones = [];

  // Crea un elemento con atributos e hijos (texto o nodos) sin usar innerHTML.
  function el(tag, attrs, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [clave, valor] of Object.entries(attrs || {})) {
      if (valor == null || valor === false) continue;
      if (clave === "class") nodo.className = valor;
      else nodo.setAttribute(clave, valor);
    }
    for (const hijo of hijos.flat()) {
      if (hijo == null || hijo === false) continue;
      nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
    }
    return nodo;
  }

  const normalizar = (texto) =>
    String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const formatoPrecio = (precio) =>
    `${restaurante.moneda || "S/"} ${Number(precio).toFixed(2)}`;

  // ---------- Cabecera y pie ----------

  function pintarCabecera() {
    document.getElementById("nombre").textContent = restaurante.nombre;
    const eslogan = document.getElementById("eslogan");
    eslogan.textContent = restaurante.eslogan || "";
    eslogan.hidden = !restaurante.eslogan;
  }

  function pintarPie() {
    const pie = document.getElementById("pie");
    const extras = [];
    if (restaurante.direccion) extras.push(el("p", { class: "pie-info" }, restaurante.direccion));
    if (restaurante.horario) extras.push(el("p", { class: "pie-info" }, restaurante.horario));
    if (restaurante.whatsapp) {
      const icono = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icono.setAttribute("viewBox", "0 0 24 24");
      icono.setAttribute("aria-hidden", "true");
      icono.innerHTML =
        '<path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/>';
      extras.push(
        el("a", { class: "whatsapp", href: `https://wa.me/${restaurante.whatsapp}`, target: "_blank", rel: "noopener" },
          icono, "Escríbenos por WhatsApp")
      );
    }
    pie.prepend(...extras);
  }

  // ---------- Carta ----------

  function pintarPlato(plato) {
    const tienePrecio = plato.precio != null && plato.precio !== "";
    const marcador = plato.agotado
      ? el("span", { class: "etiqueta-agotado" }, "Agotado")
      : el("span", { class: tienePrecio ? "precio" : "precio consultar" },
          tienePrecio ? formatoPrecio(plato.precio) : "Consultar");

    const li = el("li", { class: plato.agotado ? "plato agotado" : "plato" },
      el("div", { class: "plato-fila" },
        el("h3", { class: "plato-nombre" }, plato.nombre),
        el("span", { class: "puntos", "aria-hidden": "true" }),
        marcador
      ),
      plato.detalle ? el("p", { class: "plato-detalle" }, plato.detalle) : null
    );
    li.dataset.busqueda = normalizar(`${plato.nombre} ${plato.detalle || ""}`);
    return li;
  }

  function pintarCarta() {
    const carta = document.getElementById("carta");
    const nav = document.getElementById("categorias");

    for (const categoria of secciones) {
      if (!categoria.platos || !categoria.platos.length) continue;
      const lista = el("ul", { class: categoria.platos.length >= 6 ? "platos dos-columnas" : "platos" },
        categoria.platos.map(pintarPlato));

      carta.append(
        el("section", { class: "seccion", id: categoria.id, "aria-labelledby": `t-${categoria.id}` },
          el("h2", { class: "titulo-dorado", id: `t-${categoria.id}` }, categoria.titulo),
          lista
        )
      );
      nav.append(el("a", { class: "chip", href: `#${categoria.id}`, "data-id": categoria.id }, categoria.titulo));
    }
  }

  // ---------- Búsqueda ----------

  function activarBusqueda() {
    const input = document.getElementById("buscar");
    const mensaje = document.getElementById("sin-resultados");

    input.addEventListener("input", () => {
      const consulta = normalizar(input.value.trim());
      let total = 0;

      for (const seccion of document.querySelectorAll(".seccion")) {
        let visibles = 0;
        for (const plato of seccion.querySelectorAll(".plato")) {
          const coincide = !consulta || plato.dataset.busqueda.includes(consulta);
          plato.hidden = !coincide;
          if (coincide) visibles++;
        }
        seccion.hidden = visibles === 0;
        document.querySelector(`.chip[data-id="${seccion.id}"]`).hidden = visibles === 0;
        total += visibles;
      }
      mensaje.hidden = total > 0;
    });

    // El navegador puede restaurar el texto al volver a la página.
    if (input.value) input.dispatchEvent(new Event("input"));
  }

  // ---------- Categoría activa en la barra ----------

  function marcarCategoriaActiva() {
    const nav = document.getElementById("categorias");
    const chips = new Map([...nav.querySelectorAll(".chip")].map((c) => [c.dataset.id, c]));
    let actual = null;

    function activar(id) {
      const chip = chips.get(id);
      if (!chip || chip === actual) return;
      actual?.classList.remove("activo");
      chip.classList.add("activo");
      actual = chip;
      nav.scrollTo({ left: chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
    }

    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) activar(entrada.target.id);
      }
    }, { rootMargin: "-30% 0px -65% 0px" });

    document.querySelectorAll(".seccion").forEach((s) => observador.observe(s));

    // Al llegar al final, la última categoría puede no cruzar la franja observada.
    window.addEventListener("scroll", () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      const visibles = [...document.querySelectorAll(".seccion:not([hidden])")];
      if (visibles.length) activar(visibles[visibles.length - 1].id);
    }, { passive: true });
  }

  async function iniciar() {
    try {
      // no-cache: el navegador siempre pregunta si hay una versión nueva de la carta.
      const respuesta = await fetch("menu.json", { cache: "no-cache" });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = await respuesta.json();
      restaurante = datos.restaurante || {};
      secciones = datos.secciones || [];
    } catch (error) {
      console.error("No se pudo cargar menu.json", error);
      const aviso = document.getElementById("sin-resultados");
      aviso.textContent = "No se pudo cargar la carta. Revisa tu conexión y vuelve a cargar la página.";
      aviso.hidden = false;
      return;
    }

    pintarCabecera();
    pintarPie();

    if (!secciones.some((s) => s.platos && s.platos.length)) {
      document.getElementById("categorias").hidden = true;
      document.querySelector(".buscador").hidden = true;
      const aviso = document.getElementById("sin-resultados");
      aviso.textContent = "Estamos preparando esta carta. ¡Vuelve pronto!";
      aviso.hidden = false;
      return;
    }

    pintarCarta();
    activarBusqueda();
    marcarCategoriaActiva();
  }

  iniciar();
})();
