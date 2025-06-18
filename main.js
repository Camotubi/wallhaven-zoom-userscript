// ==UserScript==
// @name         Wallhaven HD  Preview
// @namespace    http://tampermonkey.net/
// @version      2025-05-29
// @description  try to take over the world!
// @author       You
// @match        https://wallhaven.cc/search*
// @match        https://wallhaven.cc/hot*
// @match        https://wallhaven.cc/latest*
// @match        https://wallhaven.cc/random*
// @match        https://wallhaven.cc/untagged*
// @match        https://wallhaven.cc/toplist*

// @icon         https://www.google.com/s2/favicons?sz=64&domain=wallhaven.cc
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  function throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        func(...args);
        lastCall = now;
      }
    };
  }
  let toggle = true;
  const body = document.querySelector("body");
  body.addEventListener("keydown", (e) => {
    if (e.key == "z") {
      toggle = !toggle;
      if (!toggle) {
        hidePopover();
      } else {
        showPopover();
      }
    }
  });

  const popover = document.createElement("div");

  let wSize = window.innerWidth / 3;
  let hSize = window.innerHeight;
  popover.setAttribute("popover", true);
  popover.dataset.showing = false;
  const img = document.createElement("img");
  img.width = wSize;
  function setSizes() {
    Object.assign(popover.style, {
      position: "fixed",
      left: "0",
      top: "0",
      height: `${hSize}px`,
      background: "none",
      width: `${wSize}px`,
      zIndex: "9999", // seriously, make it float above everything
      pointerEvents: "none", // avoids accidental interactions
    });
    img.width = wSize;
  }
  setSizes();
  addEventListener("resize", setSizes);
  const badSources = new Set();
  function tryImageSources(imgID, png, thumbSrc) {
    const prefix = imgID.slice(0, 2);
    const base = imgID.split(".")[0];
    const p = `https://w.wallhaven.cc/full/${prefix}/wallhaven-${base}.png`;
    const j = `https://w.wallhaven.cc/full/${prefix}/wallhaven-${base}.jpg`;
    const w = `https://w.wallhaven.cc/full/${prefix}/wallhaven-${base}.webp`;
    const s = `https://th.wallhaven.cc/small/${prefix}/wallhaven-${base}.jpg`;
    let sources = png ? [p, j, w, s] : [j, w, p, s];

    img.src = thumbSrc;
    img.style.filter = "blur(8px)";
    img.style.transition = "filter 0.3s ease";
    img.style.display = "block";

    let highRes = new Image();
    highRes.onload = () => {
      img.src = highRes.src;
      img.style.filter = "blur(0)";
    };

    highRes.onerror = () => {
      // fallback next source
      badSources.add(highRes.src);
      while (sources.length > 0) {
        let src = sources.shift();
        if (!badSources.has(src)) {
          highRes.src = src;
          return;
        }
      }
      img.style.display = "none";
    };

    highRes.src = sources.shift();
  }

  popover.appendChild(img);

  body.appendChild(popover);
  const followRaw = ({ clientX, clientY }, ms = 0) => {
    if (!popover.dataset.showing) {
      return;
    }

    const popoverWidth = img.offsetWidth;
    const popoverHeight = img.offsetHeight;
    const padding = 10; // optional space from the edge

    // Clamp X
    let x = clientX;
    if (x + popoverWidth > window.innerWidth - padding) {
      x = window.innerWidth - popoverWidth - padding;
    } else if (x < padding) {
      x = padding;
    }

    // Clamp Y
    let y = clientY;
    if (y + popoverHeight > window.innerHeight - padding) {
      y = window.innerHeight - popoverHeight - padding;
      if (y < 0) {
        y = 0;
      }
    }
    // Use transform instead of left/top for perf (GPU-accelerated)
    const transform = `translate(${x}px, ${y}px)`;

    if (popover.dataset.showing === "true") {
      popover.animate({ transform }, { duration: ms, fill: "forwards" });
    } else {
      // Instantly set position before show to avoid "flying in"
      popover.style.transform = transform;
    }
  };
  const follow = throttle(followRaw, 100);
  let mouseX = 0;
  let mouseY = 0;
  body.addEventListener("mousemove", (event) => {
    if (!toggle) {
      return;
    }
    mouseX = event.clientX;
    mouseY = event.clientY;
    follow(event, 100);
  });
  function hidePopover() {
    popover.hidePopover();
    popover.dataset.showing = false;
  }
  function showPopover() {
    popover.showPopover();
    popover.dataset.showing = true;
  }
  function enhanceThumb(el) {
    if (el.dataset.enhanced === "true") {
      return;
    } // skip if already processed
    el.dataset.enhanced = "true";
    const thumbImg = el.querySelector("img");
    if (!thumbImg) {
      return;
    }

    const isPNG = !!el.querySelector("span.png");
    const imgID = thumbImg.getAttribute("data-src").split("/").at(-1);
    const timeoutIDS = new Set();
    el.addEventListener("mouseenter", () => {
      const timeoutid = setTimeout(() => {
        timeoutIDS.delete(timeoutid);
        if (!toggle) {
          return;
        }
        followRaw({
          clientX: mouseX,
          clientY: mouseY,
        });

        tryImageSources(imgID, isPNG, thumbImg);
        showPopover(imgID);
      }, 300);
      timeoutIDS.add(timeoutid);
    });
    el.addEventListener("mouseleave", () => {
      timeoutIDS.forEach((id) => clearTimeout(id));
      hidePopover();
    });
  }
  body.querySelectorAll("figure.thumb").forEach(enhanceThumb);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches("figure.thumb")) {
          enhanceThumb(node);
        } else {
          node.querySelectorAll?.("figure.thumb")?.forEach(enhanceThumb);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
