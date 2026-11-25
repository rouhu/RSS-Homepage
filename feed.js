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
const rssTitle = document.getElementById('rss-title');
const rssFormStatus = document.getElementById('rss-form-status');
const widgetGrid = document.getElementById('widget-grid');
const widgetPanel = document.getElementById('widget-panel');
const widgetPanelToggle = document.getElementById('widget-panel-toggle');
function setWidgetPanelOpen(open) {
  widgetPanel.hidden = !open;
  widgetPanelToggle.setAttribute('aria-expanded', String(open));
  widgetPanelToggle.textContent = open ? (spanish ? 'Ocultar formularios' : 'Hide widget forms') : (spanish ? 'Añadir widget' : 'Add Widget');
}
widgetPanelToggle.addEventListener('click', () => setWidgetPanelOpen(widgetPanel.hidden));
setWidgetPanelOpen(false);
document.getElementById('add-title').textContent = rssText.addTitle;
document.getElementById('rss-label').textContent = rssText.label;
document.getElementById('rss-title-label').textContent = spanish ? 'Título del widget (opcional)' : 'Widget title (optional)';
document.getElementById('add-rss').textContent = rssText.add;
let customFeeds = [];
let iframeWidgets = [];
let quickLinks = [];
let quickEnabled = false;
let todoTasks = [];
let todoEnabled = false;
let notes = [];
let notesEnabled = false;
let googleCount = 12;
let forexConfig = null;
const forexOrigin = 'https://forexnewsapi.com/*';
const forexEndpoint = 'https://forexnewsapi.com/api/v1/category';
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
  const data = { customFeeds: customFeeds.map(item => ({ ...item })), iframeWidgets: iframeWidgets.map(item => ({ ...item })), quickLinks: quickLinks.map(item => ({ ...item })), quickEnabled, todoTasks: todoTasks.map(item => ({ ...item })), todoEnabled, notes: [...notes], notesEnabled, googleCount, googleEnabled, googlePosition, forexConfig: forexConfig ? { ...forexConfig } : null, widgetLayout: [...layout] };
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
  handle.addEventListener('dragend', () => { dragging = null; stopDragScroll(); section.classList.remove('dragging'); widgetGrid.querySelectorAll('.drag-over').forEach(node => node.classList.remove('drag-over')); });
  handle.addEventListener('keydown', event => {
    const columns = getComputedStyle(widgetGrid).gridTemplateColumns.split(' ').length;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in offsets)) return;
    event.preventDefault(); moveWidget(id, layout.indexOf(id) + offsets[event.key]); handle.focus();
  });
  section.prepend(handle);
  if (onSave == null) return;
  const form = document.createElement('form'); form.className = 'widget-config';
  const label = document.createElement('label'); label.textContent = `${gridText.posts} `;
  const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '50'; input.required = true; input.value = String(initialCount);
  label.append(input);
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = gridText.save;
  const feedback = document.createElement('span'); feedback.setAttribute('role', 'status');
  form.append(label, save, feedback); section.append(form);
  if (id !== 'forex-news-api') {
    const configButton = document.createElement('button'); configButton.type = 'button'; configButton.className = 'compact-add'; configButton.textContent = spanish ? 'Configurar' : 'Config'; configButton.setAttribute('aria-expanded', 'false');
    const configPanel = document.createElement('div'); configPanel.hidden = true;
    configPanel.id = `widget-config-${crypto.randomUUID()}`; configButton.setAttribute('aria-controls', configPanel.id);
    form.before(configButton, configPanel); configPanel.append(form);
    configButton.addEventListener('click', () => { configPanel.hidden = !configPanel.hidden; configButton.setAttribute('aria-expanded', String(!configPanel.hidden)); });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validCount(input.value)) { feedback.textContent = gridText.invalid; return; }
    save.disabled = true;
    try { await onSave(Number(input.value)); feedback.textContent = gridText.saved; }
    catch { feedback.textContent = rssText.failed; }
    finally { save.disabled = false; }
  });
}

let dragScrollFrame = null;
let dragScrollSpeed = 0;
function stopDragScroll() {
  dragScrollSpeed = 0;
  if (dragScrollFrame !== null) cancelAnimationFrame(dragScrollFrame);
  dragScrollFrame = null;
}
function scrollDuringDrag() {
  window.scrollBy(0, dragScrollSpeed);
  dragScrollFrame = requestAnimationFrame(scrollDuringDrag);
}
document.addEventListener('dragover', event => {
  if (!dragging) return;
  const edge = Math.min(100, window.innerHeight / 4);
  const distance = event.clientY < edge ? event.clientY - edge : event.clientY > window.innerHeight - edge ? event.clientY - (window.innerHeight - edge) : 0;
  dragScrollSpeed = Math.max(-20, Math.min(20, distance / edge * 20));
  if (!dragScrollSpeed) stopDragScroll();
  else if (dragScrollFrame === null) dragScrollFrame = requestAnimationFrame(scrollDuringDrag);
});
document.addEventListener('dragleave', event => { if (!event.relatedTarget) stopDragScroll(); });

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
  event.preventDefault(); stopDragScroll(); target.classList.remove('drag-over'); moveWidget(dragging, Number(target.dataset.slot));
});

