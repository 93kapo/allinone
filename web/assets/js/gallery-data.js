/* GALLERY ITEMS / ELEMENTOS DE LA GALERÍA
   While this array is empty, the gallery shows clearly marked placeholders.
   Mientras esté vacío, la galería muestra marcadores de posición.

   Add items like:
   { type: "image", src: "assets/gallery/kitchen-1.webp",
     alt: { en: "Remodeled kitchen with white cabinets", es: "Cocina remodelada con gabinetes blancos" },
     caption: { en: "Kitchen remodel", es: "Remodelación de cocina" }, category: "kitchens" },
   { type: "video", src: "assets/gallery/deck-timelapse.mp4", poster: "assets/gallery/deck-poster.webp",
     alt: { en: "Deck build time-lapse", es: "Construcción de deck en time-lapse" },
     caption: { en: "Deck build", es: "Construcción de deck" }, category: "decks" }
   Paths are relative to the site root (the Spanish page adds "../" automatically).
   Las rutas son relativas a la raíz del sitio (la página en español agrega "../" sola). */
window.GALLERY_ITEMS = [];

/* Number of placeholder tiles shown while GALLERY_ITEMS is empty. */
window.GALLERY_PLACEHOLDERS = 6;
