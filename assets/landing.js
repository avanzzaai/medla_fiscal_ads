/* MEDLA · Landing Asesoría Fiscal · v2
   Comportamiento (plazo fiscal en vivo, pestañas, calendario, formulario, reseñas,
   barra móvil, medición) + motion GSAP. Todo el contenido funciona sin JS; con
   prefers-reduced-motion o sin GSAP la página queda en su estado final. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- medición */
  const track = (event, data = {}) => {
    const payload = { event, page: "lp-asesoria-fiscal", ...data };
    try { (window.dataLayer = window.dataLayer || []).push(payload); } catch (e) { /* sin dataLayer */ }
    try {
      if (typeof window.fbq === "function") {
        if (event === "lead_submit") window.fbq("track", "Lead", { content_name: "Asesoría Fiscal" });
        else if (event === "cta_click") window.fbq("trackCustom", "CTAClick", data);
      }
    } catch (e) { /* sin píxel */ }
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (el) track(el.dataset.track, el.dataset.cta ? { cta: el.dataset.cta } : {});
  });

  /* UTM y clics de anuncio: viajan con el formulario a HighLevel */
  const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  const attribution = (() => {
    let stored = {};
    try { stored = JSON.parse(sessionStorage.getItem("medla_lp_attr") || "{}"); } catch (e) { stored = {}; }
    const params = new URLSearchParams(location.search);
    const fresh = {};
    ATTR_KEYS.forEach((k) => { if (params.get(k)) fresh[k] = params.get(k).slice(0, 200); });
    const merged = Object.keys(fresh).length ? fresh : stored;
    try { sessionStorage.setItem("medla_lp_attr", JSON.stringify(merged)); } catch (e) { /* almacenamiento bloqueado */ }
    return merged;
  })();

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

  /* ---------------------------------------------------------------- barra móvil */
  const dock = $("[data-dock]");
  const heroCtas = $(".hero__ctas");
  const book = $("#reservar");
  let heroCtaVisible = true;
  let bookVisible = false;
  const syncDock = () => {
    if (!dock) return;
    const on = !heroCtaVisible && !bookVisible;
    dock.classList.toggle("is-on", on);
    dock.setAttribute("aria-hidden", on ? "false" : "true");
    $$("a", dock).forEach((a) => (a.tabIndex = on ? 0 : -1));
  };
  if ("IntersectionObserver" in window) {
    if (heroCtas) new IntersectionObserver(([e]) => { heroCtaVisible = e.isIntersecting; syncDock(); }).observe(heroCtas);
    if (book) new IntersectionObserver(([e]) => { bookVisible = e.isIntersecting; syncDock(); }, { threshold: 0.04 }).observe(book);
  }

  /* ---------------------------------------------------------------- pestañas */
  const tabs = $(".tabs");
  const tabBtns = $$("[data-tab]");
  let chosenTopic = "";
  const topicSelect = $("#f-topic");
  const applyTopic = () => {
    if (!chosenTopic || !topicSelect || topicSelect.value) return;
    const opt = Array.from(topicSelect.options).find((o) => o.text === chosenTopic);
    if (opt) topicSelect.value = opt.value || opt.text;
  };
  const showTab = (name, focus = false) => {
    if (!tabs) return;
    tabs.dataset.active = name;
    tabBtns.forEach((btn) => {
      const on = btn.dataset.tab === name;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      if (on && panel.hidden) {
        panel.hidden = false;
        panel.classList.remove("is-entering");
        void panel.offsetWidth;
        panel.classList.add("is-entering");
      } else if (!on) {
        panel.hidden = true;
      }
      if (on && focus) btn.focus();
    });
    if (name === "llamada") applyTopic();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  };
  tabBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => { showTab(btn.dataset.tab); track("tab_view", { tab: btn.dataset.tab }); });
    btn.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      let next = i;
      if (e.key === "ArrowRight") next = (i + 1) % tabBtns.length;
      if (e.key === "ArrowLeft") next = (i - 1 + tabBtns.length) % tabBtns.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = tabBtns.length - 1;
      showTab(tabBtns[next].dataset.tab, true);
    });
  });
  $$("[data-open-tab]").forEach((a) => a.addEventListener("click", () => showTab(a.dataset.openTab)));
  $$('a[href="#reservar"]:not([data-open-tab])').forEach((a) => a.addEventListener("click", () => {
    if (a.dataset.topic) chosenTopic = a.dataset.topic;
    showTab("reserva");
  }));
  if (location.hash === "#llamada") showTab("llamada");

  /* ---------------------------------------------------------------- calendario diferido */
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
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load(); io.disconnect(); } }, { rootMargin: "1000px 0px" });
      io.observe(cal);
    } else {
      load();
    }
    $$('a[href="#reservar"]').forEach((a) => a.addEventListener("click", load));
  }

  /* ---------------------------------------------------------------- formulario */
  const form = $('[data-form="fiscal"]');
  if (form) {
    const status = $(".form__status", form);
    const submit = $(".form__submit", form);
    const submitLabel = $(".btn__t", submit).textContent;
    const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const rules = {
      name: (v) => (v.trim().length >= 2 ? "" : "Escribe tu nombre."),
      phone: (v) => (v.replace(/\D/g, "").length >= 9 ? "" : "Escribe un teléfono válido, con prefijo si no es español."),
      email: (v) => (EMAIL.test(v.trim()) ? "" : "Revisa el correo: falta algo."),
      topic: (v) => (v ? "" : "Elige el tema de tu consulta."),
    };
    const errIds = { name: "f-name-err", phone: "f-phone-err", email: "f-email-err", topic: "f-topic-err" };
    const setError = (name, msg) => {
      const input = form.elements[name];
      const field = input && input.closest(".field");
      const err = document.getElementById(errIds[name]);
      if (err) err.textContent = msg;
      if (input) {
        input.setAttribute("aria-invalid", msg ? "true" : "false");
        if (msg) input.setAttribute("aria-describedby", errIds[name]);
        else input.removeAttribute("aria-describedby");
      }
      if (field) {
        field.classList.toggle("is-invalid", !!msg);
        if (msg) { field.classList.remove("shake"); void field.offsetWidth; field.classList.add("shake"); }
      }
    };
    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      input.addEventListener("blur", () => { if (input.value) setError(name, rules[name](input.value)); });
      input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") setError(name, rules[name](input.value)); });
      input.addEventListener("change", () => { if (input.getAttribute("aria-invalid") === "true") setError(name, rules[name](input.value)); });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "";
      status.className = "form__status";
      let firstBad = null;
      Object.keys(rules).forEach((name) => {
        const msg = rules[name](form.elements[name].value);
        setError(name, msg);
        if (msg && !firstBad) firstBad = form.elements[name];
      });
      const consent = form.elements.consent_processing;
      const consentErr = document.getElementById("f-consent-err");
      consentErr.textContent = consent.checked ? "" : "Necesitamos tu consentimiento para llamarte.";
      if (!consent.checked && !firstBad) firstBad = consent;
      if (firstBad) { firstBad.focus(); return; }

      const data = Object.fromEntries(new FormData(form).entries());
      data.consent_processing = true;
      data.plan = "fiscal";
      data.page = location.pathname;
      Object.assign(data, attribution);

      submit.disabled = true;
      $(".btn__t", submit).textContent = "Enviando…";
      try {
        const res = await fetch("/api/form/fiscal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || "Error");
        form.reset();
        status.className = "form__status is-ok";
        status.textContent = "Recibido. Un asesor fiscal te llamará en horario de oficina para ver tu caso.";
        track("lead_submit", { form: "fiscal", topic: data.topic });
      } catch (err) {
        status.className = "form__status is-error";
        status.textContent = "No pudimos enviar el formulario. Llámanos al +34 914 32 14 57 o inténtalo de nuevo en un momento.";
      } finally {
        submit.disabled = false;
        $(".btn__t", submit).textContent = submitLabel;
      }
    });
  }

  /* ---------------------------------------------------------------- reseñas: botones y arrastre */
  const revTrack = $("[data-rev-track]");
  if (revTrack) {
    const prev = $("[data-rev-prev]");
    const next = $("[data-rev-next]");
    const step = () => {
      const card = $(".review", revTrack);
      return card ? card.getBoundingClientRect().width + 20 : 320;
    };
    const go = (dir) => revTrack.scrollBy({ left: dir * step(), behavior: reducedMotion() ? "auto" : "smooth" });
    prev.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));
    const cards = $$(".review", revTrack);
    if ("IntersectionObserver" in window && cards.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.target === cards[0]) prev.disabled = e.intersectionRatio > 0.9;
          if (e.target === cards[cards.length - 1]) next.disabled = e.intersectionRatio > 0.9;
        });
      }, { root: revTrack, threshold: [0, 0.9, 1] });
      io.observe(cards[0]);
      io.observe(cards[cards.length - 1]);
    }
    if (finePointer) {
      let startX = 0;
      let startLeft = 0;
      let dragging = false;
      revTrack.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        dragging = true;
        startX = e.clientX;
        startLeft = revTrack.scrollLeft;
        revTrack.classList.add("is-dragging");
        revTrack.setPointerCapture(e.pointerId);
      });
      revTrack.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        revTrack.scrollLeft = startLeft - (e.clientX - startX);
      });
      const stop = () => {
        if (!dragging) return;
        dragging = false;
        revTrack.classList.remove("is-dragging");
      };
      revTrack.addEventListener("pointerup", stop);
      revTrack.addEventListener("pointercancel", stop);
    }
  }

  /* ---------------------------------------------------------------- motion */
  const reveal = () => root.classList.remove("is-loading");
  let introPlayed = false;

  const start = () => {
    const { gsap, ScrollTrigger, SplitText } = window;
    if (!gsap || !ScrollTrigger) { reveal(); return; }
    gsap.registerPlugin(ScrollTrigger);
    if (SplitText) gsap.registerPlugin(SplitText);
    gsap.defaults({ ease: "power3.out", duration: 0.8 });

    const mm = gsap.matchMedia();
    mm.add({
      desktop: "(min-width: 1024px)",
      compact: "(max-width: 1023px)",
      reduce: "(prefers-reduced-motion: reduce)",
    }, (ctx) => {
      const { desktop, reduce } = ctx.conditions;
      const cleanups = [];

      if (reduce) {
        reveal();
        $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
        $$("[data-step]").forEach((el) => el.classList.add("is-on"));
        return;
      }

      /* --- entrada del hero (una sola vez, aunque cambie el breakpoint) --- */
      const panel = $("[data-hero-panel]");
      const heroImg = $("[data-hero-img]");
      const title = $("[data-hero-title]");
      let split = null;
      if (!introPlayed) {
        introPlayed = true;
        let words = [title];
        if (SplitText && title) {
          split = SplitText.create(title, { type: "words", mask: "words" });
          words = split.words;
        }
        gsap.set(["[data-hero-item]", "[data-hero-float]", title], { opacity: 1 });
        reveal();
        gsap.timeline({ defaults: { ease: "expo.out", duration: 1.1 } })
          .from(panel, { scale: 0.965, duration: 1.3 }, 0)
          .from(heroImg, { scale: 1.12, duration: 1.8 }, 0)
          .from("[data-hero-item]:first-child", { opacity: 0, y: 14, duration: 0.8 }, 0.15)
          .from(words, { yPercent: 115, rotate: 3, stagger: 0.08, duration: 1.05 }, 0.22)
          .from(".hero__sub", { opacity: 0, y: 18, duration: 0.9 }, 0.5)
          .from(".hero__ctas > *", { opacity: 0, y: 16, stagger: 0.08, duration: 0.8 }, 0.62)
          .from("[data-hero-float]", { opacity: 0, y: 30, scale: 0.94, stagger: 0.14, duration: 1, ease: "back.out(1.5)" }, 0.75);
      } else {
        reveal();
      }

      /* --- hero en scroll: el panel se recoge y las capas se separan.
         Propiedades distintas a las de la entrada (o fromTo explícito) para que no se pisen. --- */
      const heroScroll = { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 };
      gsap.fromTo(panel, { scale: 1 }, { scale: desktop ? 0.94 : 0.97, ease: "none", immediateRender: false, scrollTrigger: heroScroll });
      gsap.to(heroImg, { yPercent: 10, ease: "none", scrollTrigger: heroScroll });
      gsap.to(".hero__content", { yPercent: -18, opacity: 0.2, ease: "none", scrollTrigger: { ...heroScroll, end: "60% top" } });
      if (desktop) {
        gsap.to(".deadline", { yPercent: -40, ease: "none", scrollTrigger: heroScroll });
        gsap.to(".hero__rating", { yPercent: 120, ease: "none", scrollTrigger: heroScroll });
      }

      /* --- marquesina: bucle continuo que acelera con el scroll --- */
      const mq = $("[data-marquee]");
      if (mq) {
        const trackEl = $(".marquee__track", mq);
        const originals = $$(".chip", trackEl);
        originals.forEach((chip) => {
          const clone = chip.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          clone.dataset.clone = "";
          trackEl.appendChild(clone);
        });
        mq.classList.add("is-looping");
        const loop = gsap.to(trackEl, { xPercent: -50, ease: "none", duration: 42, repeat: -1 });
        const boost = ScrollTrigger.create({
          trigger: mq, start: "top bottom", end: "bottom top",
          onUpdate: (self) => {
            const v = Math.min(4, Math.abs(self.getVelocity()) / 500);
            loop.timeScale(1 + v);
            gsap.to(loop, { timeScale: 1, duration: 1.2, ease: "power2.out", overwrite: true });
          },
        });
        const slow = () => gsap.to(loop, { timeScale: 0.25, duration: 0.6, overwrite: true });
        const resume = () => gsap.to(loop, { timeScale: 1, duration: 0.6, overwrite: true });
        mq.addEventListener("mouseenter", slow);
        mq.addEventListener("mouseleave", resume);
        cleanups.push(() => {
          boost.kill();
          loop.kill();
          gsap.set(trackEl, { clearProps: "transform" });
          mq.removeEventListener("mouseenter", slow);
          mq.removeEventListener("mouseleave", resume);
          $$("[data-clone]", trackEl).forEach((c) => c.remove());
          mq.classList.remove("is-looping");
        });
      }

      /* --- problema: la frase se ilumina palabra a palabra --- */
      const scrub = $("[data-scrub-text]");
      let painSplit = null;
      if (scrub && SplitText) {
        painSplit = SplitText.create(scrub, { type: "words" });
        gsap.fromTo(painSplit.words, { opacity: 0.14 }, {
          opacity: 1, stagger: 0.1, ease: "none",
          scrollTrigger: { trigger: scrub, start: "top 82%", end: "bottom 42%", scrub: 0.5 },
        });
      }

      /* --- servicios: la tarjeta anterior se recoge al llegar la siguiente --- */
      const cards = $$("[data-card]");
      cards.forEach((card, i) => {
        const img = $("[data-card-img]", card);
        if (img) {
          gsap.fromTo(img, { yPercent: 6 }, {
            yPercent: -4, ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "top 20%", scrub: 0.6 },
          });
        }
        if (!desktop || i === cards.length - 1) return;
        const nextCard = cards[i + 1];
        const shade = $(".card__shade", card);
        const st = {
          trigger: nextCard,
          start: "top bottom",
          end: () => `top ${parseFloat(getComputedStyle(nextCard).top) || 120}px`,
          scrub: 0.4,
          invalidateOnRefresh: true,
        };
        gsap.to(card, { scale: 0.93, ease: "none", scrollTrigger: st });
        if (shade) gsap.to(shade, { opacity: 0.42, ease: "none", scrollTrigger: { ...st } });
      });
      if (!desktop) {
        cards.forEach((card) => gsap.from(card, {
          opacity: 0, y: 40, duration: 0.9,
          scrollTrigger: { trigger: card, start: "top 88%", once: true },
        }));
      }

      /* --- oferta: la línea de pasos se dibuja y enciende cada paso --- */
      const steps = $("[data-steps]");
      if (steps) {
        gsap.to("[data-steps-fill]", {
          scaleY: 1, ease: "none",
          scrollTrigger: { trigger: steps, start: "top 70%", end: "bottom 55%", scrub: 0.5 },
        });
        $$("[data-step]", steps).forEach((step) => {
          ScrollTrigger.create({
            trigger: step, start: "top 64%",
            onEnter: () => step.classList.add("is-on"),
            onLeaveBack: () => step.classList.remove("is-on"),
          });
        });
      }

      /* --- ticket con inclinación al cursor --- */
      const tilt = $("[data-tilt] .ticket__in");
      if (tilt && desktop && finePointer) {
        const rx = gsap.quickTo(tilt, "rotationX", { duration: 0.6, ease: "power3.out" });
        const ry = gsap.quickTo(tilt, "rotationY", { duration: 0.6, ease: "power3.out" });
        const host = tilt.parentElement;
        const move = (e) => {
          const r = host.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 8);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
        };
        const leave = () => { rx(0); ry(0); };
        host.addEventListener("pointermove", move);
        host.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          host.removeEventListener("pointermove", move);
          host.removeEventListener("pointerleave", leave);
          gsap.set(tilt, { clearProps: "transform" });
        });
      }

      /* --- por qué MEDLA: collage por capas + contadores --- */
      $$("[data-speed]").forEach((el) => {
        const s = Number(el.dataset.speed) || 0;
        gsap.fromTo(el, { yPercent: s }, {
          yPercent: -s, ease: "none",
          scrollTrigger: { trigger: "[data-why]", start: "top bottom", end: "bottom top", scrub: 0.6 },
        });
      });
      $$("[data-count]").forEach((el) => {
        const end = Number(el.dataset.count);
        const obj = { v: 0 };
        el.textContent = "0";
        gsap.to(obj, {
          v: end, duration: end > 50 ? 1.6 : 1.1, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => { el.textContent = Math.round(obj.v); },
        });
      });

      /* --- cierre: Madrid en parallax --- */
      gsap.fromTo("[data-final-bg]", { yPercent: -6 }, {
        yPercent: 6, ease: "none",
        scrollTrigger: { trigger: ".final", start: "top bottom", end: "bottom top", scrub: 0.6 },
      });

      /* --- reseñas: entran en cascada --- */
      gsap.from(".review", {
        opacity: 0, x: 60, stagger: 0.08, duration: 0.9,
        scrollTrigger: { trigger: "[data-rev-track]", start: "top 85%", once: true },
      });

      /* --- revelados generales por lotes --- */
      const reveals = $$("[data-reveal]");
      gsap.set(reveals, { opacity: 0, y: 30 });
      ScrollTrigger.batch(reveals, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.08, duration: 0.9, overwrite: true }),
      });

      /* --- botones magnéticos (solo con ratón) --- */
      if (desktop && finePointer) {
        $$("[data-magnetic]").forEach((btn) => {
          const mx = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
          const my = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
          const move = (e) => {
            const r = btn.getBoundingClientRect();
            mx((e.clientX - (r.left + r.width / 2)) * 0.22);
            my((e.clientY - (r.top + r.height / 2)) * 0.3);
          };
          const leave = () => { mx(0); my(0); };
          btn.addEventListener("pointermove", move);
          btn.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            btn.removeEventListener("pointermove", move);
            btn.removeEventListener("pointerleave", leave);
            gsap.set(btn, { clearProps: "transform" });
          });
        });
      }

      /* --- recalcular cuando cargan fuentes e imágenes --- */
      const refresh = () => ScrollTrigger.refresh();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
      window.addEventListener("load", refresh, { once: true });

      return () => {
        cleanups.forEach((fn) => fn());
        if (split) split.revert();
        if (painSplit) painSplit.revert();
      };
    });
  };

  const boot = () => {
    if (document.fonts && document.fonts.ready) {
      Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1000))]).then(start);
    } else {
      start();
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