function feedOrigins(url) {
  const host = new URL(url).hostname;
  const origins = [`http://${host}/*`, `https://${host}/*`];
  // Yahoo's legacy RSS hostname redirects to a different hostname.
  if (host === 'rss.news.yahoo.com') origins.push('https://news.yahoo.com/*');
  if (host === 'newsrss.bbc.co.uk') origins.push('https://feeds.bbci.co.uk/*');
  // MarketWatch's legacy RSS URLs redirect through its feed host to Dow Jones.
  if (host === 'www.marketwatch.com') origins.push('https://feeds.marketwatch.com/*', 'https://feeds.content.dowjones.io/*');
  if (host === 'feeds.marketwatch.com') origins.push('https://feeds.content.dowjones.io/*');
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
  section.querySelector('h2').textContent = config.title || name;
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
      add.addEventListener('click', () => { setWidgetPanelOpen(true); rssUrl.value = entry.url; rssUrl.focus(); rssUrl.scrollIntoView({ behavior: 'smooth', block: 'center' }); rssFormStatus.textContent = spanish ? 'Comprueba la URL y pulsa Añadir widget.' : 'Review the URL and select Add widget.'; });
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
    section.querySelector('h2').textContent = config.title || name;
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

const quickText = spanish
  ? { title: 'Enlaces rápidos', addWidget: 'Añadir widget de enlaces rápidos', titleLabel: 'Título', url: 'URL', add: 'Añadir enlace', edit: 'Editar', cancel: 'Cancelar', empty: 'Aún no hay enlaces.', invalid: 'Introduce un título y una URL HTTP o HTTPS válida.', storage: 'No se pudieron guardar los enlaces.' }
  : { title: 'Quick Links', addWidget: 'Add Quick Links widget', titleLabel: 'Title', url: 'URL', add: 'Add link', edit: 'Edit', cancel: 'Cancel', empty: 'No links yet.', invalid: 'Enter a title and a valid HTTP or HTTPS URL.', storage: 'Could not save Quick Links.' };
const quickAdd = document.getElementById('quick-add');
const quickAddStatus = document.getElementById('quick-add-status');
document.getElementById('quick-add-title').textContent = quickText.title;
quickAdd.textContent = quickText.addWidget;

function createQuickWidget() {
  const section = document.createElement('section'); section.className = 'widget compact-widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2'); heading.textContent = quickText.title;
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button icon-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `${rssText.remove}: ${quickText.title}`); remove.title = rssText.remove;
  header.append(heading, remove);
  const list = document.createElement('ul'); list.className = 'quick-list';
  const message = document.createElement('p'); message.className = 'widget-status'; message.setAttribute('role', 'status');
  const form = document.createElement('form'); form.className = 'quick-form';
  const openForm = document.createElement('button'); openForm.type = 'button'; openForm.className = 'compact-add'; openForm.textContent = quickText.add; openForm.setAttribute('aria-expanded', 'false');
  const titleLabel = document.createElement('label'); titleLabel.textContent = quickText.titleLabel;
  const title = document.createElement('input'); title.required = true; title.maxLength = 200; titleLabel.append(title);
  const urlLabel = document.createElement('label'); urlLabel.textContent = quickText.url;
  const url = document.createElement('input'); url.type = 'url'; url.required = true; url.placeholder = 'https://example.com'; urlLabel.append(url);
  const actions = document.createElement('div'); actions.className = 'widget-actions';
  const save = document.createElement('button'); save.type = 'submit';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = quickText.cancel;
  actions.append(save, cancel); form.append(titleLabel, urlLabel, actions);
  section.append(header, list, message, openForm, form); widgetGrid.append(section); setupWidget(section, 'quick-links', null, null);
  let editing = -1;
  function reset() { editing = -1; form.reset(); save.textContent = quickText.add; form.hidden = true; openForm.hidden = false; openForm.setAttribute('aria-expanded', 'false'); }
  function showForm() { form.hidden = false; openForm.hidden = true; openForm.setAttribute('aria-expanded', 'true'); message.textContent = ''; title.focus(); }
  openForm.addEventListener('click', showForm);
  function render() {
    list.replaceChildren();
    quickLinks.forEach((item, index) => {
      const row = document.createElement('li');
      const link = document.createElement('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = item.title;
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'icon-button icon-edit'; edit.textContent = '✎'; edit.setAttribute('aria-label', `${quickText.edit}: ${item.title}`); edit.title = quickText.edit;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'icon-button icon-remove'; del.textContent = '×'; del.setAttribute('aria-label', `${rssText.remove}: ${item.title}`); del.title = rssText.remove;
      edit.addEventListener('click', () => { editing = index; title.value = item.title; url.value = item.url; save.textContent = gridText.save; showForm(); });
      del.addEventListener('click', async () => {
        const previous = quickLinks; quickLinks = quickLinks.filter((_, i) => i !== index); del.disabled = true;
        try { await persistSettings(); reset(); render(); } catch { quickLinks = previous; message.textContent = quickText.storage; del.disabled = false; }
      });
      row.append(link, edit, del); list.append(row);
    });
    message.textContent = quickLinks.length ? '' : quickText.empty;
  }
  cancel.addEventListener('click', () => { reset(); render(); openForm.focus(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const href = safeUrl(url.value.trim()); const name = title.value.trim();
    if (!name || !href) { message.textContent = quickText.invalid; return; }
    const previous = quickLinks; quickLinks = [...quickLinks];
    if (editing < 0) quickLinks.push({ title: name, url: href }); else quickLinks[editing] = { title: name, url: href };
    save.disabled = true;
    try { await persistSettings(); reset(); render(); } catch { quickLinks = previous; message.textContent = quickText.storage; }
    finally { save.disabled = false; }
  });
  remove.addEventListener('click', async () => {
    const previous = [...layout]; quickEnabled = false; layout = layout.map(id => id === 'quick-links' ? null : id); remove.disabled = true;
    try { await persistSettings(); section.remove(); quickAdd.hidden = false; drawGrid(); }
    catch { quickEnabled = true; layout = previous; message.textContent = quickText.storage; remove.disabled = false; }
  });
  reset(); render();
}
quickAdd.addEventListener('click', async () => {
  quickAdd.disabled = true; quickAddStatus.textContent = ''; quickEnabled = true; layout.push('quick-links');
  try { await persistSettings(); createQuickWidget(); quickAdd.hidden = true; drawGrid(); }
  catch { quickEnabled = false; layout = layout.filter(id => id !== 'quick-links'); quickAddStatus.textContent = quickText.storage; }
  finally { quickAdd.disabled = false; }
});

const todoText = spanish
  ? { title: 'Lista de tareas', addWidget: 'Añadir widget de tareas', task: 'Nueva tarea', add: 'Añadir tarea', empty: 'Aún no hay tareas.', invalid: 'Introduce una tarea.', storage: 'No se pudieron guardar las tareas.', delete: 'Eliminar tarea' }
  : { title: 'To Do list', addWidget: 'Add To Do list widget', task: 'New task', add: 'Add task', empty: 'No tasks yet.', invalid: 'Enter a task.', storage: 'Could not save tasks.', delete: 'Delete task' };
const todoAdd = document.getElementById('todo-add');
const todoAddStatus = document.getElementById('todo-add-status');
document.getElementById('todo-add-title').textContent = todoText.title;
todoAdd.textContent = todoText.addWidget;

function createTodoWidget() {
  const section = document.createElement('section'); section.className = 'widget compact-widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2'); heading.textContent = todoText.title;
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button icon-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `${rssText.remove}: ${todoText.title}`); remove.title = rssText.remove;
  header.append(heading, remove);
  const list = document.createElement('ul'); list.className = 'todo-list';
  const message = document.createElement('p'); message.className = 'widget-status'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const form = document.createElement('form'); form.className = 'todo-form';
  const openForm = document.createElement('button'); openForm.type = 'button'; openForm.className = 'compact-add'; openForm.textContent = todoText.add; openForm.setAttribute('aria-expanded', 'false');
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 200; input.required = true; input.placeholder = todoText.task; input.setAttribute('aria-label', todoText.task);
  const add = document.createElement('button'); add.type = 'submit'; add.textContent = todoText.add;
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = quickText.cancel;
  form.hidden = true;
  form.append(input, add, cancel); section.append(header, list, message, openForm, form); widgetGrid.append(section);
  setupWidget(section, 'todo-list', null, null);
  function closeForm() { form.reset(); form.hidden = true; openForm.hidden = false; openForm.setAttribute('aria-expanded', 'false'); }
  openForm.addEventListener('click', () => { form.hidden = false; openForm.hidden = true; openForm.setAttribute('aria-expanded', 'true'); message.textContent = ''; input.focus(); });
  cancel.addEventListener('click', () => { closeForm(); render(); openForm.focus(); });
  function busy(value) { section.querySelectorAll('button, input').forEach(control => { control.disabled = value; }); }
  function render() {
    list.replaceChildren();
    todoTasks.forEach((task, index) => {
      const row = document.createElement('li');
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.completed;
      const text = document.createElement('span'); text.textContent = task.text;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'icon-button icon-remove'; del.textContent = '×'; del.setAttribute('aria-label', `${todoText.delete}: ${task.text}`); del.title = todoText.delete;
      checkbox.addEventListener('change', () => update(todoTasks.map((item, i) => i === index ? { ...item, completed: checkbox.checked } : item)));
      del.addEventListener('click', () => update(todoTasks.filter((_, i) => i !== index)));
      label.append(checkbox, text); row.append(label, del); list.append(row);
    });
    message.textContent = todoTasks.length ? '' : todoText.empty;
  }
  async function update(next) {
    const previous = todoTasks; todoTasks = next; busy(true);
    try { await persistSettings(); render(); return true; }
    catch { todoTasks = previous; render(); message.textContent = todoText.storage; return false; }
    finally { busy(false); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); const text = input.value.trim();
    if (!text) { message.textContent = todoText.invalid; return; }
    if (await update([...todoTasks, { text, completed: false }])) { closeForm(); openForm.focus(); }
  });
  remove.addEventListener('click', async () => {
    const previous = [...layout]; todoEnabled = false; layout = layout.map(id => id === 'todo-list' ? null : id); busy(true);
    try { await persistSettings(); section.remove(); todoAdd.hidden = false; drawGrid(); }
    catch { todoEnabled = true; layout = previous; message.textContent = todoText.storage; busy(false); }
  });
  render();
}
todoAdd.addEventListener('click', async () => {
  todoAdd.disabled = true; todoAddStatus.textContent = ''; todoEnabled = true; layout.push('todo-list');
  try { await persistSettings(); createTodoWidget(); todoAdd.hidden = true; drawGrid(); }
  catch { todoEnabled = false; layout = layout.filter(id => id !== 'todo-list'); todoAddStatus.textContent = todoText.storage; }
  finally { todoAdd.disabled = false; }
});

