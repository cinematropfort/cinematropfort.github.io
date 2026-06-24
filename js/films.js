// Déclare les films ici. Remplace poster, images, audio par tes propres chemins dans /assets/
const filmsData = [
  {
    id: "Paprika",
    title: "Paprika",
    poster: "assets/Paprika/poster.jpg",
    description: "Quand une machine permettant aux thérapeutes d’entrer dans les rêves de leur patient est volée...",
    images: [],
    audio: "assets/Paprika/audio/track.mp3"
  },
  {
    id: "9 Souls",
    title: "9 Souls",
    poster: "assets/9 Souls/poster.jpg",
    description: "Après avoir découvert un trou dans leur cellule bondée...",
    images: [],
    audio: "assets/9 Souls/audio/track.mp3"
  },
  {
    id: "Hana-bi",
    title: "Hana-bi",
    poster: "assets/Hana-bi/poster.jpg",
    description: "Le détective de police accablé Nishi prend des mesures désespérées...",
    images: [],
    audio: "assets/Hana-bi/audio/track.mp3"
  },
  {
    id: "Millennium Actress",
    title: "Millennium Actress",
    poster: "assets/Millennium Actress/poster.jpg",
    description: "La réalisatrice de documentaires Genya Tachibana a retrouvé...",
    images: [],
    audio: "assets/Millennium Actress/audio/track.mp3"
  },
  {
    id: "Nausicaä of the Valley of the Wind",
    title: "Nausicaä of the Valley of the Wind",
    poster: "assets/Nausicaä of the Valley of the Wind/poster.jpg",
    description: "Après une guerre mondiale, le royaume côtier connu sous le nom de Vallée du Vent...",
    images: [],
    audio: "assets/Nausicaä of the Valley of the Wind/audio/track.mp3"
  },
  {
    id: "Sympathy for Mr. Vengeance",
    title: "Sympathy for Mr. Vengeance",
    poster: "assets/Sympathy for Mr. Vengeance/poster.jpg",
    description: "Un homme sourd et sa petite amie recourent à des mesures désespérées...",
    images: [],
    audio: "assets/Sympathy for Mr. Vengeance/audio/track.mp3"
  },
];

// Crée un slug "safe" à partir d'un texte (supprime accents, espaces -> tirets)
function makeSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')                      // sépare accents
    .replace(/[\u0300-\u036f]/g, '')       // supprime accents
    .replace(/[^a-z0-9]+/g, '-')           // remplace tout ce qui n'est pas alphanum par des tirets
    .replace(/(^-|-$)/g, '');              // supprime tirets en bordure
}

// Ajoute automatiquement une propriété `slug` à chaque film si pas fournie
filmsData.forEach(f => {
  if (!f.slug) f.slug = makeSlug(f.id || f.title);
});

// Expose la fonction pour que film.js puisse l'utiliser
window.makeSlug = makeSlug;
window.filmsData = filmsData;