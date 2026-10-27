import { fetch } from "@tauri-apps/plugin-http";
import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import type { Article, Source } from "../types";
import { parseFeed } from "./feedParser";

const USER_AGENT = "NewsFuse/0.1 (+desktop RSS reader)";
const TIMEOUT_MS = 15000;

async function getText(url: string, accept: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFeed(source: Source): Promise<Article[]> {
  const xml = await getText(source.url, "application/rss+xml, application/atom+xml, application/xml, text/xml, */*");
  return parseFeed(xml, source.id, source.url);
}

export interface ReadableArticle {
  title?: string;
  byline?: string;
  contentHtml: string;
}

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "button"],
    ADD_ATTR: ["target"],
  });
}

function absolutizeUrls(doc: Document, base: string) {
  const fix = (el: Element, attr: string) => {
    const v = el.getAttribute(attr);
    if (!v) return;
    try {
      el.setAttribute(attr, new URL(v, base).toString());
    } catch {
      /* leave as is */
    }
  };
  doc.querySelectorAll("img[src]").forEach((el) => fix(el, "src"));
  doc.querySelectorAll("a[href]").forEach((el) => fix(el, "href"));
  doc.querySelectorAll("img[srcset]").forEach((el) => el.removeAttribute("srcset"));
  doc.querySelectorAll("img[data-src]").forEach((el) => {
    const v = el.getAttribute("data-src");
    if (v && !el.getAttribute("src")) el.setAttribute("src", v);
  });
}

export async function fetchReadable(url: string): Promise<ReadableArticle | null> {
  const html = await getText(url, "text/html, application/xhtml+xml, */*");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const baseEl = doc.createElement("base");
  baseEl.href = url;
  doc.head.prepend(baseEl);
  absolutizeUrls(doc, url);
  const parsed = new Readability(doc, { charThreshold: 200 }).parse();
  if (!parsed?.content) return null;
  return {
    title: parsed.title ?? undefined,
    byline: parsed.byline ?? undefined,
    contentHtml: sanitize(parsed.content),
  };
}