const notesText = spanish
  ? { title: 'Notas', addWidget: 'Añadir widget de notas', add: 'Nueva nota', edit: 'Editar nota', delete: 'Eliminar nota', placeholder: 'Escribe una nota', empty: 'Aún no hay notas.', invalid: 'Escribe una nota.', storage: 'No se pudieron guardar las notas.' }
  : { title: 'Notes', addWidget: 'Add Notes widget', add: 'New note', edit: 'Edit note', delete: 'Delete note', placeholder: 'Write a note', empty: 'No notes yet.', invalid: 'Write a note.', storage: 'Could not save notes.' };
const notesAdd = document.getElementById('notes-add');
const notesAddStatus = document.getElementById('notes-add-status');
document.getElementById('notes-add-title').textContent = notesText.title;
notesAdd.textContent = notesText.addWidget;

function createNotesWidget() {
  const section = document.createElement('section'); section.className = 'widget compact-widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2'); heading.textContent = notesText.title;
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button icon-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `${rssText.remove}: ${notesText.title}`); remove.title = rssText.remove;
  header.append(heading, remove);
  const list = document.createElement('div'); list.className = 'notes-list';
  const message = document.createElement('p'); message.className = 'widget-status'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const openForm = document.createElement('button'); openForm.type = 'button'; openForm.className = 'compact-add'; openForm.textContent = notesText.add;
  const form = document.createElement('form'); form.className = 'notes-form'; form.hidden = true;
  const input = document.createElement('textarea'); input.required = true; input.placeholder = notesText.placeholder; input.setAttribute('aria-label', notesText.placeholder);
  const actions = document.createElement('div'); actions.className = 'widget-actions';
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = gridText.save;
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = quickText.cancel;
  actions.append(save, cancel); form.append(input, actions); section.append(header, list, message, openForm, form); widgetGrid.append(section);
  setupWidget(section, 'notes', null, null);
  let editing = -1;
  function closeForm() { editing = -1; form.reset(); form.hidden = true; openForm.hidden = false; }
  function open(index) { editing = index; input.value = index < 0 ? '' : notes[index]; form.hidden = false; openForm.hidden = true; message.textContent = ''; input.focus(); }
  function busy(value) { section.querySelectorAll('button, textarea').forEach(control => { control.disabled = value; }); }
  function render() {
    list.replaceChildren();
    notes.forEach((note, index) => {
      const card = document.createElement('article'); card.className = 'note-card';
      const text = document.createElement('p'); text.textContent = note;
      const buttons = document.createElement('div'); buttons.className = 'widget-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = notesText.edit;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'icon-button icon-remove'; del.textContent = '×'; del.setAttribute('aria-label', `${notesText.delete}: ${note.slice(0, 80)}`); del.title = notesText.delete;
      edit.addEventListener('click', () => open(index));
      del.addEventListener('click', async () => { if (await update(notes.filter((_, i) => i !== index))) closeForm(); });
      buttons.append(edit, del); card.append(text, buttons); list.append(card);
    });
    message.textContent = notes.length ? '' : notesText.empty;
  }
  async function update(next) {
    const previous = notes; notes = next; busy(true);
    try { await persistSettings(); render(); return true; }
    catch { notes = previous; message.textContent = notesText.storage; return false; }
    finally { busy(false); }
  }
  openForm.addEventListener('click', () => open(-1));
  cancel.addEventListener('click', () => { closeForm(); render(); openForm.focus(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const text = input.value.trim();
    if (!text) { message.textContent = notesText.invalid; return; }
    const next = [...notes]; if (editing < 0) next.push(text); else next[editing] = text;
    if (await update(next)) { closeForm(); openForm.focus(); }
  });
  remove.addEventListener('click', async () => {
    const previous = [...layout]; notesEnabled = false; layout = layout.map(id => id === 'notes' ? null : id); busy(true);
    try { await persistSettings(); section.remove(); notesAdd.hidden = false; drawGrid(); }
    catch { notesEnabled = true; layout = previous; message.textContent = notesText.storage; busy(false); }
  });
  render();
}
notesAdd.addEventListener('click', async () => {
  notesAdd.disabled = true; notesAddStatus.textContent = ''; notesEnabled = true; layout.push('notes');
  try { await persistSettings(); createNotesWidget(); notesAdd.hidden = true; drawGrid(); }
  catch { notesEnabled = false; layout = layout.filter(id => id !== 'notes'); notesAddStatus.textContent = notesText.storage; }
  finally { notesAdd.disabled = false; }
});

