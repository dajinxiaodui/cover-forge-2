// Cover Forge's page wiring: photo loading (files, drag and drop, the bundled samples), the layout, style and
// size pickers, per-panel crop and position editing on the preview, the caption fields and the PNG export.
// A `?shot=` query hands control to ./shots.js, which sets up a fixed scene for a screenshot instead.
import { LAYOUTS, SIZES, STYLES, drawCover, panelCount, panelRects, photoFit } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const taglineInput = document.getElementById('tagline');
const status = document.getElementById('status');
const strip = document.getElementById('strip');
const zoomInput = document.getElementById('zoom');
const panelLabel = document.getElementById('panel-label');

const state = {
  photos: [], // loaded images, in the order they were added
  photoNames: [], // a short label per photo, for the panel picker
  layout: 'hero-top',
  style: 'sunset',
  size: 'wide',
  caption: 'Vice Nights',
  tagline: 'welcome back to the coast',
  panels: [], // one { photo, zoom, ox, oy } per panel of the current layout
  selected: 0,
};

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Keeps the panel list matched to the layout: new panels spread across the photos, old ones keep their crop. */
function ensurePanels() {
  const count = panelCount(state.layout);
  while (state.panels.length < count) {
    const i = state.panels.length;
    state.panels.push({ photo: state.photos.length ? i % state.photos.length : 0, zoom: 1, ox: 0, oy: 0 });
  }
  state.panels.length = count;
  for (const panel of state.panels) {
    panel.photo = state.photos.length ? Math.min(panel.photo, state.photos.length - 1) : 0;
    panel.zoom = Math.min(4, Math.max(1, panel.zoom));
    panel.ox = Math.min(1, Math.max(-1, panel.ox));
    panel.oy = Math.min(1, Math.max(-1, panel.oy));
  }
  state.selected = Math.min(state.selected, count - 1);
}

/** Paints the preview at the chosen export size, with the selected panel marked. */
function redraw() {
  ensurePanels();
  drawCover(canvas, state, { selected: state.selected });
  syncPanelControls();
}

/** Adds an image to the photo list and rebuilds the thumbnail strip. */
function addPhoto(img, name) {
  state.photos.push(img);
  state.photoNames.push(name);
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'thumb';
  thumb.title = `${name} — send to the selected panel`;
  const pic = document.createElement('img');
  pic.src = img.src;
  pic.alt = name;
  const badge = document.createElement('span');
  badge.textContent = String(state.photos.length);
  thumb.append(pic, badge);
  thumb.addEventListener('click', () => {
    state.panels[state.selected].photo = state.photos.length - 1;
    redraw();
  });
  strip.append(thumb);
  // Panels are (re)built by redraw's ensurePanels once a whole batch of photos is in, so a batch
  // spreads across the panels instead of every panel landing on the first photo loaded.
}

/** Loads the bundled sample photos by name ('pier', 'boulevard'), in order. */
async function loadSamples(names) {
  for (const name of names) {
    const img = await loadImage(`samples/${name}.jpg`);
    addPhoto(img, name === 'pier' ? 'Sample: the pier' : 'Sample: the boulevard');
  }
}

/** Reads the person's own image files from disk; the photos never leave the machine. */
async function loadFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const img = await loadImage(URL.createObjectURL(file));
    addPhoto(img, file.name);
  }
  redraw();
  status.textContent = state.photos.length ? `${state.photos.length} photo(s) loaded — pick a layout and export.` : '';
}

document.getElementById('file').addEventListener('change', (e) => {
  loadFiles([...e.target.files]);
  e.target.value = '';
});
for (const btn of document.querySelectorAll('[data-sample]')) {
  btn.addEventListener('click', async () => {
    await loadSamples([btn.dataset.sample]);
    redraw();
  });
}

const drop = document.getElementById('drop');
for (const event of ['dragenter', 'dragover']) {
  drop.addEventListener(event, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
}
for (const event of ['dragleave', 'drop']) {
  drop.addEventListener(event, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  });
}
drop.addEventListener('drop', (e) => loadFiles([...e.dataTransfer.files]));

/** Builds a row of picker buttons (layouts, styles, sizes) from a list, marking the current choice. */
function buildPicker(elementId, items, get, set) {
  const host = document.getElementById(elementId);
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt';
    btn.dataset.value = item.id;
    const name = document.createElement('strong');
    name.textContent = item.name;
    btn.append(name);
    if (item.blurb) {
      const blurb = document.createElement('span');
      blurb.textContent = item.blurb;
      btn.append(blurb);
    }
    btn.addEventListener('click', () => set(item.id));
    host.append(btn);
  }
  const sync = () => {
    for (const btn of host.children) btn.classList.toggle('on', btn.dataset.value === get());
  };
  sync();
  return sync;
}

