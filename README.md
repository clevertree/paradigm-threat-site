# Paradigm Threat

**[paradigmthreat.net](https://paradigmthreat.net)**

An investigation into alternate Earth history, correlating mainstream (Scaligerian) chronology with Fomenko's New Chronology, Saturnian Cosmology, and other timeline systems. The site presents research articles, media, and an interactive timeline spanning from before creation through the modern era.

## Features

- **Interactive Timeline** — Browse events across multiple chronology systems with TTS narration and a Ken Burns slideshow with smooth crossfade transitions
- **Content Library** — Research articles on cosmology, governance, historical events, and scientific anomalies served from a remote file server
- **Chat** — Real-time discussion channels
- **Search** — Full-text search across all content
- **Image Gallery** — Global lightbox carousel for media across all pages
- **Dark/Light Theme** — Toggle between display modes

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 14 (App Router)
- **Styling:** Tailwind CSS + SCSS
- **Deployment:** [Vercel](https://vercel.com)
- **Analytics:** Vercel Analytics + Speed Insights
- **Testing:** Cypress (component + E2E)

## Related Repositories

| Repository | Purpose |
|---|---|
| [paradigm-threat-timeline](https://github.com/clevertree/paradigm-threat-timeline) | Timeline data, content markdown, and media |
| [paradigm-threat-files](https://github.com/clevertree/paradigm-threat-files) | Static file server content (articles, images) |

## Development

```bash
npm install
npm run dev
```

Opens on [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_TIMELINE_BASE_URL` | `https://clevertree.github.io/paradigm-threat-timeline` | Timeline data source |
| `NEXT_PUBLIC_FILES_BASE_URL` | `https://files.paradigmthreat.net` | Static file server |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server (port 8081) |
| `npm run cypress:open` | Open Cypress test runner |