function createCustomWidget(config) {
  const section = document.createElement('section'); section.className = 'widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2'); heading.textContent = config.title || new URL(config.url).hostname;
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

const forexText = spanish
  ? { title: 'Noticias Forex', key: 'Clave API', addTitle: 'Añadir widget de noticias Forex', add: 'Añadir widget Forex', replace: 'Cambiar clave API', missing: 'Introduce una clave API.', denied: 'Se necesita permiso para acceder a Forex News API.', network: 'No se pudo conectar con Forex News API.', auth: 'Clave API rechazada o acceso no autorizado.', limit: 'Límite de solicitudes alcanzado. Inténtalo más tarde.', invalid: 'Forex News API devolvió una respuesta no válida.', permission: 'Pulsa Actualizar para conceder acceso a Forex News API.', keySaved: 'Clave guardada.', storage: 'No se pudo guardar la configuración.' }
  : { title: 'Forex News', key: 'API key', addTitle: 'Add Forex News widget', add: 'Add Forex News widget', replace: 'Replace API key', missing: 'Enter an API key.', denied: 'Permission to access Forex News API is required.', network: 'Could not connect to Forex News API.', auth: 'API key rejected or access is not authorized.', limit: 'Request limit reached. Try again later.', invalid: 'Forex News API returned an invalid response.', permission: 'Click Refresh to grant access to Forex News API.', keySaved: 'API key saved.', storage: 'Could not save settings.' };
