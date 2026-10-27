// Quick feed health check: node scripts/check-feeds.mjs
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/data/defaultSources.ts", import.meta.url), "utf8");
const rows = [...src.matchAll(/\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]/g)].map((m) => ({ id: m[1], name: m[2], url: m[3] }));

const results = await Promise.all(
  rows.map(async (r) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(r.url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "NewsFuse/0.1", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
        redirect: "follow",
      });
      const body = await res.text();
      const looksFeed = /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 4000));
      const items = (body.match(/<(item|entry)[\s>]/gi) ?? []).length;
      return { ...r, status: res.status, ok: res.ok && looksFeed && items > 0, items, ct: res.headers.get("content-type") };
    } catch (e) {
      return { ...r, status: 0, ok: false, items: 0, err: e.message };
    } finally {
      clearTimeout(t);
    }
  }),
);

const bad = results.filter((r) => !r.ok);
for (const r of bad) console.log(`FAIL ${r.id.padEnd(22)} ${r.status} items=${r.items} ${r.err ?? r.ct ?? ""} ${r.url}`);
console.log(`\n${results.length - bad.length}/${results.length} OK`);
