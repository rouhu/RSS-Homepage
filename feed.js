'use strict';

const language = chrome.i18n.getUILanguage();
const spanish = language.toLowerCase().startsWith('es');
const labels = spanish
  ? { title: 'Tu resumen', latest: 'LO ÚLTIMO', top: 'Noticias destacadas', refresh: 'Actualizar', loading: 'Cargando noticias…', empty: 'No hay noticias disponibles.' }
  : { title: 'Your briefing', latest: 'THE LATEST', top: 'Top stories', refresh: 'Refresh', loading: 'Loading headlines…', empty: 'No stories are available.' };
const params = new URLSearchParams({ hl: spanish ? 'es' : 'en-US', gl: spanish ? 'ES' : 'US', ceid: spanish ? 'ES:es' : 'US:en' });
const feed = document.getElementById('feed');
const status = document.getElementById('status');
const refresh = document.getElementById('refresh');
document.documentElement.lang = language;
document.title = labels.title;
document.getElementById('widget-label').textContent = labels.latest;
document.getElementById('section-title').textContent = labels.top;
refresh.textContent = labels.refresh;
refresh.title = `https://news.google.com/rss?${params}`;
document.getElementById('date').textContent = new Intl.DateTimeFormat(language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

async function loadNews() {
  refresh.disabled = true;
  status.textContent = labels.loading;
  feed.replaceChildren();
  try {
    const response = await fetch(`https://news.google.com/rss?${params}`, { credentials: 'omit' });
    if (!response.ok) throw new Error(chrome.i18n.getMessage('failed_to_fetch_rss'));
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.querySelector('parsererror') || !xml.querySelector('channel')) throw new Error(chrome.i18n.getMessage('not_a_valid_feed'));
    for (const story of Array.from(xml.querySelectorAll('item')).slice(0, googleCount)) {
      let url;
      try { url = new URL(story.querySelector('link')?.textContent); } catch { continue; }
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      const source = story.querySelector('source')?.textContent || 'Google News';
      const rawTitle = story.querySelector('title')?.textContent || chrome.i18n.getMessage('unknown_title');
      const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -source.length - 3) : rawTitle;
      const article = document.createElement('article');
      article.className = 'story';
      const content = document.createElement('div');
      content.className = 'story-content';
      const publisher = document.createElement('p'); publisher.className = 'source'; publisher.textContent = source;
      const heading = document.createElement('h3');
      const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = title;
      heading.append(link); content.append(publisher, heading);
      const date = new Date(story.querySelector('pubDate')?.textContent);
      if (!Number.isNaN(date.valueOf())) {
        const time = document.createElement('time'); time.dateTime = date.toISOString(); time.textContent = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date); content.append(time);
      }
      article.append(content);
      feed.append(article);
    }
    status.textContent = feed.children.length ? '' : labels.empty;
  } catch (error) {
    status.textContent = chrome.i18n.getMessage('error', error.message || chrome.i18n.getMessage('failed_to_fetch_rss'));
  } finally { refresh.disabled = false; }
}
refresh.addEventListener('click', loadNews);

const rssText = spanish
  ? { addTitle: 'Añadir un widget RSS', label: 'URL del feed RSS', add: 'Añadir widget', remove: 'Eliminar', invalid: 'Introduce una URL HTTP o HTTPS válida.', denied: 'Se necesita permiso para acceder a este feed.', duplicate: 'Este feed ya está añadido.', failed: 'No se pudo cargar el feed. Comprueba la URL y los permisos.', invalidFeed: 'El contenido no es un feed RSS o Atom válido.' }
  : { addTitle: 'Add an RSS widget', label: 'RSS feed URL', add: 'Add widget', remove: 'Remove', invalid: 'Enter a valid HTTP or HTTPS URL.', denied: 'Permission to access this feed is required.', duplicate: 'This feed has already been added.', failed: 'Could not load the feed. Check its URL and permissions.', invalidFeed: 'The response is not a valid RSS or Atom feed.' };
const rssForm = document.getElementById('rss-form');
const rssUrl = document.getElementById('rss-url');
const rssFormStatus = document.getElementById('rss-form-status');
const widgetGrid = document.getElementById('widget-grid');
document.getElementById('add-title').textContent = rssText.addTitle;
document.getElementById('rss-label').textContent = rssText.label;
document.getElementById('add-rss').textContent = rssText.add;
let customFeeds = [];
let googleCount = 12;
let googleEnabled = true;
let googlePosition = 0;
let layout = [];
let dragging = null;
let saveQueue = Promise.resolve();
const gridText = spanish
  ? { posts: 'Noticias', save: 'Guardar', drag: 'Mover widget: usa las flechas', empty: 'Soltar widget aquí', saved: 'Configuración guardada.', invalid: 'Elige entre 1 y 50 noticias.' }
  : { posts: 'Posts', save: 'Save', drag: 'Move widget: use arrow keys', empty: 'Drop widget here', saved: 'Settings saved.', invalid: 'Choose between 1 and 50 posts.' };