const forexUrlText = spanish
  ? { label: 'URL y filtros de Forex News API', invalid: 'Usa una URL HTTPS de forexnewsapi.com/api/v1 o /api/v1/category.', saved: 'URL guardada. El número de noticias se configura por separado.' }
  : { label: 'Forex News API URL and filters', invalid: 'Use an HTTPS URL at forexnewsapi.com/api/v1 or /api/v1/category.', saved: 'URL saved. The post count is configured separately.' };

function parseForexUrl(value) {
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.origin !== 'https://forexnewsapi.com' || url.username || url.password || url.hash || !['/api/v1', '/api/v1/', '/api/v1/category', '/api/v1/category/'].includes(url.pathname)) return null;
  let token = '';
  for (const name of [...url.searchParams.keys()]) {
    if (name.toLowerCase() === 'token') { token = url.searchParams.get(name) || ''; url.searchParams.delete(name); }
    if (name.toLowerCase() === 'items') url.searchParams.delete(name);
  }
  return { url: url.href, token: token.trim() };
}

function forexRequestUrl(config) {
  const parsed = parseForexUrl(config.url || `${forexEndpoint}?section=general&page=1`);
  if (!parsed) throw new Error('Invalid Forex API URL');
  const url = new URL(parsed.url);
  url.searchParams.set('items', String(config.count));
  url.searchParams.set('token', config.key);
  return url.href;
}
const forexForm = document.getElementById('forex-form');
const forexKey = document.getElementById('forex-key');
const forexFormStatus = document.getElementById('forex-form-status');
document.getElementById('forex-add-title').textContent = forexText.addTitle;
document.querySelector('label[for="forex-key"]').textContent = forexText.key;
document.getElementById('add-forex').textContent = forexText.add;

async function loadForex(section) {
  const config = forexConfig && { ...forexConfig };
  if (!config) return;
  const stories = section.querySelector('.stories');
  const message = section.querySelector('.widget-status');
  const reload = section.querySelector('.refresh-widget');
  reload.disabled = true; message.textContent = labels.loading; stories.replaceChildren();
  try {
    if (!await chrome.permissions.contains({ origins: [forexOrigin] })) { message.textContent = forexText.permission; return; }
    const response = await fetch(forexRequestUrl(config), { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) {
      message.textContent = response.status === 401 || response.status === 403 ? forexText.auth : response.status === 429 ? forexText.limit : `${forexText.network} HTTP ${response.status}.`;
      return;
    }
    let result;
    try { result = await response.json(); } catch { message.textContent = forexText.invalid; return; }
    if (!result || !Array.isArray(result.data)) { message.textContent = forexText.invalid; return; }
    for (const item of result.data.slice(0, config.count)) {
      if (!item || typeof item !== 'object') continue;
      const href = safeUrl(item.news_url);
      if (!href) continue;
      const article = document.createElement('article'); article.className = 'story';
      const content = document.createElement('div'); content.className = 'story-content';
      const publisher = document.createElement('p'); publisher.className = 'source'; publisher.textContent = typeof item.source_name === 'string' && item.source_name.trim() ? item.source_name : forexText.title;
      const heading = document.createElement('h3');
      const link = document.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = typeof item.title === 'string' && item.title.trim() ? item.title : chrome.i18n.getMessage('unknown_title');
      heading.append(link); content.append(publisher, heading);
      const date = new Date(typeof item.date === 'string' ? item.date : '');
      if (!Number.isNaN(date.valueOf())) { const time = document.createElement('time'); time.dateTime = date.toISOString(); time.textContent = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date); content.append(time); }
      article.append(content);
      const imageUrl = safeUrl(item.image_url);
      if (imageUrl) { const image = document.createElement('img'); image.className = 'thumbnail'; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => image.remove()); image.src = imageUrl; article.append(image); }
      stories.append(article);
    }
    message.textContent = stories.children.length ? '' : labels.empty;
  } catch { message.textContent = forexText.network; }
  finally { reload.disabled = false; }
}

