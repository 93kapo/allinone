/* =====================================================================
   SITE CONFIG — the ONLY file you need to edit for contact details.
   Archivo de configuración — el ÚNICO que necesitas editar para los datos.
   ===================================================================== */
window.SITE_CONFIG = {
  businessName: "All In One Painting & Remodeling Group LLC",

  // Phone shown across the site. phoneTel = digits for tel: links.
  phone: "904-855-9635",
  phoneTel: "+19048559635",

  // WhatsApp: digits only, with country code (no +). whatsappEnabled=false hides every WhatsApp button.
  // WhatsApp: solo dígitos con código de país (sin +). whatsappEnabled=false oculta los botones.
  whatsappNumber: "19048559635",
  whatsappEnabled: true,

  // Leave "" to hide. / Déjalo vacío para ocultar.
  email: "",

  // Social links — leave "" to hide each one.
  social: {
    facebook: "",
    instagram: "",
    google: "",      // Google Business Profile
    youtube: "",
    tiktok: ""
  },

  // License number (optional, shown only if showLicensed is true).
  licenseNumber: "",
  // Set to true ONLY when the business really holds the license/insurance:
  // then "Licensed & Insured" / "Licenciados y asegurados" appears.
  showLicensed: false,

  // REAL customer reviews (leave [] to show clearly marked placeholders). Only add genuine reviews.
  // RESEÑAS REALES (deja [] para mostrar marcadores). Agrega solo reseñas auténticas.
  // { name: "Name, area", text: { en: "...", es: "..." } }
  reviews: [],

  // Quote form. PENDING: paste your endpoint, e.g.
  //   Web3Forms: "https://api.web3forms.com/submit"  (+ formAccessKey below)
  //   Formspree: "https://formspree.io/f/XXXXXXXX"
  formEndpoint: "",
  formAccessKey: ""   // Web3Forms access key (leave "" for Formspree)
};

/* Editable content (gallery, before/after, reviews, social links) is refreshed from this API after the page loads.
   If it is unreachable the content embedded in the page is kept. Leave "" to disable.
   El contenido editable se actualiza desde esta API; si no responde se conserva el contenido embebido. */
window.CONTENT_API = "https://admin.allin1jax.com/api/content";
/* Only absolute image/video URLs from this origin are accepted (keys like "media/abc.webp" resolve against it). */
window.MEDIA_ORIGIN = "https://media.allin1jax.com";
