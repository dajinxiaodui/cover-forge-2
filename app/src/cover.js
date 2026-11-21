// Cover Forge's cover engine: lays photos into the panels of a multi-panel poster, grades every panel with a
// Vice City colour treatment, and letters the caption in heavy outlined poster type over a dusk scrim.
// Pure canvas 2D, no libraries and no network: the same state always draws the same cover, byte for byte.

export const LAYOUTS = [
  { id: 'hero-side', name: 'Hero + 2', blurb: 'One tall hero panel, two stacked beside it' },
  { id: 'hero-top', name: 'Hero + 3', blurb: 'A wide hero panel over a row of three' },
  { id: 'grid', name: '2 x 2 grid', blurb: 'Four equal panels' },
  { id: 'trio', name: 'Triptych', blurb: 'Three full-height strips' },
];

export const STYLES = [
  { id: 'sunset', name: 'Sunset', blurb: 'Amber sky melting into magenta dusk' },
  { id: 'neon', name: 'Neon night', blurb: 'Cyan and hot pink over deep blue dark' },
  { id: 'retro', name: 'Retro print', blurb: 'Faded sepia, lifted blacks, paper grain' },
];

export const SIZES = [
  { id: 'square', name: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', name: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

// Each layout as panel rectangles in fractions of the cover: [left, top, width, height].
const PANEL_FRACTIONS = {
  'hero-side': [
    [0, 0, 0.62, 1],
    [0.62, 0, 0.38, 0.5],
    [0.62, 0.5, 0.38, 0.5],
  ],
  'hero-top': [
    [0, 0, 1, 0.58],
    [0, 0.58, 1 / 3, 0.42],
    [1 / 3, 0.58, 1 / 3, 0.42],
    [2 / 3, 0.58, 1 / 3, 0.42],
  ],
  grid: [
    [0, 0, 0.5, 0.5],
    [0.5, 0, 0.5, 0.5],
    [0, 0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5],
  ],
  trio: [
    [0, 0, 1 / 3, 1],
    [1 / 3, 0, 1 / 3, 1],
    [2 / 3, 0, 1 / 3, 1],
  ],
};

/** How many panels a layout has. */
export function panelCount(layoutId) {
  return (PANEL_FRACTIONS[layoutId] ?? PANEL_FRACTIONS['hero-top']).length;
}

/** The panels of a layout at a cover of w x h pixels, inset by the black gutter GTA covers separate panels with. */
export function panelRects(layoutId, w, h) {
  const fractions = PANEL_FRACTIONS[layoutId] ?? PANEL_FRACTIONS['hero-top'];
  const gutter = Math.max(6, Math.round(Math.min(w, h) * 0.011));
  return fractions.map(([fx, fy, fw, fh]) => ({
    x: Math.round(fx * w + gutter / 2),
    y: Math.round(fy * h + gutter / 2),
    w: Math.round(fw * w - gutter),
    h: Math.round(fh * h - gutter),
  }));
}

/**
 * How a photo sits inside a panel: the cover-fit scale at the panel's zoom, the drawn size, and the slack the
 * panel's offsets (ox, oy in -1..1) can spend before an edge of the photo would show.
 */
export function photoFit(img, rect, zoom) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  return { dw, dh, slackX: Math.max(0, (dw - rect.w) / 2), slackY: Math.max(0, (dh - rect.h) / 2) };
}

/** Draws one photo into one panel at the panel's zoom and offsets, clipped to the panel. */
function drawPanelPhoto(ctx, img, rect, panel) {
  const { dw, dh, slackX, slackY } = photoFit(img, rect, panel.zoom);
  const dx = rect.x + (rect.w - dw) / 2 + panel.ox * slackX;
  const dy = rect.y + (rect.h - dh) / 2 + panel.oy * slackY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** A panel with no photo yet: a dusk gradient, a low sun and room for the words YOUR PHOTO HERE. */
function drawEmptyPanel(ctx, rect, styleId) {
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  if (styleId === 'neon') {
    sky.addColorStop(0, '#101d42');
    sky.addColorStop(0.6, '#3b1158');
    sky.addColorStop(1, '#12081f');
  } else if (styleId === 'retro') {
    sky.addColorStop(0, '#caa26a');
    sky.addColorStop(0.6, '#a9764f');
    sky.addColorStop(1, '#5f4230');
  } else {
    sky.addColorStop(0, '#ff9e4f');
    sky.addColorStop(0.55, '#e84a7a');
    sky.addColorStop(1, '#4a1445');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.22;
  const sun = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h * 0.42, 0, rect.x + rect.w / 2, rect.y + rect.h * 0.42, sunR);
  sun.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  sun.addColorStop(0.7, 'rgba(255, 190, 90, 0.55)');
  sun.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const size = Math.max(13, Math.min(rect.w, rect.h) * 0.055);
  ctx.font = `700 ${size}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16, 6, 14, 0.85)';
  ctx.lineWidth = size * 0.16;
  const label = 'YOUR PHOTO HERE';
  ctx.strokeText(label, rect.x + rect.w / 2, rect.y + rect.h * 0.72);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h * 0.72);
  ctx.textBaseline = 'alphabetic';
}

// A fixed-seed grain tile for the retro print grade: the same pseudo-random specks on every run and machine.
let grainTile = null;
function grainPattern(ctx) {
  if (grainTile === null) {
    grainTile = document.createElement('canvas');
    grainTile.width = 128;
    grainTile.height = 128;
    const g = grainTile.getContext('2d');
    const data = g.createImageData(128, 128);
    let seed = 987654321;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(next() * 255);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    g.putImageData(data, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}

/** The colour grade of one style, painted over one panel's photo while clipped to that panel. */
function gradePanel(ctx, rect, styleId) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const vertical = (stops) => {
    const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    for (const [at, colour] of stops) grad.addColorStop(at, colour);
    return grad;
  };
  if (styleId === 'neon') {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = vertical([[0, 'rgba(0, 229, 255, 0.55)'], [0.5, 'rgba(90, 0, 200, 0.18)'], [1, 'rgba(255, 0, 128, 0.6)']]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(7, 9, 40, 0.22)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = vertical([[0, 'rgba(0, 0, 0, 0)'], [0.75, 'rgba(0, 0, 0, 0)'], [1, 'rgba(2, 0, 18, 0.35)']]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (styleId === 'retro') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(198, 146, 76, 0.34)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255, 230, 185, 0.16)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = vertical([[0, 'rgba(70, 48, 24, 0.12)'], [1, 'rgba(46, 30, 16, 0.22)']]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    // Sunset, the default Vice City grade.
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = vertical([[0, 'rgba(255, 176, 66, 0.6)'], [0.45, 'rgba(255, 94, 98, 0.16)'], [1, 'rgba(214, 38, 132, 0.62)']]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = vertical([[0, 'rgba(255, 255, 255, 0.5)'], [0.4, 'rgba(255, 255, 255, 0)']]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = vertical([[0.6, 'rgba(24, 0, 34, 0)'], [1, 'rgba(24, 0, 34, 0.28)']]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  // A vignette seats every panel into the poster, strongest on the retro print.
  const vig = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.36,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.78,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, styleId === 'retro' ? 'rgba(20, 10, 4, 0.42)' : 'rgba(5, 0, 12, 0.3)');
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** The caption fitted to at most two lines: returns its lines and the font size they share. */
function fitCaption(ctx, text, maxWidth, startSize) {
  const words = text.split(/\s+/).filter(Boolean);
  let size = startSize;
  const setFont = () => { ctx.font = `900 ${size}px "Arial Black", "Archivo Black", Impact, "Franklin Gothic Heavy", sans-serif`; };
  setFont();
  const fits = (line) => ctx.measureText(line).width <= maxWidth;
  while (size > 14) {
    if (words.length === 1 || fits(words.join(' '))) return { lines: [words.join(' ')], size };
    // Try every split into two lines and keep the most balanced one that fits.
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      if (fits(a) && fits(b)) {
        const score = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
        if (best === null || score < best.score) best = { lines: [a, b], score };
      }
    }
    if (best !== null) return { lines: best.lines, size };
    size -= 4;
    setFont();
  }
  return { lines: [words.join(' ')], size };
}

/** The caption block: a dusk scrim, an italic tagline, the heavy outlined title and its neon underline. */
function drawCaptionBlock(ctx, w, h, state) {
  const scrim = ctx.createLinearGradient(0, h * 0.55, 0, h);
  scrim.addColorStop(0, 'rgba(9, 3, 17, 0)');
  scrim.addColorStop(0.55, 'rgba(9, 3, 17, 0.55)');
  scrim.addColorStop(1, 'rgba(9, 3, 17, 0.9)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  const caption = (state.caption ?? '').trim().toUpperCase();
  const tagline = (state.tagline ?? '').trim();
  const centre = w / 2;
  let cursor = h - h * 0.045; // baseline of the lowest element, built upward

  if (caption) {
    const { lines, size } = fitCaption(ctx, caption, w * 0.92, h * 0.115);
    const barW = Math.min(w * 0.92, Math.max(...lines.map((line) => ctx.measureText(line).width)) * 0.55);
    const barH = Math.max(4, size * 0.075);
    const bar = ctx.createLinearGradient(centre - barW / 2, 0, centre + barW / 2, 0);
    if (state.style === 'neon') {
      bar.addColorStop(0, '#00e5ff');
      bar.addColorStop(1, '#ff2e88');
    } else if (state.style === 'retro') {
      bar.addColorStop(0, '#e8b34b');
      bar.addColorStop(1, '#c96f2e');
    } else {
      bar.addColorStop(0, '#ffb347');
      bar.addColorStop(1, '#ff2e88');
    }
    ctx.fillStyle = bar;
    ctx.fillRect(centre - barW / 2, cursor - barH, barW, barH);
    cursor -= barH + size * 0.28;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    const lineStep = size * 1.04;
    for (let i = lines.length - 1; i >= 0; i--) {
      const y = cursor - (lines.length - 1 - i) * lineStep;
      ctx.strokeStyle = '#150812';
      ctx.lineWidth = size * 0.17;
      ctx.strokeText(lines[i], centre, y);
      const face = ctx.createLinearGradient(0, y - size, 0, y);
      face.addColorStop(0, '#ffffff');
      face.addColorStop(0.75, '#fdf3ff');
      face.addColorStop(1, '#ffd9ec');
      ctx.fillStyle = face;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = size * 0.1;
      ctx.shadowOffsetY = size * 0.035;
      ctx.fillText(lines[i], centre, y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    cursor -= lines.length * lineStep;
  }

  if (tagline) {
    const size = Math.max(14, h * 0.027);
    ctx.font = `italic 600 ${size}px Georgia, "Times New Roman", serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.08)}px`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(12, 4, 10, 0.9)';
    ctx.lineWidth = size * 0.14;
    const y = cursor + size * 0.4;
    ctx.strokeText(tagline, centre, y);
    ctx.fillStyle = state.style === 'retro' ? '#ffd98f' : '#ff7ab5';
    ctx.fillText(tagline, centre, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
}

/** A thin style-coloured frame line just inside the cover's edge, as on a printed poster. */
function drawFrameLine(ctx, w, h, styleId) {
  const inset = Math.max(3, Math.round(Math.min(w, h) * 0.006));
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (styleId === 'neon') {
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.9)');
    grad.addColorStop(1, 'rgba(255, 46, 136, 0.9)');
  } else if (styleId === 'retro') {
    grad.addColorStop(0, 'rgba(232, 179, 75, 0.85)');
    grad.addColorStop(1, 'rgba(160, 92, 40, 0.85)');
  } else {
    grad.addColorStop(0, 'rgba(255, 179, 71, 0.9)');
    grad.addColorStop(1, 'rgba(255, 46, 136, 0.9)');
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
}

/** The editor-only marker on the selected panel: never drawn on an export. */
function drawSelection(ctx, rect, index) {
  ctx.save();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
  ctx.setLineDash([]);
  const label = `PANEL ${index + 1}`;
  ctx.font = '700 15px system-ui, sans-serif';
  const tw = ctx.measureText(label).width + 18;
  ctx.fillStyle = 'rgba(4, 10, 18, 0.88)';
  ctx.fillRect(rect.x, rect.y, tw, 26);
  ctx.fillStyle = '#aef4ff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + 9, rect.y + 14);
  ctx.restore();
}

/**
 * Draws the whole cover described by `state` onto the canvas at the canvas's own size.
 * state: { photos: [image], layout, style, caption, tagline, panels: [{ photo, zoom, ox, oy }] }.
 * options.forExport drops the editor's selection marker; options.selected names the marked panel.
 */
export function drawCover(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#0b0512';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = state.photos[panel.photo] ?? state.photos[0] ?? null;
    if (img) drawPanelPhoto(ctx, img, rect, panel);
    else drawEmptyPanel(ctx, rect, state.style);
    gradePanel(ctx, rect, state.style);
  });
  drawCaptionBlock(ctx, w, h, state);
  drawFrameLine(ctx, w, h, state.style);
  if (!options.forExport && Number.isInteger(options.selected) && rects[options.selected]) {
    drawSelection(ctx, rects[options.selected], options.selected);
  }
}
