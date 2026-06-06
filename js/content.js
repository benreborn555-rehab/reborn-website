/* =========================================================
   Reborn — Content loader
   Reads content.json and injects editable text + gallery.
   Public pages keep their default HTML as a fallback, so if
   content.json is missing nothing breaks.
   ========================================================= */
(function () {
  "use strict";

  function applyContent(data) {
    var text = data.text || {};
    var site = data.site || {};

    // Fill plain text fields: <... data-key="hero_title">
    document.querySelectorAll("[data-key]").forEach(function (el) {
      var key = el.getAttribute("data-key");
      var val;
      if (key.indexOf("site.") === 0) {
        val = site[key.slice(5)];
      } else {
        val = text[key];
      }
      if (val !== undefined && val !== null && String(val).length) {
        el.textContent = val;
      }
    });

    // Fill counters and suffixes dynamically before animation runs
    document.querySelectorAll("[data-count-key]").forEach(function (el) {
      var countKey = el.getAttribute("data-count-key");
      var suffixKey = el.getAttribute("data-suffix-key");
      var countVal = text[countKey];
      var suffixVal = text[suffixKey];
      if (countVal !== undefined && countVal !== null && String(countVal).length) {
        el.setAttribute("data-count", countVal);
        el.textContent = countVal; // fallback text
      }
      if (suffixVal !== undefined && suffixVal !== null && String(suffixVal).length) {
        el.setAttribute("data-suffix", suffixVal);
      }
    });

    // WhatsApp links: <a class="js-wa">  +  floating button
    if (site.whatsapp) {
      document.querySelectorAll(".js-wa, .wa-float").forEach(function (a) {
        a.setAttribute("href", "https://wa.me/" + site.whatsapp);
      });
    }
    // tel + mailto helpers
    document.querySelectorAll(".js-tel").forEach(function (a) {
      if (site.phone) a.setAttribute("href", "tel:" + String(site.phone).replace(/[^0-9+]/g, ""));
    });
    document.querySelectorAll(".js-mail").forEach(function (a) {
      if (site.email) a.setAttribute("href", "mailto:" + site.email);
    });

    // Gallery (only on pages that have the grid container)
    renderGallery(data.gallery || []);
  }

  function renderGallery(items) {
    var grid = document.getElementById("galleryGrid");
    if (!grid) return;
    grid.innerHTML = "";
    items.forEach(function (item) {
      var fig = document.createElement("figure");
      fig.className = "g-item reveal";

      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.title || "תמונה מהמתחם";
      img.loading = "lazy";

      var ov = document.createElement("div");
      ov.className = "g-overlay";
      var span = document.createElement("span");
      if (item.sub) {
        var small = document.createElement("small");
        small.textContent = item.sub;
        span.appendChild(small);
      }
      span.appendChild(document.createTextNode(item.title || ""));
      ov.appendChild(span);

      fig.appendChild(img);
      fig.appendChild(ov);
      grid.appendChild(fig);
    });

    // Re-bind lightbox + reveal for freshly created items
    if (window.RebornUI) {
      window.RebornUI.bindGallery();
      window.RebornUI.observeReveal(grid.querySelectorAll(".reveal"));
    }
  }

  function init() {
    fetch("content.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("no content.json");
        return r.json();
      })
      .then(applyContent)
      .catch(function () {
        /* keep default HTML */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