document.querySelector('.count-label').firstChild.textContent = `${gridText.posts} `;
function validCount(value) { const count = Number(value); return Number.isInteger(count) && count >= 1 && count <= 50; }
function persistSettings() {
  const data = { customFeeds: customFeeds.map(item => ({ ...item })), googleCount, googleEnabled, googlePosition, widgetLayout: [...layout] };
  saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set(data));
  return saveQueue;
}

function drawGrid() {
  const widgets = new Map(Array.from(widgetGrid.querySelectorAll(':scope > .widget')).map(widget => [widget.dataset.widgetId, widget]));
  layout = layout.map(id => widgets.has(id) ? id : null);
  for (const id of widgets.keys()) if (!layout.includes(id)) layout.push(id);
  while (layout.length && layout[layout.length - 1] === null) layout.pop();
  // Keep a blank row available so widgets can be moved to empty positions.
  const total = Math.max(4, Math.ceil((layout.length + 1) / 2) * 2);
  const nodes = [];
  for (let index = 0; index < total; index++) {
    const node = widgets.get(layout[index]) || document.createElement('div');
    if (!widgets.has(layout[index])) { node.className = 'widget-slot'; node.textContent = gridText.empty; node.setAttribute('aria-hidden', 'true'); }
    node.dataset.slot = String(index);
    nodes.push(node);
  }
  widgetGrid.replaceChildren(...nodes);
}

function moveWidget(id, target) {
  const from = layout.indexOf(id);
  if (from < 0 || target < 0 || target === from) return;
  while (layout.length <= target) layout.push(null);
  [layout[from], layout[target]] = [layout[target], layout[from]];
  if (layout.includes('google-news')) googlePosition = layout.indexOf('google-news');
  drawGrid();
  persistSettings().catch(() => { rssFormStatus.textContent = rssText.failed; });
}

function setupWidget(section, id, initialCount, onSave) {
  section.dataset.widgetId = id;
  const handle = document.createElement('div'); handle.className = 'drag-handle'; handle.draggable = true;
  handle.tabIndex = 0; handle.setAttribute('role', 'button'); handle.setAttribute('aria-label', gridText.drag); handle.title = gridText.drag;
  handle.addEventListener('dragstart', event => { dragging = id; section.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); });
  handle.addEventListener('dragend', () => { dragging = null; section.classList.remove('dragging'); widgetGrid.querySelectorAll('.drag-over').forEach(node => node.classList.remove('drag-over')); });
  handle.addEventListener('keydown', event => {
    const columns = getComputedStyle(widgetGrid).gridTemplateColumns.split(' ').length;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in offsets)) return;
    event.preventDefault(); moveWidget(id, layout.indexOf(id) + offsets[event.key]); handle.focus();
  });
  section.prepend(handle);
  const form = document.createElement('form'); form.className = 'widget-config';
  const label = document.createElement('label'); label.textContent = `${gridText.posts} `;
  const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '50'; input.required = true; input.value = String(initialCount);
  label.append(input);
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = gridText.save;
  const feedback = document.createElement('span'); feedback.setAttribute('role', 'status');
  form.append(label, save, feedback); section.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validCount(input.value)) { feedback.textContent = gridText.invalid; return; }
    save.disabled = true;
    try { await onSave(Number(input.value)); feedback.textContent = gridText.saved; }
    catch { feedback.textContent = rssText.failed; }
    finally { save.disabled = false; }
  });
}

widgetGrid.addEventListener('dragover', event => {
  const target = event.target.closest('[data-slot]');
  if (!dragging || !target || target.parentElement !== widgetGrid) return;
  event.preventDefault(); event.dataTransfer.dropEffect = 'move';
  widgetGrid.querySelectorAll('.drag-over').forEach(node => node.classList.remove('drag-over'));
  target.classList.add('drag-over');
});
widgetGrid.addEventListener('drop', event => {
  const target = event.target.closest('[data-slot]');
  if (!dragging || !target || target.parentElement !== widgetGrid) return;
  event.preventDefault(); target.classList.remove('drag-over'); moveWidget(dragging, Number(target.dataset.slot));
});

