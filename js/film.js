// film.js : charge les données du film courant (via ?id=...), met en place le diaporama
// Amélioration : si window.filmsData n'est pas défini, tente de charger js/films.generated.js automatiquement.
// Ajout : bouton plein écran (fullscreen) pour la zone du diaporama.
// Lecture audio : essaie de démarrer la piste audio en même temps que le diaporama (si autorisé).
(function(){
  // utilitaires DOM
  function q(selector, el = document) { return el.querySelector(selector); }
  function qa(selector, el = document) { return Array.from(el.querySelectorAll(selector)); }
  function getParam(name) { return new URLSearchParams(location.search).get(name); }

  // slugify local (utilise window.makeSlug si fourni)
  const slugify = window.makeSlug || function(s) {
    const str = String(s || '');
    const normalized = (str && str.normalize) ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
    return normalized.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Essaie d'assurer que window.filmsData est disponible.
  function ensureFilmsData(timeout = 3000) {
    return new Promise((resolve, reject) => {
      if (window.filmsData && Array.isArray(window.filmsData)) {
        return resolve(window.filmsData);
      }

      const scriptUrl = 'js/films.generated.js';
      try {
        const existing = Array.from(document.getElementsByTagName('script')).some(s => s.src && s.src.endsWith(scriptUrl));
        if (!existing) {
          const s = document.createElement('script');
          s.src = scriptUrl;
          s.async = false;
          s.onload = () => {
            setTimeout(() => {
              if (window.filmsData) resolve(window.filmsData);
            }, 20);
          };
          s.onerror = () => { /* ignore: we'll poll */ };
          document.head.appendChild(s);
        }
      } catch (e) { /* ignore */ }

      const start = Date.now();
      const iv = setInterval(() => {
        if (window.filmsData && Array.isArray(window.filmsData)) {
          clearInterval(iv);
          return resolve(window.filmsData);
        }
        if (Date.now() - start > timeout) {
          clearInterval(iv);
          return reject(new Error('filmsData not available'));
        }
      }, 100);
    });
  }

  ensureFilmsData(3000).then((films) => {
    const rawParam = (getParam('id') || '').trim();
    const paramSlug = slugify(rawParam);

    function findFilmByParam(pRaw, pSlug) {
      return (films || []).find(f => {
        const id = (f.id || '').toString();
        const title = (f.title || '').toString();
        const slug = (f.slug || slugify(id || title)).toString();

        if (!pRaw) return false;
        if (id === pRaw) return true;
        if (title === pRaw) return true;
        if (slug === pRaw) return true;
        if (slug === pSlug) return true;
        if (slugify(id) === pSlug) return true;
        if (slugify(title) === pSlug) return true;
        return false;
      });
    }

    const film = findFilmByParam(rawParam, paramSlug);

    if (!film) {
      console.error('Film non trouvé. Param reçu:', rawParam, '(slug:', paramSlug + ')');
      console.error('Films disponibles (id / slug / title):', (films || []).map(f => ({
        id: f.id, slug: (f.slug || slugify(f.id || f.title)), title: f.title
      })));
      document.body.innerHTML = `
        <main class="container" style="padding:24px;">
          <h2>Film introuvable</h2>
          <p>Vérifie l'id dans l'URL. L'identifiant utilisé doit être le <em>slug</em> ou l'<em>id</em> exact défini dans <code>js/films.generated.js</code> (ou dans ton fichier films).</p>
          <p>Assure-toi que <code>js/films.generated.js</code> est présent et inclus avant <code>js/film.js</code>, ou que le script a été généré.</p>
          <p><a href="index.html">Retour</a></p>
        </main>
      `;
      return;
    }

    // DOM elements
    const titleEl = q('#film-title');
    const subtitleEl = q('#film-subtitle');
    const descEl = q('#film-desc');
    const posterEl = q('#film-poster');
    const slideshowEl = q('#slideshow');
    const slideshowArea = q('#slideshowArea'); // zone à passer en fullscreen
    const audioEl = q('#audio');
    const playPauseBtn = q('#playPauseBtn');
    const prevBtn = q('#prevBtn');
    const nextBtn = q('#nextBtn');
    const speedRange = q('#speedRange');
    const transRange = q('#transRange');
    const audioRate = q('#audioRate');
    const loopToggle = q('#loopToggle');
    const indexIndicator = q('#indexIndicator');
    const fullscreenBtn = q('#fullscreenBtn');

    // Remplissage infos film
    titleEl.textContent = film.title || film.id || 'Film';
    subtitleEl.textContent = film.title || film.id || '';
    descEl.textContent = film.description || '';
    if (film.poster) posterEl.src = film.poster;

    // Récupère la liste d'images
    async function listImagesForFilm(film) {
      if (film.images && film.images.length) return film.images.slice();

      const baseCandidates = [];
      const baseSlug = (film.slug || slugify(film.id || film.title || ''));
      if (baseSlug) baseCandidates.push(`assets/${baseSlug}/images`);
      if (film.id) baseCandidates.push(`assets/${film.id}/images`);
      if (film.title) baseCandidates.push(`assets/${slugify(film.title)}/images`);

      const guessed = [];
      for (const base of baseCandidates) {
        for (let i=1;i<=30;i++){
          const padded = String(i).padStart(2,'0');
          guessed.push(`${base}/${padded}.jpg`);
          guessed.push(`${base}/${padded}.png`);
          guessed.push(`${base}/${padded}.jpeg`);
          guessed.push(`${base}/${padded}.webp`);
        }
      }

      const existings = [];
      for (const url of guessed) {
        try {
          await preloadImage(url, true);
          existings.push(url);
        } catch(e){}
      }
      return existings;
    }

    function preloadImage(src, testOnly=false){
      return new Promise((resolve,reject)=>{
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('not found'));
        img.src = src;
        if (testOnly && img.complete) {
          if (img.naturalWidth === 0) reject(new Error('not found'));
          else resolve(img);
        }
      });
    }

    // Fisher-Yates shuffle
    function shuffleArray(arr){
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // Diaporama state
    let images = [];        // urls
    let order = [];         // permutation indexes
    let currentIdx = 0;     // index within order
    let timer = null;
    let playing = false;

    // Initialise audio
    audioEl.src = film.audio || '';
    audioEl.volume = 0.8;
    audioRate.addEventListener('input', () => {
      audioEl.playbackRate = parseFloat(audioRate.value);
    });

    // Fullscreen helpers
    async function enterFullscreen() {
      try {
        if (slideshowArea.requestFullscreen) await slideshowArea.requestFullscreen();
        else if (slideshowArea.webkitRequestFullscreen) await slideshowArea.webkitRequestFullscreen();
        else if (slideshowArea.mozRequestFullScreen) await slideshowArea.mozRequestFullScreen();
      } catch (e) { console.warn('Fullscreen failed', e); }
    }
    async function exitFullscreen() {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
      } catch (e) { console.warn('Exit fullscreen failed', e); }
    }
    function isFullscreen() {
      return document.fullscreenElement === slideshowArea
        || document.webkitFullscreenElement === slideshowArea
        || document.mozFullScreenElement === slideshowArea;
    }
    function updateFullscreenButton() {
      if (!fullscreenBtn) return;
      fullscreenBtn.textContent = isFullscreen() ? '⤢' : '⛶';
      fullscreenBtn.title = isFullscreen() ? 'Quitter le plein écran' : 'Plein écran';
    }
    // Événement global pour changer l'icône quand l'état change
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', async () => {
        if (isFullscreen()) {
          await exitFullscreen();
          updateFullscreenButton();
        } else {
          await enterFullscreen();
          updateFullscreenButton();
          // Si on rentre en fullscreen, on démarre la lecture si elle n'était pas lancée
          if (!playing) {
            // lancer diapo+audio
            togglePlayPause(); // togglePlayPause gère lancement audio
          }
        }
      });
    }

    // Init: charger images et préparer diapo
    (async function init(){
      images = film.images && film.images.length ? film.images.slice() : await listImagesForFilm(film);
      if (!images.length) {
        slideshowEl.innerHTML = '<div style="padding:40px; color:#cfcfcf">Aucune image trouvée. Ajoute des images dans assets/&lt;id-or-slug&gt;/images/ ou précise film.images dans js/films.generated.js</div>';
        return;
      }

      // précharger (tenter de charger toutes, ignore celles qui échouent)
      const preloadResults = await Promise.allSettled(images.map(src => preloadImage(src).catch(()=>null)));
      const validImages = images.filter((_,i) => preloadResults[i] && preloadResults[i].status === 'fulfilled');
      if (validImages.length) images = validImages;

      // créer balises img
      slideshowEl.innerHTML = '';
      images.forEach((src,i)=>{
        const img = document.createElement('img');
        img.src = src;
        img.alt = `${film.title || film.id} — image ${i+1}`;
        slideshowEl.appendChild(img);
      });

      // initialisation ordre aléatoire
      order = shuffleArray(images.map((_,i)=>i));
      currentIdx = 0;
      applyTransition(parseInt(transRange.value,10));
      updateIndicator();
      showAt(currentIdx);

      // évènements UI
      playPauseBtn.addEventListener('click', togglePlayPause);
      prevBtn.addEventListener('click', ()=>{ prevImage(); restartTimerIfPlaying(); });
      nextBtn.addEventListener('click', ()=>{ nextImage(); restartTimerIfPlaying(); });
      speedRange.addEventListener('input', restartTimerIfPlaying);
      transRange.addEventListener('input', () => applyTransition(parseInt(transRange.value,10)));
      loopToggle.addEventListener('change', ()=>{});
      document.addEventListener('visibilitychange', ()=> {
        if (document.hidden) pause();
      });

      // Double-clic sur l'image pour basculer fullscreen (confort)
      slideshowEl.addEventListener('dblclick', async () => {
        if (isFullscreen()) await exitFullscreen();
        else await enterFullscreen();
      });
    })();

    function applyTransition(ms){
      const imgs = qa('img', slideshowEl);
      imgs.forEach(img => {
        img.style.transitionDuration = `${ms}ms`;
      });
    }

    function showAt(orderIdx){
      const imgs = qa('img', slideshowEl);
      imgs.forEach((img, idx) => img.classList.remove('show'));
      const targetIndex = order[orderIdx];
      const targetImg = imgs[targetIndex];
      if (targetImg) targetImg.classList.add('show');
      updateIndicator();
    }

    function updateIndicator(){
      indexIndicator.textContent = `Image ${Math.min(currentIdx+1, order.length)} / ${order.length}`;
    }

    function nextImage(){
      currentIdx++;
      if (currentIdx >= order.length) {
        if (loopToggle.checked) {
          const lastShown = order[order.length - 1];
          let newOrder = shuffleArray(images.map((_,i)=>i));
          if (newOrder[0] === lastShown && images.length > 1) {
            const swapIndex = (newOrder[0] === lastShown) ? 1 : 0;
            [newOrder[0], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[0]];
          }
          order = newOrder;
          currentIdx = 0;
        } else {
          currentIdx = order.length - 1;
          pause();
          showAt(currentIdx);
          return;
        }
      }
      showAt(currentIdx);
    }

    function prevImage(){
      currentIdx--;
      if (currentIdx < 0) {
        if (loopToggle.checked) {
          order = shuffleArray(images.map((_,i)=>i));
          currentIdx = order.length - 1;
        } else {
          currentIdx = 0;
        }
      }
      showAt(currentIdx);
    }

    function startTimer(){
      stopTimer();
      const seconds = parseFloat(speedRange.value) || 5;
      timer = setInterval(nextImage, seconds * 1000);
      playing = true;
      playPauseBtn.textContent = '⏸';
      // Tentative de lancer l'audio en même temps
      if (audioEl.src && !audioEl.dataset.manualPause) {
        audioEl.play().catch((e) => {
          // si la lecture est bloquée, on la note et on ne spammera pas les erreurs
          console.warn('Audio playback blocked or failed:', e);
        });
      }
    }

    function stopTimer(){
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      playing = false;
      playPauseBtn.textContent = '⏵';
    }

    function pause(){
      stopTimer();
    }

    function play(){
      startTimer();
    }

    function togglePlayPause(){
      if (playing) {
        pause();
      } else {
        // Si l'utilisateur clique sur lecture, on considère que c'est un geste utilisateur : autoriser l'audio
        delete audioEl.dataset.manualPause;
        play();
      }
    }

    function restartTimerIfPlaying(){
      if (playing) {
        startTimer();
      }
    }

    // Gestion des événements sur audio : si l'utilisateur met en pause, on évite de relancer automatiquement
    audioEl.addEventListener('pause', ()=> audioEl.dataset.manualPause = "true");
    audioEl.addEventListener('play', ()=> delete audioEl.dataset.manualPause);

  }).catch((err) => {
    console.error('filmsData introuvable ou js/films.generated.js absent :', err);
    document.body.innerHTML = `
      <main class="container" style="padding:24px;">
        <h2>Erreur : données films introuvables</h2>
        <p>Le script n'a pas trouvé les données des films (variable <code>window.filmsData</code>).</p>
        <p>Génère ou inclus <code>js/films.generated.js</code> (ou ton fichier films) et assure-toi qu'il est accessible à l'URL <code>js/films.generated.js</code>.</p>
        <p><a href="index.html">Retour</a></p>
      </main>
    `;
  });

})();