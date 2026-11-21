// Fixed scenes for screenshots: ?shot=editor shows the whole app with sample photos loaded and a finished cover
// in the preview; ?shot=cover shows only the cover itself, painted exactly as an export at the requested size.
// `photos` picks the samples in order (samples/<name>.jpg); `caption`, `tagline`, `layout`, `style` and `size`
// set the scene; `panels` frames individual panels as photo,zoom,ox,oy tuples separated by semicolons.
// window.__shotReady is set once the scene has painted.
export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const names = (query.get('photos') ?? 'pier').split(',').map((s) => s.trim()).filter(Boolean);
  await api.loadPhotos(names);
  api.configure({
    caption: query.get('caption') ?? 'Vice Nights',
    tagline: query.get('tagline') ?? 'welcome back to the coast',
    layout: query.get('layout') ?? 'hero-top',
    style: query.get('style') ?? 'sunset',
    size: query.get('size') ?? 'wide',
  });
  const panels = query.get('panels');
  if (panels) {
    api.setPanels(panels.split(';').map((tuple) => {
      const [photo, zoom, ox, oy] = tuple.split(',').map(Number);
      return { photo: photo || 0, zoom: zoom || 1, ox: ox || 0, oy: oy || 0 };
    }));
  }
  if (shot === 'cover') api.redrawCover();
  else api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
