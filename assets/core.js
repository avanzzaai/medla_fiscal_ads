/* MEDLA · Asesoría Fiscal · núcleo compartido
   Lo cargan la landing y sus sub-páginas (/reservar/, /whatsapp/, /gracias/):
   medición, próximo plazo fiscal, enlaces del embudo que conservan UTM y click-ids,
   calendario de reserva y salto a /gracias/ cuando el calendario confirma la reserva.
   Sin API de HighLevel: solo se escucha el aviso público ("msgsndr-booking-complete")
   que el widget del calendario envía a la página que lo incrusta. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const ROOT = document.body.dataset.root || "";
  const PAGE = document.body.dataset.page || "landing";
  const PRODUCT = "Asesoría Fiscal";

  /* ---------------------------------------------------------------- medición
     dataLayer para GTM/GA4 y, si existe, el píxel de Meta. Cada sub-página es una URL
     propia, así que también se puede medir solo con reglas de "URL contiene". */
  const FB = {
    tel_click: ["track", "Contact"],
    whatsapp_lead: ["track", "Contact"],
    booking_page: ["track", "InitiateCheckout", { value: 121, currency: "EUR" }],
    booking_complete: ["track", "Purchase", { value: 121, currency: "EUR" }],
    cta_click: ["trackCustom", "CTAClick"],
  };
  const track = (event, data = {}) => {
    const payload = { event, page: `lp-asesoria-fiscal/${PAGE}`, ...data };
    try { (window.dataLayer = window.dataLayer || []).push(payload); } catch (e) { /* sin dataLayer */ }
    try {
      const fb = FB[event];
      if (fb && typeof window.fbq === "function") window.fbq(fb[0], fb[1], { content_name: PRODUCT, ...(fb[2] || {}), ...data });
    } catch (e) { /* sin píxel */ }
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (el) track(el.dataset.track, el.dataset.cta ? { cta: el.dataset.cta } : {});
  });

  /* ---------------------------------------------------------------- enlaces del embudo
     Los botones llevan a sub-páginas propias (?cta= dice cuál se pulsó). Si la visita llegó
     con UTM o click-ids, viajan con ella: el calendario de /reservar/ los lee de la URL. */
  const KEEP = /^(utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid|ttclid)$/;
  const carry = Array.from(new URLSearchParams(location.search)).filter(([k]) => KEEP.test(k));
  const withCarry = (url) => {
    carry.forEach(([k, v]) => { if (!url.searchParams.has(k)) url.searchParams.set(k, v); });
    return url;
  };
  const link = (path) => withCarry(new URL(ROOT + path, location.href)).href;
  if (carry.length) $$("a[data-go]").forEach((a) => { a.href = withCarry(new URL(a.getAttribute("href"), location.href)).href; });

  /* ---------------------------------------------------------------- próximo plazo fiscal
     Calendario de la Agencia Tributaria: IVA (303) e IRPF (130) del 1 al 20 de abril, julio
     y octubre, y hasta el 30 de enero; 720/721 hasta el 31 de marzo; Renta hasta el 30 de
     junio. Si el último día cae en fin de semana, pasa al lunes. */
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  const DEADLINES = [
    [0, 30, "IVA e IRPF del cuarto trimestre"],
    [2, 31, "bienes y criptomonedas en el extranjero (720 y 721)"],
    [3, 20, "IVA e IRPF del primer trimestre"],
    [5, 30, "fin de la campaña de la Renta"],
    [6, 20, "IVA e IRPF del segundo trimestre"],
    [9, 20, "IVA e IRPF del tercer trimestre"],
  ];
  const nextDeadline = (now = new Date()) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      for (const [m, d, label] of DEADLINES) {
        const date = new Date(year, m, d);
        const wd = date.getDay();
        if (wd === 6) date.setDate(date.getDate() + 2);
        else if (wd === 0) date.setDate(date.getDate() + 1);
        if (date >= today) return { date, label, days: Math.round((date - today) / 86400000) };
      }
    }
    return null;
  };
  const dl = nextDeadline();
  if (dl) {
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const days = dl.days === 0 ? "Último día: hoy" : dl.days === 1 ? "Falta 1 día" : `Faltan ${dl.days} días`;
    const values = {
      short: `${dl.date.getDate()} ${MONTHS_SHORT[dl.date.getMonth()]}`,
      long: `${dl.date.getDate()} de ${MONTHS[dl.date.getMonth()]}`,
      label: dl.label,
      days,
    };
    $$("[data-dl]").forEach((el) => {
      const key = el.dataset.dl;
      let text = values[key];
      if (key === "label" && el.closest(".deadline")) text = cap(text);
      if (key === "days" && !el.closest(".deadline")) text = `${days}.`;
      el.textContent = text;
      el.hidden = false;
    });
  }

  /* ---------------------------------------------------------------- calendario
     En la landing se carga al acercarse (data-cal); en /reservar/ al entrar (data-cal="eager"). */
  const cal = $("[data-cal]");
  if (cal) {
    const frame = $("iframe", cal);
    let loaded = false;
    const load = () => {
      if (loaded || !frame) return;
      loaded = true;
      frame.addEventListener("load", () => cal.classList.add("is-ready"), { once: true });
      setTimeout(() => cal.classList.add("is-ready"), 8000);
      frame.src = frame.dataset.src;
      track("booking_view");
    };
    if (cal.dataset.cal === "eager" || !("IntersectionObserver" in window)) {
      load();
    } else {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load(); io.disconnect(); } }, { rootMargin: "1000px 0px" });
      io.observe(cal);
    }
  }

  /* ---------------------------------------------------------------- reserva hecha → /gracias/
     El widget avisa con postMessage(["msgsndr-booking-complete", {...}]) cuando la cita queda
     creada (y pagada, si el calendario cobra). Solo se acepta si viene de nuestro iframe. */
  let booked = false;
  const fromCalendar = (e) => {
    if ($$("[data-cal] iframe").some((f) => f.contentWindow && f.contentWindow === e.source)) return true;
    try { return /(^|\.)(leadconnectorhq|msgsndr)\.com$/.test(new URL(e.origin).hostname); } catch (err) { return false; }
  };
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (booked || !Array.isArray(d) || d[0] !== "msgsndr-booking-complete" || !fromCalendar(e)) return;
    booked = true;
    try { sessionStorage.setItem("medla_booking", String(Date.now())); } catch (err) { /* sin almacenamiento */ }
    track("booking_submitted");
    // margen para que el propio widget registre su evento antes de salir
    setTimeout(() => location.assign(link("gracias/")), 700);
  });

  /* llegada "nueva" (no al volver con el botón atrás): para no contar dos veces */
  const nav = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  const isReturn = !!nav && nav.type === "back_forward";

  window.MEDLA = { track, link, page: PAGE, isReturn, $, $$ };
})();