function feedOrigins(url) {
  const host = new URL(url).hostname;
  const origins = [`http://${host}/*`, `https://${host}/*`];
  // Yahoo's legacy RSS hostname redirects to a different hostname.
  if (host === 'rss.news.yahoo.com') origins.push('https://news.yahoo.com/*');
  if (host === 'newsrss.bbc.co.uk') origins.push('https://feeds.bbci.co.uk/*');
  return origins;
}

function safeUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function directChild(element, name) {
  return Array.from(element.children).find(child => child.localName.toLowerCase() === name.toLowerCase());
}

function opmlEntries(root, base) {
  const body = directChild(root, 'body');
  if (!body) return null;
  const entries = [];
  const seen = new Set();
  function visit(parent, groups) {
    for (const node of parent.children) {
      if (node.localName.toLowerCase() !== 'outline') continue;
      const name = (node.getAttribute('title') || node.getAttribute('text') || '').trim();
      const url = safeUrl(node.getAttribute('xmlUrl') || node.getAttribute('xmlurl'), base);
      if (url && !seen.has(url)) {
        seen.add(url);
        entries.push({ url, name: name || new URL(url).hostname, groups });
      }
      visit(node, !url && name ? [...groups, name] : groups);
    }
  }
  visit(body, []);
  return entries;
}

function renderOpml(root, base, config, section, stories, message) {
  const entries = opmlEntries(root, base);
  if (!entries) throw new Error(rssText.invalidFeed);
  const name = directChild(directChild(root, 'head') || root, 'title')?.textContent?.trim() || new URL(config.url).hostname;
  section.querySelector('h2').textContent = name;
  if (!entries.length) { message.textContent = spanish ? 'Este OPML no contiene feeds válidos.' : 'This OPML contains no valid feed URLs.'; return; }
  message.textContent = spanish ? `${entries.length} feeds encontrados. Selecciona uno para añadirlo como widget.` : `${entries.length} feeds found. Select one to add it as a widget.`;
  let shown = 0;
  const more = document.createElement('button'); more.type = 'button'; more.className = 'opml-more';
  function showPage() {
    more.remove();
    for (const entry of entries.slice(shown, shown + config.count)) {
      const article = document.createElement('article'); article.className = 'story opml-entry';
      const content = document.createElement('div'); content.className = 'story-content';
      if (entry.groups.length) { const group = document.createElement('p'); group.className = 'source'; group.textContent = entry.groups.join(' / '); content.append(group); }
      const heading = document.createElement('h3'); heading.textContent = entry.name;
      const address = document.createElement('p'); address.className = 'opml-url'; address.textContent = entry.url;
      content.append(heading, address);
      const add = document.createElement('button'); add.type = 'button'; add.textContent = spanish ? 'Añadir feed' : 'Add feed';
      add.addEventListener('click', () => { rssUrl.value = entry.url; rssUrl.focus(); rssUrl.scrollIntoView({ behavior: 'smooth', block: 'center' }); rssFormStatus.textContent = spanish ? 'Comprueba la URL y pulsa Añadir widget.' : 'Review the URL and select Add widget.'; });
      article.append(content, add); stories.append(article);
    }
    shown = Math.min(shown + config.count, entries.length);
    if (shown < entries.length) { more.textContent = spanish ? `Mostrar más (${entries.length - shown})` : `Show more (${entries.length - shown})`; stories.after(more); }
  }
  more.addEventListener('click', showPage);
  showPage();
}

function feedImage(item, base) {
  for (const node of item.getElementsByTagName('*')) {
    const name = node.localName.toLowerCase();
    const type = node.getAttribute('type') || '';
    if ((node.namespaceURI === 'http://search.yahoo.com/mrss/' && (name === 'thumbnail' || (name === 'content' && (node.getAttribute('medium') === 'image' || type.startsWith('image/'))))) || (name === 'enclosure' && type.startsWith('image/')) || (name === 'link' && node.getAttribute('rel') === 'enclosure' && type.startsWith('image/'))) {
      const url = safeUrl(node.getAttribute('url') || node.getAttribute('href'), base);
      if (url) return url;
    }
  }
  for (const name of ['description', 'content', 'summary']) {
    const html = directChild(item, name)?.textContent;
    if (!html) continue;
    // Neutralize resource attributes before parsing detached feed HTML.
    const inert = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<(?:link|iframe|source)\b[^>]*>/gi, '').replace(/\s(?:src|srcset)\s*=/gi, ' data-original-src=');
    const doc = new DOMParser().parseFromString(inert, 'text/html');
    const url = safeUrl(doc.querySelector('img[data-original-src]')?.getAttribute('data-original-src'), base);
    if (url) return url;
  }
  return '';
}

