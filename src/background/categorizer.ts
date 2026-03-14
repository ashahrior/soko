/**
 * Smart categorization based on the URL's hostname.
 *
 * Maps well-known domains to content types.
 * Falls back to "Webpage" when no match is found or when the feature is disabled.
 */

const DOMAIN_CATEGORY_MAP: Record<string, string> = {
  "youtube.com": "Video",
  "youtu.be": "Video",
  "vimeo.com": "Video",
  "twitch.tv": "Video",
  "dailymotion.com": "Video",

  "medium.com": "Article",
  "substack.com": "Article",
  "dev.to": "Article",
  "hashnode.com": "Article",
  "blogger.com": "Article",
  "wordpress.com": "Article",

  "github.com": "Code",
  "gitlab.com": "Code",
  "bitbucket.org": "Code",
  "codepen.io": "Code",
  "stackblitz.com": "Code",

  "stackoverflow.com": "Q&A",
  "superuser.com": "Q&A",
  "serverfault.com": "Q&A",
  "askubuntu.com": "Q&A",

  "reddit.com": "Forum",
  "news.ycombinator.com": "Forum",
};

/**
 * Determine the content type of a URL.
 * @param url Full URL string
 * @param enabled Whether smart categorization is enabled
 */
export function categorize(url: string, enabled = true): string {
  if (!enabled) return "Webpage";

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    // Direct match
    if (DOMAIN_CATEGORY_MAP[hostname]) {
      return DOMAIN_CATEGORY_MAP[hostname];
    }

    // Check if hostname ends with any known domain (handles subdomains)
    for (const [domain, category] of Object.entries(DOMAIN_CATEGORY_MAP)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return category;
      }
    }
  } catch {
    // Invalid URL — fall through
  }

  return "Webpage";
}
