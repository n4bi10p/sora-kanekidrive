const BASE = "https://n4bi10p.vercel.app";
const RAW = `${BASE}/api/raw/?path=`;

/**
 * Search anime / movies by filename
 */
async function search(query) {
  const res = await fetch(BASE);
  const html = await res.text();

  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [...doc.querySelectorAll("a")];

  const results = [];

  for (const a of links) {
    const title = a.textContent.trim();
    const href = a.getAttribute("href");

    if (!href) continue;
    if (!title.toLowerCase().includes(query.toLowerCase())) continue;

    results.push({
      title,
      path: decodeURIComponent(href),
      url: BASE + href
    });
  }

  return results;
}

/**
 * Load stream for selected file
 */
async function load(item) {
  const streamUrl = RAW + item.path;

  return {
    title: item.title,
    streams: [
      {
        url: streamUrl,
        quality: "Auto",
        type: "MP4"
      }
    ]
  };
}

export { search, load };