function createForexWidget() {
  const section = document.createElement('section'); section.className = 'widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2'); heading.textContent = forexText.title;
  const actions = document.createElement('div'); actions.className = 'widget-actions';
  const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'refresh-widget'; reload.textContent = labels.refresh; reload.title = forexConfig.url;
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = rssText.remove;
  actions.append(reload, remove); header.append(heading, actions);
  const message = document.createElement('p'); message.className = 'widget-status'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const stories = document.createElement('div'); stories.className = 'stories';
  section.append(header, message, stories); widgetGrid.append(section);
  setupWidget(section, 'forex-news-api', forexConfig.count, async count => { const old = forexConfig.count; forexConfig.count = count; try { await persistSettings(); } catch (error) { forexConfig.count = old; throw error; } await loadForex(section); });
  const configButton = document.createElement('button'); configButton.type = 'button'; configButton.className = 'compact-add'; configButton.textContent = spanish ? 'Configurar' : 'Config'; configButton.setAttribute('aria-expanded', 'false');
  const configPanel = document.createElement('div'); configPanel.id = 'forex-config-panel'; configPanel.hidden = true;
  configButton.setAttribute('aria-controls', configPanel.id);
  configPanel.append(section.querySelector('.widget-config'));
  section.append(configButton, configPanel);
  configButton.addEventListener('click', () => { configPanel.hidden = !configPanel.hidden; configButton.setAttribute('aria-expanded', String(!configPanel.hidden)); });
  const keyForm = document.createElement('form'); keyForm.className = 'forex-key-config';
  const label = document.createElement('label'); label.textContent = forexText.replace;
  const input = document.createElement('input'); input.type = 'password'; input.autocomplete = 'off'; input.required = true; input.setAttribute('aria-label', forexText.replace);
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = gridText.save;
  const feedback = document.createElement('span'); feedback.setAttribute('role', 'status');
  label.append(input); keyForm.append(label, save, feedback); configPanel.append(keyForm);
  keyForm.addEventListener('submit', async event => {
    event.preventDefault(); const key = input.value.trim();
    if (!key) { feedback.textContent = forexText.missing; return; }
    save.disabled = true; const old = forexConfig.key; forexConfig.key = key;
    try { await persistSettings(); input.value = ''; feedback.textContent = forexText.keySaved; await loadForex(section); }
    catch { forexConfig.key = old; feedback.textContent = forexText.storage; }
    finally { save.disabled = false; }
  });
  const urlForm = document.createElement('form'); urlForm.className = 'forex-key-config forex-url-config';
  const urlLabel = document.createElement('label'); urlLabel.textContent = forexUrlText.label;
  const urlInput = document.createElement('input'); urlInput.type = 'text'; urlInput.required = true; urlInput.autocomplete = 'off'; urlInput.value = forexConfig.url; urlLabel.append(urlInput);
  const urlSave = document.createElement('button'); urlSave.type = 'submit'; urlSave.textContent = gridText.save;
  const urlFeedback = document.createElement('span'); urlFeedback.setAttribute('role', 'status');
  urlForm.append(urlLabel, urlSave, urlFeedback); configPanel.append(urlForm);
  urlForm.addEventListener('submit', async event => {
    event.preventDefault();
    const parsed = parseForexUrl(urlInput.value);
    if (!parsed) { urlInput.value = forexConfig.url; urlFeedback.textContent = forexUrlText.invalid; return; }
    urlInput.value = parsed.url;
    const old = { ...forexConfig }; forexConfig.url = parsed.url;
    if (parsed.token) forexConfig.key = parsed.token;
    urlSave.disabled = true;
    try { await persistSettings(); reload.title = parsed.url; urlFeedback.textContent = forexUrlText.saved; await loadForex(section); }
    catch { forexConfig = old; urlInput.value = old.url; urlFeedback.textContent = forexText.storage; }
    finally { urlSave.disabled = false; }
  });
  reload.addEventListener('click', async () => {
    try { if (!await chrome.permissions.request({ origins: [forexOrigin] })) { message.textContent = forexText.denied; return; } await loadForex(section); }
    catch { message.textContent = forexText.network; }
  });
  remove.addEventListener('click', async () => {
    remove.disabled = true; const previous = forexConfig; const oldLayout = [...layout]; forexConfig = null; layout = layout.map(id => id === 'forex-news-api' ? null : id);
    try { await persistSettings(); section.remove(); forexForm.hidden = false; drawGrid(); }
    catch { forexConfig = previous; layout = oldLayout; message.textContent = forexText.storage; remove.disabled = false; }
  });
  loadForex(section);
}

