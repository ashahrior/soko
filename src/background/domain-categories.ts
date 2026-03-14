/**
 * Domain → content-type mapping used by the smart categorizer.
 *
 * Keys are bare domains (no `www.` prefix). The categorizer also checks
 * whether a hostname *ends with* `.${domain}` so subdomains are covered
 * automatically (e.g. `music.youtube.com` → "Video").
 *
 * Add new entries here to teach Knots about more sites.
 */

export const DOMAIN_CATEGORY_MAP: Readonly<Record<string, string>> = {
  // ── Video ───────────────────────────────────────────────────────────────
  "youtube.com": "Video",
  "youtu.be": "Video",
  "vimeo.com": "Video",
  "twitch.tv": "Video",
  "dailymotion.com": "Video",
  "netflix.com": "Video",
  "disneyplus.com": "Video",
  "hulu.com": "Video",
  "primevideo.com": "Video",
  "crunchyroll.com": "Video",
  "rumble.com": "Video",
  "odysee.com": "Video",
  "nebula.tv": "Video",
  "ted.com": "Video",
  "loom.com": "Video",

  // ── Article / Blog ─────────────────────────────────────────────────────
  "medium.com": "Article",
  "substack.com": "Article",
  "dev.to": "Article",
  "hashnode.com": "Article",
  "blogger.com": "Article",
  "wordpress.com": "Article",
  "ghost.org": "Article",
  "mirror.xyz": "Article",
  "bearblog.dev": "Article",
  "telegra.ph": "Article",
  "write.as": "Article",

  // ── News ────────────────────────────────────────────────────────────────
  "bbc.com": "News",
  "bbc.co.uk": "News",
  "cnn.com": "News",
  "reuters.com": "News",
  "apnews.com": "News",
  "theguardian.com": "News",
  "nytimes.com": "News",
  "washingtonpost.com": "News",
  "techcrunch.com": "News",
  "theverge.com": "News",
  "arstechnica.com": "News",
  "wired.com": "News",
  "engadget.com": "News",
  "bleepingcomputer.com": "News",

  // ── Code / Dev ──────────────────────────────────────────────────────────
  "github.com": "Code",
  "gitlab.com": "Code",
  "bitbucket.org": "Code",
  "codepen.io": "Code",
  "stackblitz.com": "Code",
  "replit.com": "Code",
  "codesandbox.io": "Code",
  "jsfiddle.net": "Code",
  "gist.github.com": "Code",
  "npmjs.com": "Code",
  "pypi.org": "Code",
  "crates.io": "Code",
  "pkg.go.dev": "Code",
  "hub.docker.com": "Code",

  // ── Q&A ─────────────────────────────────────────────────────────────────
  "stackoverflow.com": "Q&A",
  "superuser.com": "Q&A",
  "serverfault.com": "Q&A",
  "askubuntu.com": "Q&A",
  "stackexchange.com": "Q&A",
  "quora.com": "Q&A",

  // ── Forum / Community ──────────────────────────────────────────────────
  "reddit.com": "Forum",
  "news.ycombinator.com": "Forum",
  "lobste.rs": "Forum",
  "lemmy.world": "Forum",
  "discourse.org": "Forum",

  // ── Social ──────────────────────────────────────────────────────────────
  "twitter.com": "Social",
  "x.com": "Social",
  "facebook.com": "Social",
  "instagram.com": "Social",
  "linkedin.com": "Social",
  "threads.net": "Social",
  "mastodon.social": "Social",
  "bsky.app": "Social",
  "tiktok.com": "Social",
  "pinterest.com": "Social",
  "tumblr.com": "Social",

  // ── Music / Audio ──────────────────────────────────────────────────────
  "spotify.com": "Music",
  "soundcloud.com": "Music",
  "music.apple.com": "Music",
  "music.youtube.com": "Music",
  "bandcamp.com": "Music",
  "tidal.com": "Music",
  "deezer.com": "Music",

  // ── Podcast ─────────────────────────────────────────────────────────────
  "podcasts.apple.com": "Podcast",
  "podcasts.google.com": "Podcast",
  "pocketcasts.com": "Podcast",
  "overcast.fm": "Podcast",
  "castbox.fm": "Podcast",

  // ── Design ──────────────────────────────────────────────────────────────
  "figma.com": "Design",
  "dribbble.com": "Design",
  "behance.net": "Design",
  "canva.com": "Design",
  "sketch.com": "Design",
  "framer.com": "Design",
  "coolors.co": "Design",
  "unsplash.com": "Design",
  "pexels.com": "Design",

  // ── Docs / Wiki / Knowledge ────────────────────────────────────────────
  "docs.google.com": "Docs",
  "notion.so": "Docs",
  "confluence.atlassian.net": "Docs",
  "obsidian.md": "Docs",
  "gitbook.io": "Docs",
  "readthedocs.io": "Docs",
  "wikipedia.org": "Docs",
  "wikiwand.com": "Docs",
  "archivebox.io": "Docs",

  // ── Learning / Education ───────────────────────────────────────────────
  "coursera.org": "Learning",
  "udemy.com": "Learning",
  "edx.org": "Learning",
  "khanacademy.org": "Learning",
  "pluralsight.com": "Learning",
  "skillshare.com": "Learning",
  "frontendmasters.com": "Learning",
  "egghead.io": "Learning",
  "codecademy.com": "Learning",
  "freecodecamp.org": "Learning",
  "leetcode.com": "Learning",
  "hackerrank.com": "Learning",

  // ── Tools / Productivity ───────────────────────────────────────────────
  "trello.com": "Tool",
  "asana.com": "Tool",
  "linear.app": "Tool",
  "jira.atlassian.net": "Tool",
  "airtable.com": "Tool",
  "miro.com": "Tool",
  "excalidraw.com": "Tool",
  "vercel.com": "Tool",
  "netlify.com": "Tool",
  "render.com": "Tool",

  // ── AI ──────────────────────────────────────────────────────────────────
  "chat.openai.com": "AI",
  "chatgpt.com": "AI",
  "claude.ai": "AI",
  "bard.google.com": "AI",
  "gemini.google.com": "AI",
  "perplexity.ai": "AI",
  "huggingface.co": "AI",
  "midjourney.com": "AI",

  // ── Shopping ────────────────────────────────────────────────────────────
  "amazon.com": "Shopping",
  "amazon.co.uk": "Shopping",
  "amazon.de": "Shopping",
  "amazon.in": "Shopping",
  "ebay.com": "Shopping",
  "etsy.com": "Shopping",
  "aliexpress.com": "Shopping",

  // ── Reference / Research ───────────────────────────────────────────────
  "arxiv.org": "Research",
  "scholar.google.com": "Research",
  "researchgate.net": "Research",
  "semanticscholar.org": "Research",
  "pubmed.ncbi.nlm.nih.gov": "Research",
};
