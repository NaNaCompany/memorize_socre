# Updates

## 2026-10-31

- Added self-referencing canonical and Open Graph URL, a sitemap.xml containing the public root page, allow-all robots.txt, ads.txt, an app icon, and a subtle More Apps footer link.
- Applied the verified NaNa Lab GA4, GTM including noscript, Google AdSense, and Cloudflare Web Analytics on the served HTML. The shared source helper is tools/publisher-tracking.mjs; regenerate metadata using node tools/site_metadata.mjs. Local/test hosts do not initialize publisher requests. Page-view URLs exclude query strings and fragments; no uploaded file, score content or other input is sent as a custom event.
- Registered one Korean representative card and the app sitemap leaf in the NaNa Lab directory. Catalog descriptions are translated in eight secondary UI languages; this app itself currently serves Korean.
- Reorganized the landing page using score_reading as the visual reference: the same unmodified main.gif, warm white cards, orange primary action, two-column hero with an actual sample preview, three practice groups, and expandable additional examples. Removed decorative introductory copy.
- Kept the MusicXML parser, engraving, audio, exercise modules, uploaded-score storage and progress storage. Added animation pause/resume and still-image previews, including reduced-motion preference support.
- Background provenance and SHA-256 are recorded in assets/background-source.json. Original sample-score demo animations remain the source of practice previews.
- Static/source preservation and runtime checks, public deployment/readback, and browser-verification limits are recorded separately in the workspace release evidence. Browser automation stopped because it could not confidently determine the current Windows browser URL; no browser QA completion is claimed.