forexForm.addEventListener('submit', async event => {
  event.preventDefault(); forexFormStatus.textContent = '';
  const key = forexKey.value.trim();
  if (!key) { forexFormStatus.textContent = forexText.missing; return; }
  if (forexConfig) return;
  const button = document.getElementById('add-forex'); button.disabled = true;
  try {
    if (!await chrome.permissions.request({ origins: [forexOrigin] })) { forexFormStatus.textContent = forexText.denied; return; }
    forexConfig = { key, count: 12, url: `${forexEndpoint}?section=general&page=1` }; layout.push('forex-news-api');
    try { await persistSettings(); } catch (error) { forexConfig = null; layout.pop(); throw error; }
    forexKey.value = ''; forexForm.hidden = true; createForexWidget(); drawGrid();
  } catch { forexFormStatus.textContent = forexText.storage; }
  finally { button.disabled = false; }
});

const iframeText = spanish
  ? { add: 'Añadir widget web', title: 'Título (opcional)', url: 'URL del sitio web', width: 'Ancho (px)', height: 'Alto (px)', settings: 'Configuración', invalid: 'Introduce una URL HTTP o HTTPS y dimensiones entre 100 y 3000 píxeles.', note: 'Algunos sitios bloquean la inserción o pueden no funcionar en este marco.', storage: 'No se pudo guardar la configuración.' }
  : { add: 'Add website widget', title: 'Title (optional)', url: 'Website URL', width: 'Width (px)', height: 'Height (px)', settings: 'Settings', invalid: 'Enter an HTTP or HTTPS URL and dimensions between 100 and 3000 pixels.', note: 'Some sites block embedding or may not work in this frame.', storage: 'Could not save settings.' };
const iframeAddForm = document.getElementById('iframe-add-form');
const iframeAddStatus = document.getElementById('iframe-add-status');
document.getElementById('iframe-add-title').textContent = iframeText.add;
document.getElementById('iframe-add-button').textContent = iframeText.add;
document.getElementById('iframe-title-label').textContent = iframeText.title;
document.getElementById('iframe-url-label').textContent = iframeText.url;
document.getElementById('iframe-width-label').textContent = iframeText.width;
document.getElementById('iframe-height-label').textContent = iframeText.height;

function validFrameDimension(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 3000;
}

function createIframeWidget(config) {
  const section = document.createElement('section'); section.className = 'widget iframe-widget';
  const header = document.createElement('div'); header.className = 'widget-header';
  const heading = document.createElement('h2');
  const actions = document.createElement('div'); actions.className = 'widget-actions';
  const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = labels.refresh;
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = rssText.remove;
  actions.append(reload, remove); header.append(heading, actions);
  const frame = document.createElement('iframe'); frame.className = 'iframe-widget-frame';
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
  frame.referrerPolicy = 'no-referrer'; frame.loading = 'lazy';
  const note = document.createElement('p'); note.className = 'iframe-note';
  section.append(header, frame, note); widgetGrid.append(section);
  setupWidget(section, config.id, null, null);
  function applySettings(loadUrl) {
    heading.textContent = config.title || new URL(config.url).hostname;
    frame.title = heading.textContent; frame.width = String(config.width); frame.height = String(config.height);
    reload.title = config.url;
    if (loadUrl) frame.src = config.url;
  }
  applySettings(true);
  reload.addEventListener('click', () => { frame.src = config.url; });
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    const oldWidgets = iframeWidgets; const oldLayout = [...layout];
    iframeWidgets = iframeWidgets.filter(widget => widget.id !== config.id); layout = layout.map(id => id === config.id ? null : id);
    try { await persistSettings(); section.remove(); drawGrid(); }
    catch { iframeWidgets = oldWidgets; layout = oldLayout; note.textContent = iframeText.storage; remove.disabled = false; }
  });
  const details = document.createElement('details'); details.className = 'iframe-settings';
  const summary = document.createElement('summary'); summary.textContent = iframeText.settings;
  const form = document.createElement('form');
  function field(text, type, value) {
    const label = document.createElement('label'); label.textContent = text;
    const input = document.createElement('input'); input.type = type; input.value = String(value); label.append(input); return { label, input };
  }
  const title = field(iframeText.title, 'text', config.title); title.input.maxLength = 200;
  const url = field(iframeText.url, 'url', config.url); url.input.required = true;
  const width = field(iframeText.width, 'number', config.width); const height = field(iframeText.height, 'number', config.height);
  for (const item of [width, height]) { item.input.min = '100'; item.input.max = '3000'; item.input.required = true; }
  const dimensions = document.createElement('div'); dimensions.className = 'iframe-dimensions'; dimensions.append(width.label, height.label);
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = gridText.save;
  const feedback = document.createElement('span'); feedback.setAttribute('role', 'status');
  form.append(title.label, url.label, dimensions, save, feedback); details.append(summary, form); section.append(details);
  form.addEventListener('submit', async event => {
    event.preventDefault(); const value = safeUrl(url.input.value.trim());
    if (!value || !validFrameDimension(width.input.value) || !validFrameDimension(height.input.value)) { feedback.textContent = iframeText.invalid; return; }
    const old = { ...config }; Object.assign(config, { title: title.input.value.trim(), url: value, width: Number(width.input.value), height: Number(height.input.value) });
    save.disabled = true;
    try { await persistSettings(); applySettings(old.url !== config.url); feedback.textContent = gridText.saved; }
    catch { Object.assign(config, old); feedback.textContent = iframeText.storage; }
    finally { save.disabled = false; }
  });
}

