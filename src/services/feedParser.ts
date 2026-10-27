import type { Article } from "../types";

const ATOM_NS = "http://www.w3.org/2005/Atom";
const CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";
const MEDIA_NS = "http://search.yahoo.com/mrss/";
const DC_NS = "http://purl.org/dc/elements/1.1/";
const RSS1_NS = "http://purl.org/rss/1.0/";

function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function text(el: Element | null | undefined): string | undefined {
  const v = el?.textContent?.trim();
  return v ? v : undefined;
}

function firstChild(parent: Element, localName: string, ns?: string): Element | undefined {
  for (const child of Array.from(parent.children)) {
    if (child.localName !== localName) continue;
    if (ns === undefined || child.namespaceURI === ns) return child;
  }
  return undefined;
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
}

function resolveUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

function firstImageFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m?.[1];
}

function extractImage(item: Element, base: string): string | undefined {
  const media = Array.from(item.getElementsByTagNameNS(MEDIA_NS, "content")).find((m) => {
    const medium = m.getAttribute("medium");
    const type = m.getAttribute("type") ?? "";
    return medium === "image" || type.startsWith("image/") || (!medium && !type);
  });
  const thumb = item.getElementsByTagNameNS(MEDIA_NS, "thumbnail")[0];
  const enclosure = Array.from(item.children).find(
    (c) => c.localName === "enclosure" && (c.getAttribute("type") ?? "").startsWith("image/"),
  );
  return (
    resolveUrl(media?.getAttribute("url") ?? undefined, base) ??
    resolveUrl(thumb?.getAttribute("url") ?? undefined, base) ??
    resolveUrl(enclosure?.getAttribute("url") ?? undefined, base)
  );
}

function parseRssItem(item: Element, sourceId: string, base: string): Article | null {
  const title = text(firstChild(item, "title")) ?? "(untitled)";
  const link =
    resolveUrl(text(firstChild(item, "link")), base) ??
    resolveUrl(firstChild(item, "guid")?.getAttribute("isPermaLink") !== "false" ? text(firstChild(item, "guid")) : undefined, base);
  if (!link) return null;
  const guid = text(firstChild(item, "guid")) ?? link;
  const contentHtml = text(firstChild(item, "encoded", CONTENT_NS));
  const summaryHtml = text(firstChild(item, "description"));
  return {
    id: `${sourceId}|${hashId(guid)}`,
    sourceId,
    title,
    link,
    author: text(firstChild(item, "creator", DC_NS)) ?? text(firstChild(item, "author")),
    published: parseDate(text(firstChild(item, "pubDate")) ?? text(firstChild(item, "date", DC_NS))),
    summaryHtml,
    contentHtml,
    imageUrl: extractImage(item, base) ?? firstImageFromHtml(contentHtml ?? summaryHtml),
  };
}

function parseAtomEntry(entry: Element, sourceId: string, base: string): Article | null {
  const links = Array.from(entry.children).filter((c) => c.localName === "link");
  const alt = links.find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") ?? links[0];
  const link = resolveUrl(alt?.getAttribute("href") ?? undefined, base);
  if (!link) return null;
  const id = text(firstChild(entry, "id")) ?? link;
  const contentEl = firstChild(entry, "content");
  const contentHtml = text(contentEl);
  const summaryHtml = text(firstChild(entry, "summary"));
  const enclosure = links.find((l) => l.getAttribute("rel") === "enclosure" && (l.getAttribute("type") ?? "").startsWith("image/"));
  return {
    id: `${sourceId}|${hashId(id)}`,
    sourceId,
    title: text(firstChild(entry, "title")) ?? "(untitled)",
    link,
    author: text(firstChild(firstChild(entry, "author") ?? entry, "name")),
    published: parseDate(text(firstChild(entry, "published")) ?? text(firstChild(entry, "updated"))),
    summaryHtml,
    contentHtml,
    imageUrl:
      extractImage(entry, base) ??
      resolveUrl(enclosure?.getAttribute("href") ?? undefined, base) ??
      firstImageFromHtml(contentHtml ?? summaryHtml),
  };
}

export function parseFeed(xml: string, sourceId: string, feedUrl: string): Article[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Invalid feed XML");
  }
  const root = doc.documentElement;
  const base = feedUrl;
  let articles: (Article | null)[] = [];

  if (root.localName === "feed" && root.namespaceURI === ATOM_NS) {
    articles = Array.from(root.getElementsByTagNameNS(ATOM_NS, "entry")).map((e) => parseAtomEntry(e, sourceId, base));
  } else if (root.localName === "rss") {
    articles = Array.from(root.getElementsByTagName("item")).map((i) => parseRssItem(i, sourceId, base));
  } else if (root.localName === "RDF") {
    articles = Array.from(root.getElementsByTagNameNS(RSS1_NS, "item")).map((i) => parseRssItem(i, sourceId, base));
  } else {
    throw new Error(`Unsupported feed type: <${root.localName}>`);
  }

  const seen = new Set<string>();
  return articles.filter((a): a is Article => {
    if (!a || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}