const syncLayouts = buildPicker('layouts', LAYOUTS, () => state.layout, (id) => {
  state.layout = id;
  state.selected = 0;
  syncLayouts();
  redraw();
});
const syncStyles = buildPicker('styles', STYLES, () => state.style, (id) => {
  state.style = id;
  syncStyles();
  redraw();
});
const syncSizes = buildPicker('sizes', SIZES, () => state.size, (id) => {
  state.size = id;
  const size = SIZES.find((s) => s.id === id);
  canvas.width = size.w;
  canvas.height = size.h;
  syncSizes();
  redraw();
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
taglineInput.addEventListener('input', () => {
  state.tagline = taglineInput.value;
  redraw();
});

/** The selected panel's controls: its number, the photo filling it and its zoom. */
function syncPanelControls() {
  const panel = state.panels[state.selected];
  if (!panel) return;
  const name = state.photoNames[panel.photo] ?? 'no photo yet';
  panelLabel.textContent = `Panel ${state.selected + 1} of ${state.panels.length} — ${name}`;
  zoomInput.value = String(panel.zoom);
}

document.getElementById('panel-photo-prev').addEventListener('click', () => cyclePanelPhoto(-1));
document.getElementById('panel-photo-next').addEventListener('click', () => cyclePanelPhoto(1));
function cyclePanelPhoto(step) {
  if (!state.photos.length) return;
  const panel = state.panels[state.selected];
  panel.photo = (panel.photo + step + state.photos.length) % state.photos.length;
  redraw();
}

zoomInput.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomInput.value);
  redraw();
});
document.getElementById('spread').addEventListener('click', () => {
  state.panels.forEach((panel, i) => {
    if (state.photos.length) panel.photo = i % state.photos.length;
  });
  redraw();
});
document.getElementById('same').addEventListener('click', () => {
  const first = state.panels[state.selected]?.photo ?? 0;
  state.panels.forEach((panel) => { panel.photo = first; });
  redraw();
});
document.getElementById('reset-panel').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
});

// Dragging on the preview repositions the selected panel's photo; the wheel zooms it.
let drag = null;
function canvasPoint(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - box.left) * (canvas.width / box.width),
    y: (e.clientY - box.top) * (canvas.height / box.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const point = canvasPoint(e);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const hit = rects.findIndex((r) => point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h);
  if (hit >= 0) state.selected = hit;
  drag = { x: point.x, y: point.y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const point = canvasPoint(e);
  const panel = state.panels[state.selected];
  const img = state.photos[panel.photo] ?? state.photos[0];
  if (img) {
    const rect = panelRects(state.layout, canvas.width, canvas.height)[state.selected];
    const { slackX, slackY } = photoFit(img, rect, panel.zoom);
    if (slackX > 0) panel.ox = Math.min(1, Math.max(-1, panel.ox + (point.x - drag.x) / slackX));
    if (slackY > 0) panel.oy = Math.min(1, Math.max(-1, panel.oy + (point.y - drag.y) / slackY));
  }
  drag = point;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.min(4, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  redraw();
}, { passive: false });

/** Renders the cover at full size on an offscreen canvas and downloads it as a PNG. */
document.getElementById('export').addEventListener('click', () => {
  const size = SIZES.find((s) => s.id === state.size);
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, { forExport: true });
  off.toBlob((blob) => {
    const slug = state.caption.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cover';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-forge-${slug}-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved cover-forge-${slug}-${size.w}x${size.h}.png`;
  }, 'image/png');
});

/** What ./shots.js drives: load sample photos, set any field, repaint. */
const shotApi = {
  async loadPhotos(names) {
    await loadSamples(names);
  },
  configure(patch) {
    Object.assign(state, patch);
    if (patch.caption !== undefined) captionInput.value = patch.caption;
    if (patch.tagline !== undefined) taglineInput.value = patch.tagline;
    const size = SIZES.find((s) => s.id === state.size);
    canvas.width = size.w;
    canvas.height = size.h;
    syncLayouts();
    syncStyles();
    syncSizes();
  },
  /** Applies per-panel framing from a shot scene: a list of { photo, zoom, ox, oy } by panel index. */
  setPanels(list) {
    ensurePanels();
    list.forEach((patch, i) => {
      if (state.panels[i]) Object.assign(state.panels[i], patch);
    });
  },
  /** Paints the cover exactly as an export: no editor selection marker. Used by the ?shot=cover scene. */
  redrawCover() {
    ensurePanels();
    drawCover(canvas, state, { forExport: true });
  },
  redraw,
};

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), shotApi);
} else {
  loadSamples(['pier', 'boulevard']).then(redraw);
}
