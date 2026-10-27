// node scripts/probe.mjs url1 url2 ...
const urls = process.argv.slice(2);
await Promise.all(
  urls.map(async (url) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "NewsFuse/0.1", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
      const body = await res.text();
      const items = (body.match(/<(item|entry)[\s>]/gi) ?? []).length;
      const feed = /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 4000));
      console.log(`${res.status} ${feed && items > 0 ? "OK  " : "BAD "} items=${String(items).padEnd(3)} ${url}`);
    } catch (e) {
      console.log(`ERR BAD  ${url} ${e.message}`);
    } finally {
      clearTimeout(t);
    }
  }),
);
