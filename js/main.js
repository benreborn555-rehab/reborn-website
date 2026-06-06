/* =========================================================
   Reborn Rehabilitation Centers — Interactions
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Header shrink on scroll ---------- */
  const header = document.querySelector(".site-header");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav toggle ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  const backdrop = document.querySelector(".nav-backdrop");

  const closeNav = () => {
    toggle && toggle.classList.remove("open");
    links && links.classList.remove("open");
    backdrop && backdrop.classList.remove("show");
    document.body.style.overflow = "";
  };
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      backdrop && backdrop.classList.toggle("show", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    backdrop && backdrop.addEventListener("click", closeNav);
  }

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  let revealObserver = null;
  if ("IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -60px 0px" }
    );
  }
  const observeReveal = (els) => {
    els.forEach((el) => {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add("in");
    });
  };
  observeReveal(document.querySelectorAll(".reveal"));

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const dur = 1600;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (counters.length && "IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            runCount(e.target);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => cio.observe(c));
  } else {
    counters.forEach((c) => (c.textContent = c.dataset.count + (c.dataset.suffix || "")));
  }

  /* ---------- Subtle hero parallax ---------- */
  const heroBg = document.querySelector(".hero-bg img");
  if (heroBg && window.matchMedia("(min-width: 760px)").matches) {
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        if (y < window.innerHeight) heroBg.style.transform = `scale(1.12) translateY(${y * 0.18}px)`;
      },
      { passive: true }
    );
  }

  /* ---------- Contact / lead form ---------- */
  document.querySelectorAll("form[data-lead]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const success = form.querySelector(".form-success");
      const btn = form.querySelector("button[type=submit]");
      if (btn) {
        btn.disabled = true;
        btn.dataset.orig = btn.innerHTML;
        btn.innerHTML = "שולח...";
      }
      // Simulated submission (replace with real endpoint/email service).
      setTimeout(() => {
        if (success) success.classList.add("show");
        form.reset();
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = btn.dataset.orig;
        }
        if (success) setTimeout(() => success.classList.remove("show"), 6000);
      }, 900);
    });
  });

  /* ---------- Gallery lightbox ---------- */
  const lb = document.querySelector(".lightbox");
  const bindGallery = () => {
    if (!lb) return;
    const lbImg = lb.querySelector("img");
    document.querySelectorAll(".g-item").forEach((item) => {
      if (item.dataset.bound) return;
      item.dataset.bound = "1";
      item.addEventListener("click", () => {
        const img = item.querySelector("img");
        if (img) {
          lbImg.src = img.src;
          lb.classList.add("open");
          document.body.style.overflow = "hidden";
        }
      });
    });
  };
  if (lb) {
    bindGallery();
    const close = () => {
      lb.classList.remove("open");
      document.body.style.overflow = "";
    };
    lb.querySelector(".lightbox-close").addEventListener("click", close);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Expose for dynamic content (content.js) ---------- */
  window.RebornUI = {
    bindGallery: bindGallery,
    observeReveal: function (els) {
      observeReveal(els);
    },
  };
})();
