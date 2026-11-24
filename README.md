# News Reader

News Reader is a Chrome extension that opens a customizable news dashboard in a full browser tab when you click its toolbar icon. Read Google News headlines alongside your own RSS and Atom feeds, arrange widgets on a grid, and keep your layout and settings locally in Chrome.

## Features

- A removable Google News top-stories widget with localized headlines, publishers, and publication dates.
- Multiple custom RSS and Atom widgets, with feed-provided thumbnails when available.
- An optional Forex News API widget for general forex news, using your own API key.
- Website widgets that embed a URL in a sandboxed iframe with configurable pixel dimensions.
- OPML directories: browse nested feed entries and add selected feeds as individual widgets.
- Drag widgets by their colored top bar, or focus the bar and use the arrow keys. Drop on a widget to swap positions or on an empty slot to move there.
- An optional To Do list widget for adding, completing, and deleting tasks. Tasks are saved locally and retained if the widget is removed and added again.
- Configure 1–50 posts per widget, subject to feed availability. Widget layout, feed URLs, and settings are saved in Chrome's local extension storage.
- A responsive two-column grid that becomes one column on narrow screens.

## Install in Chrome

This project runs as an unpacked Chrome extension. No build step or package installation is required.

1. Download the repository as a ZIP and extract it, or clone it with Git.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**, then choose the project folder containing `manifest.json`.
5. Click the News Reader extension icon to open the dashboard. If it is hidden, open Chrome's Extensions menu and pin it.

After updating the project files, select **Reload** on the extension's card at `chrome://extensions`, then open a new dashboard tab. Opening `feed.html` directly from disk will not work correctly because it requires Chrome's extension APIs and permissions.

## Use the dashboard

### Add and manage feeds

Select **Add Widget** below the dashboard to reveal the widget creation forms. Select **Hide widget forms** to collapse them again.

1. In **Add an RSS widget**, enter an HTTP or HTTPS feed URL and choose the number of posts. Optionally enter a widget title; otherwise the feed's title is used.
2. Select **Add widget** and approve Chrome's requested host permissions.
3. Use **Refresh** to reload a widget, **Remove** to remove it, and its post-count control and **Save** to change how many entries it shows.

Prefer HTTPS: HTTP feeds are unencrypted. A feed may contain fewer entries than the configured count. The Google News widget can also be removed and restored using **Add Google News widget**; its post count is retained.

### OPML directories

Adding an OPML URL creates a directory widget rather than automatically fetching all feeds in the document. The post count controls how many entries appear at a time; select **Show more** for additional entries. Select **Add feed** beside an entry, then submit the populated add-widget form and grant the requested permissions. Some directory entries may be obsolete.

### Website widgets

In **Add website widget**, enter an HTTP or HTTPS URL, an optional title, and a width and height from 100 to 3000 pixels. Use the widget's **Settings** to change them later. Website widgets span both grid columns when available. The frame width is capped to the available widget width; its specified height is retained. Widget URLs and dimensions are saved locally. The iframe uses a sandbox that allows scripts, forms, and popups but not same-origin privileges. Some websites prohibit embedding or need capabilities restricted by the sandbox and will not work; an iframe's load event cannot reliably detect these failures. Embedded sites receive requests directly, including your IP address; only embed sites you trust. Prefer HTTPS for privacy.

### Forex News API

Enter your own Forex News API key in **Add Forex News widget** and approve access to `forexnewsapi.com`. Select **Config** in the widget to show or hide its post count, API key, and URL settings. The widget defaults to general news; its API URL setting accepts the provider's `/api/v1` and `/api/v1/category` endpoints and query filters, for example `https://forexnewsapi.com/api/v1?currencypair-include=EUR-USD,GBP-USD&page=1`. Save the URL to apply it. If the pasted URL contains `token`, it replaces the saved API key and is removed from the displayed URL. The separate post-count setting overrides any `items` parameter in the pasted URL and is limited to 1–50. Removing the widget deletes its saved key. Availability, quotas, filters, and access depend on your API plan.

The API key is stored in Chrome's local extension storage, **not encrypted by this extension**. Anyone with access to the Chrome profile or extension storage may be able to read it. The provider requires the key in the request URL, which may be visible to the provider, browser developer tools, or diagnostic logs; the widget does not display it in its Refresh tooltip. Do not commit keys to the repository. If a key is exposed, rotate it with the provider.

### Language

Google News uses the Spanish edition when Chrome's interface language starts with Spanish and the US English edition otherwise. The dashboard provides English and Spanish UI text.

## Privacy and permissions

- **Storage:** Widget settings and positions are stored locally in `chrome.storage.local`, not synchronized by this extension. Feed contents are fetched when widgets load rather than saved as settings.
- **Google News:** The built-in widget requests headlines from `news.google.com`. It does not perform third-party image searches.
- **Custom feeds:** Chrome asks for HTTP and HTTPS access to the feed host. Some known redirects also require access to a destination host. Feed requests omit credentials, so authenticated feeds may not work.
- **Images:** Custom feed images load directly from the image host, which can see your IP address. A feed or image provider can also see requests made to its servers.
- **Optional host permissions:** The manifest declares HTTP and HTTPS hosts as optional so the extension can ask for specific feed hosts when you add or refresh widgets; it does not request access to every host at installation.

## Troubleshooting

- **Permission or network error:** Refresh the widget and approve the requested host access. If the feed redirects to a different host, try adding the final URL instead. Providers may also block extension requests.
- **MarketWatch feeds:** Legacy MarketWatch feed URLs redirect through `feeds.marketwatch.com` to `feeds.content.dowjones.io`; the extension requests access to these destinations when needed. Some legacy feeds may contain old articles even when they load successfully.
- **HTTP 429:** The provider is rate-limiting requests. Wait before refreshing.
- **Invalid feed:** Check that the URL serves RSS, Atom, or OPML XML rather than a web page. An OPML document lists feeds; it is not itself an article feed.
- **Missing images:** Not all feeds provide images, and image hosts may block them.
- **After an update:** Reload the extension on `chrome://extensions` and open a new dashboard tab.

## Project files and development

`manifest.json` defines the Manifest V3 extension and permissions. `background.js` opens the dashboard; `feed.html`, `feed.css`, and `feed.js` implement its interface and feed loading. `_locales/` contains extension messages. There are no build dependencies or automated test suite in the repository. To check JavaScript syntax with Node.js, run `node --check feed.js` and `node --check background.js`; test extension APIs and feed loading in Chrome with the unpacked extension.

## Attribution and licensing

This project is based on the Google Chrome `news_i18n` example, previously described in this project as licensed under Google's BSD license. No complete project license or upstream license text is currently included; confirm the applicable license and include the required notices before redistributing. The project owner has not specified a license for additional changes.