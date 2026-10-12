"use strict";

document.documentElement.classList.add("has-js");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Sin JS, la navegación permanece visible. Con JS se pliega en móvil.
const menuButton = document.querySelector(".menu-toggle");
const menu = document.querySelector("#menu");
function closeMenu(returnFocus = false) {
  menu.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
  if (returnFocus) menuButton.focus();
}
menuButton.hidden = false;
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  menu.classList.toggle("is-open", open);
});
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.classList.contains("is-open")) closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".navigation")) closeMenu();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 960) closeMenu();
}, { passive: true });

// Preparar solo lo que está fuera de pantalla. La portada nunca parpadea.
const revealElements = [...document.querySelectorAll("[data-reveal]")];
let revealObserver;
function finishReveal(element, animate = false) {
  element.classList.remove("reveal-pending");
  element.classList.toggle("is-entering", animate);
  revealObserver?.unobserve(element);
}
if (!reducedMotion.matches && "IntersectionObserver" in window) {
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || !entry.target.classList.contains("reveal-pending")) return;
      finishReveal(entry.target, true);
    });
  }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });
  revealElements.forEach((element) => {
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.classList.add("reveal-pending");
    revealObserver.observe(element);
  });
}
document.addEventListener("animationend", (event) => {
  if (event.animationName === "section-entry") event.target.classList.remove("is-entering");
});
document.addEventListener("focusin", (event) => {
  const pending = event.target.closest(".reveal-pending");
  if (pending) finishReveal(pending);
});

const progress = document.querySelector(".reading-progress span");
let progressScheduled = false;
function updateProgress() {
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
  progress.style.transform = `scaleX(${ratio})`;
  progressScheduled = false;
}
window.addEventListener("scroll", () => {
  if (progressScheduled) return;
  progressScheduled = true;
  window.requestAnimationFrame(updateProgress);
}, { passive: true });
window.addEventListener("resize", updateProgress, { passive: true });
updateProgress();

// La copia mantiene un bucle continuo, pero no duplica marcas en accesibilidad.
const carousel = document.querySelector(".insurance-carousel");
const carouselWindow = carousel.querySelector(".insurance-window");
const track = carousel.querySelector(".insurance-track");
const copy = carousel.querySelector(".insurance-group").cloneNode(true);
copy.classList.add("insurance-copy");
copy.setAttribute("aria-hidden", "true");
copy.querySelectorAll("img").forEach((image) => { image.alt = ""; });
track.append(copy);
carousel.classList.add("motion-ready");
const pauseButton = document.querySelector("#pausar-marcas");
const pauseLabel = pauseButton.querySelector(".motion-label");
let userPaused = false;
let hovered = false;
let focused = false;

function updateCarousel() {
  const reduce = reducedMotion.matches;
  const stopped = userPaused || hovered || focused || reduce || document.hidden;
  carousel.dataset.paused = String(stopped);
  carousel.dataset.reduced = String(reduce);
  pauseButton.disabled = reduce;
  pauseButton.setAttribute("aria-pressed", String(userPaused || reduce));
  pauseLabel.textContent = reduce ? "Movimiento reducido" : userPaused ? "Reanudar carrusel" : "Pausar carrusel";
  pauseButton.firstElementChild.textContent = userPaused || reduce ? "▷" : "Ⅱ";
}
pauseButton.hidden = false;
pauseButton.addEventListener("click", () => {
  userPaused = !userPaused;
  updateCarousel();
});
// El botón queda fuera de la pausa temporal: Reanudar funciona sin perder foco.
carouselWindow.addEventListener("pointerenter", (event) => {
  if (event.pointerType !== "mouse") return;
  hovered = true;
  updateCarousel();
});
carouselWindow.addEventListener("pointerleave", (event) => {
  if (event.pointerType !== "mouse") return;
  hovered = false;
  updateCarousel();
});
carouselWindow.addEventListener("focusin", () => { focused = true; updateCarousel(); });
carouselWindow.addEventListener("focusout", (event) => {
  focused = carouselWindow.contains(event.relatedTarget);
  updateCarousel();
});
document.addEventListener("visibilitychange", updateCarousel);
updateCarousel();
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    revealObserver?.disconnect();
    revealElements.forEach((element) => finishReveal(element));
  }
  // No volver a ocultar contenido al restaurar la preferencia.
  updateCarousel();
});

// La galería es manual: no cambia una fotografía mientras se está leyendo.
const gallery = document.querySelector("[data-gallery]");
const slides = [...gallery.querySelectorAll(".gallery-slide")];
const stage = gallery.querySelector(".gallery-stage");
const controls = gallery.querySelector(".gallery-controls");
const previous = gallery.querySelector(".gallery-prev");
const next = gallery.querySelector(".gallery-next");
const counter = gallery.querySelector(".gallery-count");
let currentSlide = 0;
let activeSlide = slides[0];
let slideRequest = 0;
let finishGallery = () => {};

function settleSlides(visible) {
  slides.forEach((slide) => {
    slide.hidden = slide !== visible;
    slide.classList.remove("gallery-incoming", "gallery-outgoing");
    slide.inert = false;
    slide.removeAttribute("aria-hidden");
  });
}
function updateGalleryControls() {
  previous.disabled = currentSlide === 0;
  next.disabled = currentSlide === slides.length - 1;
}
async function showSlide(index, focusLink = false) {
  const target = Math.max(0, Math.min(slides.length - 1, index));
  if (target === currentSlide) return;
  currentSlide = target;
  updateGalleryControls();
  const request = ++slideRequest;
  const incoming = slides[target];
  const image = incoming.querySelector("img");
  image.loading = "eager";
  // Mantener la foto anterior hasta que la siguiente esté lista para pintarse.
  try { await image.decode(); } catch { /* Si falla, conservar el alt de la imagen. */ }
  if (request !== slideRequest) return;
  finishGallery();
  const outgoing = activeSlide;
  activeSlide = incoming;
  incoming.hidden = false;
  counter.textContent = `Imagen ${currentSlide + 1} de ${slides.length}`;
  if (outgoing !== incoming && !reducedMotion.matches) {
    outgoing.classList.add("gallery-outgoing");
    outgoing.inert = true;
    outgoing.setAttribute("aria-hidden", "true");
    incoming.classList.add("gallery-incoming");
    const finish = () => {
      incoming.removeEventListener("animationend", finish);
      settleSlides(incoming);
      finishGallery = () => {};
    };
    finishGallery = finish;
    incoming.addEventListener("animationend", finish, { once: true });
  } else settleSlides(incoming);
  if (focusLink) incoming.querySelector("a").focus({ preventScroll: true });
}
gallery.classList.add("gallery-enhanced");
stage.tabIndex = 0;
stage.setAttribute("aria-roledescription", "carrusel de fotografías");
controls.hidden = false;
settleSlides(activeSlide);
updateGalleryControls();
previous.addEventListener("click", () => showSlide(currentSlide - 1));
next.addEventListener("click", () => showSlide(currentSlide + 1));
stage.addEventListener("keydown", (event) => {
  const positions = { ArrowLeft: currentSlide - 1, ArrowRight: currentSlide + 1, Home: 0, End: slides.length - 1 };
  if (!(event.key in positions)) return;
  event.preventDefault();
  showSlide(positions[event.key], event.target !== stage);
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) finishGallery();
});
