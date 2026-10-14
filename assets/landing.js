/* MEDLA · Landing Asesoría Fiscal · v2
   Comportamiento propio de la landing (barra móvil, reseñas) + motion GSAP.
   La medición, el plazo fiscal, el calendario y los enlaces del embudo viven en core.js,
   que comparte con /reservar/, /whatsapp/ y /gracias/. Todo el contenido funciona sin JS;
   con prefers-reduced-motion o sin GSAP la página queda en su estado final. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- barra móvil
     Visible mientras no haya otros botones de reserva en pantalla (hero, calendario, cierre). */
  const dock = $("[data-dock]");
  const watched = [[$(".hero__ctas"), 0], [$("#reservar"), 0.04], [$(".final__ctas"), 0]].filter(([el]) => el);
  const inView = new Set([watched.length ? watched[0][0] : null]);
  const syncDock = () => {
    if (!dock) return;
    const on = inView.size === 0;
    dock.classList.toggle("is-on", on);
    dock.setAttribute("aria-hidden", on ? "false" : "true");
    $$("a", dock).forEach((a) => (a.tabIndex = on ? 0 : -1));
  };
  if ("IntersectionObserver" in window) {
    watched.forEach(([el, threshold]) => new IntersectionObserver(([e]) => {
      if (e.isIntersecting) inView.add(el); else inView.delete(el);
      syncDock();
    }, { threshold }).observe(el));
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
