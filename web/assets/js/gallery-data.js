/* GALLERY ITEMS / ELEMENTOS DE LA GALERÍA
   While this array is empty, the gallery shows clearly marked placeholders.
   Mientras esté vacío, la galería muestra marcadores de posición.

   category must match an id in GALLERY_CATEGORIES below.
   Add items like:
   { type: "image", src: "assets/gallery/kitchen-1.webp",
     alt: { en: "Remodeled kitchen with white cabinets", es: "Cocina remodelada con gabinetes blancos" },
     caption: { en: "Kitchen remodel", es: "Remodelación de cocina" }, category: "remodeling" },
   { type: "video", src: "assets/gallery/deck-timelapse.mp4", poster: "assets/gallery/deck-poster.webp",
     alt: { en: "Deck build time-lapse", es: "Construcción de deck en time-lapse" },
     caption: { en: "Deck build", es: "Construcción de deck" }, category: "exterior" }
   Paths are relative to the site root (the Spanish page adds "../" automatically).
   Las rutas son relativas a la raíz del sitio (la página en español agrega "../" sola). */
window.GALLERY_ITEMS = [
  { type: "video", src: "assets/gallery/allin1.mp4", poster: "assets/gallery/allin1-poster.jpg",
    alt: { en: "Crew member working on the exterior siding and trim of a house", es: "Trabajador en el exterior de una casa, trabajando en el revestimiento y el acabado" },
    caption: { en: "Exterior project", es: "Proyecto exterior" }, category: "exterior" }
];

/* Filter categories / Categorías del filtro (the "All" button is added automatically). */
window.GALLERY_CATEGORIES = [
  { id: "interior",   label: { en: "Interior",   es: "Interior" } },
  { id: "exterior",   label: { en: "Exterior",   es: "Exterior" } },
  { id: "remodeling", label: { en: "Remodeling", es: "Remodelación" } }
];

/* BEFORE / AFTER pairs / PARES ANTES / DESPUÉS. While empty, 2 marked placeholder sliders are shown.
   Mientras esté vacío se muestran 2 comparadores de ejemplo marcados como tales.
   { before: "assets/gallery/bath-before.webp", after: "assets/gallery/bath-after.webp",
     alt: { en: "Bathroom before and after", es: "Baño antes y después" },
     caption: { en: "Bathroom update", es: "Renovación de baño" } } */
window.BEFORE_AFTER = [
  { before: "assets/gallery/ba-1-before.jpg", after: "assets/gallery/ba-1-after.jpg",
    alt: { en: "Exterior wood louvers before and after refinishing", es: "Persianas de madera exteriores antes y después del acabado" },
    caption: { en: "Exterior wood finishing", es: "Acabado de madera exterior" } }
];

/* Number of placeholder tiles shown while GALLERY_ITEMS is empty
   (they cycle through the categories above so the filter works). */
window.GALLERY_PLACEHOLDERS = 6;