async function loadCustomFeed(config, section) {
  const stories = section.querySelector('.stories');
  const message = section.querySelector('.widget-status');
  const button = section.querySelector('.refresh-widget');
  button.disabled = true; message.textContent = labels.loading; stories.replaceChildren(); section.querySelector('.opml-more')?.remove();
  try {
    if (!await chrome.permissions.contains({ origins: feedOrigins(config.url) })) {
      message.textContent = spanish ? 'Pulsa Actualizar para conceder los permisos necesarios para este feed.' : 'Click Refresh to grant the permissions needed for this feed.';
      return;
    }
    const response = await fetch(config.url, { credentials: 'omit' });
    if (!response.ok) {
      if (response.status === 429) {
        message.textContent = spanish ? 'El servidor limita las solicitudes (HTTP 429). Espera y vuelve a intentarlo.' : 'The feed server is rate limiting requests (HTTP 429). Wait and try again.';
      } else {
        message.textContent = spanish ? `El servidor del feed respondió con HTTP ${response.status}. Comprueba la URL o inténtalo más tarde.` : `The feed server returned HTTP ${response.status}. Check the URL or try again later.`;
      }
      return;
    }
    const base = response.url || config.url;
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    const root = xml.documentElement;
    if (xml.querySelector('parsererror')) throw new Error(rssText.invalidFeed);
    if (root.localName.toLowerCase() === 'opml') { renderOpml(root, base, config, section, stories, message); return; }
    const channel = root.localName === 'rss' ? directChild(root, 'channel') : root.localName === 'feed' ? root : null;
    if (xml.querySelector('parsererror') || !channel) throw new Error(rssText.invalidFeed);
    const name = directChild(channel, 'title')?.textContent?.trim() || new URL(config.url).hostname;
    section.querySelector('h2').textContent = name;
    const items = Array.from(channel.children).filter(node => ['item', 'entry'].includes(node.localName)).slice(0, config.count);
    for (const item of items) {
      const linkNode = Array.from(item.children).find(node => node.localName === 'link' && (!node.getAttribute('rel') || node.getAttribute('rel') === 'alternate'));
      const href = safeUrl(linkNode?.getAttribute('href') || linkNode?.textContent?.trim(), base);
      if (!href) continue;
      const article = document.createElement('article'); article.className = 'story';
      const content = document.createElement('div'); content.className = 'story-content';
      const publisher = document.createElement('p'); publisher.className = 'source'; publisher.textContent = directChild(item, 'source')?.textContent?.trim() || name;
      const heading = document.createElement('h3');
      const link = document.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = directChild(item, 'title')?.textContent?.trim() || chrome.i18n.getMessage('unknown_title');
      heading.append(link); content.append(publisher, heading);
      const dateText = directChild(item, 'pubDate')?.textContent || directChild(item, 'published')?.textContent || directChild(item, 'updated')?.textContent;
      const date = new Date(dateText || '');
      if (!Number.isNaN(date.valueOf())) { const time = document.createElement('time'); time.dateTime = date.toISOString(); time.textContent = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date); content.append(time); }
      article.append(content);
      const imageUrl = feedImage(item, base);
      if (imageUrl) { const image = document.createElement('img'); image.className = 'thumbnail'; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => image.remove()); image.src = imageUrl; article.append(image); }
      stories.append(article);
    }
    message.textContent = stories.children.length ? '' : labels.empty;
  } catch (error) { message.textContent = error.message === rssText.invalidFeed ? error.message : `${rssText.failed} ${spanish ? 'Si el feed redirige a otro host, añade la URL final.' : 'If the feed redirects to another host, add its final URL.'}`; }
  finally { button.disabled = false; }
}