iframeAddForm.addEventListener('submit', async event => {
  event.preventDefault(); iframeAddStatus.textContent = '';
  const urlInput = document.getElementById('iframe-add-url');
  const width = document.getElementById('iframe-add-width'); const height = document.getElementById('iframe-add-height');
  const url = safeUrl(urlInput.value.trim());
  if (!url || !validFrameDimension(width.value) || !validFrameDimension(height.value)) { iframeAddStatus.textContent = iframeText.invalid; return; }
  const config = { id: `iframe:${crypto.randomUUID()}`, url, title: document.getElementById('iframe-add-title-input').value.trim(), width: Number(width.value), height: Number(height.value) };
  const button = document.getElementById('iframe-add-button'); button.disabled = true; iframeWidgets.push(config); layout.push(config.id);
  try { await persistSettings(); iframeAddForm.reset(); createIframeWidget(config); drawGrid(); }
  catch { iframeWidgets = iframeWidgets.filter(widget => widget.id !== config.id); layout = layout.filter(id => id !== config.id); iframeAddStatus.textContent = iframeText.storage; }
  finally { button.disabled = false; }
});

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
    const config = { url, count, title: rssTitle.value.trim() }; customFeeds.push(config);
    layout.push(url);
    try { await persistSettings(); } catch (error) { customFeeds.pop(); layout.pop(); throw error; }
    rssUrl.value = ''; rssTitle.value = ''; createCustomWidget(config); drawGrid();
  } catch { rssFormStatus.textContent = rssText.failed; }
});
chrome.storage.local.get({ customFeeds: [], iframeWidgets: [], quickLinks: [], quickEnabled: false, todoTasks: [], todoEnabled: false, notes: [], notesEnabled: false, googleCount: 12, googleEnabled: true, googlePosition: 0, forexConfig: null, widgetLayout: [] }).then(saved => {
  notes = Array.isArray(saved.notes) ? saved.notes.filter(item => typeof item === 'string' && item.trim()) : [];
  notesEnabled = saved.notesEnabled === true;
  todoTasks = Array.isArray(saved.todoTasks) ? saved.todoTasks.filter(item => item && typeof item.text === 'string' && item.text.trim()).map(item => ({ text: item.text.slice(0, 200), completed: item.completed === true })) : [];
  todoEnabled = saved.todoEnabled === true;
  quickLinks = Array.isArray(saved.quickLinks) ? saved.quickLinks.filter(item => item && typeof item.title === 'string' && item.title.trim() && typeof item.url === 'string' && safeUrl(item.url)).map(item => ({ title: item.title.slice(0, 200), url: safeUrl(item.url) })) : [];
  quickEnabled = saved.quickEnabled === true;
  customFeeds = Array.isArray(saved.customFeeds) ? saved.customFeeds.filter(item => item && safeUrl(item.url)).map(item => ({ ...item, count: validCount(item.count) ? Number(item.count) : 12 })) : [];
  iframeWidgets = Array.isArray(saved.iframeWidgets) ? saved.iframeWidgets.filter(item => item && typeof item.id === 'string' && item.id.startsWith('iframe:') && safeUrl(item.url) && validFrameDimension(item.width) && validFrameDimension(item.height)).map(item => ({ id: item.id, url: safeUrl(item.url), title: typeof item.title === 'string' ? item.title.slice(0, 200) : '', width: Number(item.width), height: Number(item.height) })) : [];
  googleCount = validCount(saved.googleCount) ? Number(saved.googleCount) : 12;
  googleEnabled = saved.googleEnabled !== false;
  forexConfig = saved.forexConfig && typeof saved.forexConfig.key === 'string' && saved.forexConfig.key.trim() ? { key: saved.forexConfig.key.trim(), count: validCount(saved.forexConfig.count) ? Number(saved.forexConfig.count) : 12, url: parseForexUrl(saved.forexConfig.url || `${forexEndpoint}?section=general&page=1`)?.url || `${forexEndpoint}?section=general&page=1` } : null;
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
  iframeWidgets.forEach(createIframeWidget);
  quickAdd.hidden = quickEnabled;
  if (quickEnabled) createQuickWidget();
  todoAdd.hidden = todoEnabled;
  if (todoEnabled) createTodoWidget();
  notesAdd.hidden = notesEnabled;
  if (notesEnabled) createNotesWidget();
  forexForm.hidden = Boolean(forexConfig);
  if (forexConfig) createForexWidget();
  if (!googleEnabled) { google.remove(); layout = layout.map(id => id === 'google-news' ? null : id); }
  addGoogle.hidden = googleEnabled;
  drawGrid(); if (googleEnabled) loadNews();
}).catch(() => { rssFormStatus.textContent = rssText.failed; });
