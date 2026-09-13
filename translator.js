let draconicDict = {};
const DRACONIC_DICT_VERSION = "v4";
const DRACONIC_DICT_KEY = `draconicDict_${DRACONIC_DICT_VERSION}`;

/* =========================
   LOAD + CACHE DICTIONARY
========================= */
async function loadDictionary() {
  const cached = localStorage.getItem(DRACONIC_DICT_KEY);

  if (cached) {
    try {
      draconicDict = JSON.parse(cached);
      return;
    } catch (e) {
      localStorage.removeItem(DRACONIC_DICT_KEY);
    }
  }

  const res = await fetch("https://cdn.jsdelivr.net/gh/lorna-e-o/draconic-dictionary/Draconic-Dictionary.json?v=4");
  draconicDict = await res.json();

  localStorage.setItem(DRACONIC_DICT_KEY, JSON.stringify(draconicDict));
}

/* =========================
   TEXT NORMALIZATION
========================= */
function normalizeTextForTranslation(str) {
  return String(str)
    // Normalize smart quotes before contraction expansion and word matching.
    // This catches cases like ”Take where a closing curly quote is used as an opener.
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

    // Normalize word-processor dashes.
    .replace(/[–—]/g, "-");
}

/* =========================
   CONTRACTIONS
========================= */
const contractionMap = {
  "don't": "do not",
  "can't": "can not",
  "won't": "will not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "wouldn't": "would not",
  "shouldn't": "should not",
  "couldn't": "could not",
  "doesn't": "does not",
  "didn't": "did not",
  "i'm": "i am",
  "you're": "you are",
  "they're": "they are",
  "we're": "we are",
  "it's": "it is",
  "that's": "that is",
  "there's": "there is",
  "what's": "what is",
  "let's": "let us"
};

function expandContractions(text) {
  return text.replace(/\b[\w']+\b/gi, word => {
    const lower = word.toLowerCase();

    if (contractionMap[lower]) {
      const expanded = contractionMap[lower];

      if (word[0] === word[0].toUpperCase()) {
        return expanded.charAt(0).toUpperCase() + expanded.slice(1);
      }

      return expanded;
    }

    return word;
  });
}

/* =========================
   CAPITALIZATION
========================= */
function matchCapitalization(original, translated) {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return translated.toUpperCase();
  }

  if (
    original.charAt(0) === original.charAt(0).toUpperCase() &&
    original.slice(1) === original.slice(1).toLowerCase()
  ) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  return translated;
}

/* =========================
   SAFE HTML
========================= */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&" + "#039;");
}

/* =========================
   WORD TRANSLATION
========================= */
function translateWordToken(word) {
  const lower = word.toLowerCase();

  // direct match
  if (draconicDict[lower]) {
    return escapeHTML(matchCapitalization(word, draconicDict[lower]));
  }

  // possessive handling
  const possessive = word.match(/^([A-Za-z]+)(?:'s|s')$/i);
  if (possessive) {
    const base = possessive[1];
    const baseLower = base.toLowerCase();

    if (draconicDict[baseLower]) {
      const translated = matchCapitalization(base, draconicDict[baseLower]);
      return `<span class="draconic-approx">${escapeHTML(translated)}</span>`;
    }

    return `<span class="draconic-missing">${escapeHTML(word)}</span>`;
  }

  // fallback
  return `<span class="draconic-missing">${escapeHTML(word)}</span>`;
}

/* =========================
   FULL TRANSLATION
========================= */
function translateDraconicToHTML(text) {
  const normalized = normalizeTextForTranslation(text);
  const expanded = expandContractions(normalized);

  return expanded.split(/(\s+)/).map(part => {

    if (/^\s+$/.test(part)) return part;

    const match = part.match(/^([("'\[\{]*)([A-Za-z]+(?:'s|s')?)([.,!?;:)"'\]\}]*)$/);

    if (!match) return escapeHTML(part);

    const open = match[1] || "";
    const core = match[2] || "";
    const close = match[3] || "";

    const translated = translateWordToken(core);

    return escapeHTML(open) + translated + escapeHTML(close);

  }).join("");
}

/* =========================
   APPLY TO ELEMENTS
========================= */
function applyDraconic(scope = document) {
  scope.querySelectorAll(".translate-trigger.draconic").forEach(el => {
    if (el.dataset.draconicReady) return;

    const english = el.getAttribute("data-translate") || el.textContent.trim();
    const translatedHTML = translateDraconicToHTML(english);

    const target = el.firstElementChild || el;
    target.innerHTML = translatedHTML;

    el.dataset.draconicReady = "true";
  });
}

function applyAutoDraconicVariants(scope = document) {
  scope.querySelectorAll(".lockheed, .emberoath, .kittylock").forEach(el => {
    if (el.dataset.autoDraconicReady) return;
    if (el.closest(".translate-trigger.draconic")) return;

    const english = el.textContent.trim();
    if (!english) return;

    el.classList.add("translate-trigger", "draconic");
    el.setAttribute("data-translate", english);
    el.innerHTML = translateDraconicToHTML(english);

    el.dataset.autoDraconicReady = "true";
    el.dataset.draconicReady = "true";
  });
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadDictionary();

  applyDraconic();
  applyAutoDraconicVariants();

  new MutationObserver(() => {
    applyDraconic();
    applyAutoDraconicVariants();
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
});
