/* MEDLA · Asesoría Fiscal · sub-páginas del embudo (necesita core.js antes)
   /reservar/  → cuenta la visita al calendario (InitiateCheckout).
   /whatsapp/  → cuenta el contacto, muestra el agradecimiento y abre WhatsApp con el
                 mensaje ya escrito (según el tema de la tarjeta que se pulsó).
   /gracias/   → cuenta la reserva (Purchase, 121 €) solo si se llega desde el calendario. */
(() => {
  "use strict";

  const M = window.MEDLA;
  if (!M) return;
  const { track, page, isReturn, $, $$ } = M;
  const q = new URLSearchParams(location.search);
  const cta = q.get("cta") || "directo";

  /* ---------------------------------------------------------------- /reservar/ */
  if (page === "reservar" && !isReturn) track("booking_page", { cta });

  /* ---------------------------------------------------------------- /whatsapp/ */
  if (page === "whatsapp") {
    const BASE = "Hola, quiero información sobre la sesión de asesoría fiscal";
    const TEXTS = {
      info: `${BASE}.`,
      renta: `${BASE} para mi declaración de la Renta.`,
      autonomos: `${BASE} para autónomos.`,
      herencias: `${BASE} por una herencia o donación.`,
      extranjeros: `${BASE} para extranjeros y no residentes.`,
      duda: "Hola, tengo una duda sobre la sesión de asesoría fiscal.",
    };
    const tema = TEXTS[q.get("tema")] ? q.get("tema") : "info";
    const text = TEXTS[tema];
    const wa = `https://wa.me/34914321457?text=${encodeURIComponent(text)}`;
    $$("[data-wa]").forEach((a) => { a.href = wa; });
    const preview = $("[data-wa-text]");
    if (preview) preview.textContent = text;

    const bar = $("[data-go-bar]");
    const label = $("[data-go-txt]");
    const done = () => {
      if (bar) { bar.classList.remove("is-going"); bar.classList.add("is-done"); }
      if (label) label.textContent = "¿No se abrió? Toca «Abrir WhatsApp».";
    };

    if (isReturn) {
      // vuelve con "atrás" desde WhatsApp: ni se cuenta otra vez ni se reabre
      done();
    } else {
      track("whatsapp_lead", { cta, tema });
      const wait = 2400;
      if (bar) {
        bar.style.setProperty("--go", `${wait}ms`);
        requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("is-going")));
      }
      const timer = setTimeout(() => { done(); location.assign(wa); }, wait);
      // si la persona pulsa el botón antes, no se abre dos veces
      $$("[data-wa]").forEach((a) => a.addEventListener("click", () => { clearTimeout(timer); done(); }));
    }
    // restaurada desde la caché de atrás/adelante: estado final, sin temporizador
    window.addEventListener("pageshow", (e) => { if (e.persisted) done(); });
  }

  /* ---------------------------------------------------------------- /gracias/ */
  if (page === "gracias") {
    let fresh = false;
    try {
      const t = Number(sessionStorage.getItem("medla_booking"));
      fresh = !!t && Date.now() - t < 30 * 60 * 1000;
      sessionStorage.removeItem("medla_booking");
    } catch (e) { /* sin almacenamiento */ }
    // solo la llegada desde el calendario cuenta como venta; recargar no la duplica
    if (fresh) track("booking_complete", { cta: "calendario" });
  }
})();