function createCustomWidget(config) {
  const section = document.createElement('section'); section.className = 'widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2'); heading.textContent = new URL(config.url).hostname;
  const actions = document.createElement('div'); actions.className = 'widget-actions';
  const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'refresh-widget'; reload.textContent = labels.refresh; reload.title = config.url;
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = rssText.remove;
  actions.append(reload, remove); header.append(heading, actions);
  const message = document.createElement('p'); message.className = 'widget-status'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const stories = document.createElement('div'); stories.className = 'stories';
  section.append(header, message, stories); widgetGrid.append(section);
  setupWidget(section, config.url, config.count, async count => { config.count = count; await persistSettings(); await loadCustomFeed(config, section); });
  reload.addEventListener('click', async () => {
    try {
      const granted = await chrome.permissions.request({ origins: feedOrigins(config.url) });
      if (!granted) { message.textContent = rssText.denied; return; }
      await loadCustomFeed(config, section);
    } catch { message.textContent = rssText.failed; }
  });
  remove.addEventListener('click', async () => { customFeeds = customFeeds.filter(feed => feed.url !== config.url); layout = layout.map(id => id === config.url ? null : id); section.remove(); drawGrid(); try { await persistSettings(); } catch { rssFormStatus.textContent = rssText.failed; } });
  loadCustomFeed(config, section);
}

rssForm.addEventListener('submit', async event => {
  event.preventDefault(); rssFormStatus.textContent = '';
  const url = safeUrl(rssUrl.value.trim());
  if (!url) { rssFormStatus.textContent = rssText.invalid; return; }
  const count = Number(document.getElementById('rss-count').value);
  if (!validCount(count)) { rssFormStatus.textContent = gridText.invalid; return; }
  if (customFeeds.some(feed => feed.url === url)) { rssFormStatus.textContent = rssText.duplicate; return; }
  try {
    const granted = await chrome.permissions.request({ origins: feedOrigins(url) });
    if (!granted) { rssFormStatus.textContent = rssText.denied; return; }
    const config = { url, count }; customFeeds.push(config);
    layout.push(url);
    try { await persistSettings(); } catch (error) { customFeeds.pop(); layout.pop(); throw error; }
    rssUrl.value = ''; createCustomWidget(config); drawGrid();
  } catch { rssFormStatus.textContent = rssText.failed; }
});
chrome.storage.local.get({ customFeeds: [], googleCount: 12, googleEnabled: true, googlePosition: 0, widgetLayout: [] }).then(saved => {
  customFeeds = Array.isArray(saved.customFeeds) ? saved.customFeeds.filter(item => item && safeUrl(item.url)).map(item => ({ ...item, count: validCount(item.count) ? Number(item.count) : 12 })) : [];
  googleCount = validCount(saved.googleCount) ? Number(saved.googleCount) : 12;
  googleEnabled = saved.googleEnabled !== false;
  googlePosition = Number.isInteger(saved.googlePosition) && saved.googlePosition >= 0 && saved.googlePosition < 200 ? saved.googlePosition : 0;
  layout = Array.isArray(saved.widgetLayout) ? saved.widgetLayout.slice(0, 200).map(id => typeof id === 'string' ? id : null) : [];
  const seen = new Set(); layout = layout.map(id => { if (!id || seen.has(id)) return null; seen.add(id); return id; });
  const google = document.getElementById('google-widget');
  const addGoogle = document.getElementById('add-google');
  const removeGoogle = document.getElementById('remove-google');
  addGoogle.textContent = spanish ? 'Añadir widget de Google News' : 'Add Google News widget';
  removeGoogle.textContent = rssText.remove;
  setupWidget(google, 'google-news', googleCount, async count => { googleCount = count; await persistSettings(); await loadNews(); });
  removeGoogle.addEventListener('click', async () => {
    const oldLayout = [...layout];
    googlePosition = Math.max(0, layout.indexOf('google-news'));
    googleEnabled = false;
    layout = layout.map(id => id === 'google-news' ? null : id);
    try { await persistSettings(); google.remove(); addGoogle.hidden = false; drawGrid(); }
    catch { googleEnabled = true; layout = oldLayout; rssFormStatus.textContent = rssText.failed; }
  });
  addGoogle.addEventListener('click', async () => {
    addGoogle.disabled = true;
    const oldLayout = [...layout];
    googleEnabled = true;
    while (layout.length <= googlePosition) layout.push(null);
    if (layout[googlePosition] === null) layout[googlePosition] = 'google-news';
    else layout.push('google-news');
    googlePosition = layout.indexOf('google-news');
    try { await persistSettings(); widgetGrid.append(google); addGoogle.hidden = true; drawGrid(); loadNews(); }
    catch { googleEnabled = false; layout = oldLayout; rssFormStatus.textContent = rssText.failed; }
    finally { addGoogle.disabled = false; }
  });
  customFeeds.forEach(createCustomWidget);
  if (!googleEnabled) { google.remove(); layout = layout.map(id => id === 'google-news' ? null : id); }
  addGoogle.hidden = googleEnabled;
  drawGrid(); if (googleEnabled) loadNews();
}).catch(() => { rssFormStatus.textContent = rssText.failed; });
