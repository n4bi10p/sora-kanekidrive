const BASE = "https://n4bi10p.vercel.app";
const RAW = `${BASE}/api/raw/?path=`;

/**
 * Search content from OneDrive via Graph-powered API
 */
async function search(query) {
  if (!query || !query.trim()) return [];

  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(query)}`
  );

  return await res.json();
}

/**
 * Load a selected item and return stream info
 */
async function load(item) {
  return {
    title: item.title,
    streams: [
      {
        url: RAW + item.path,
        quality: "Auto",
        type: "MP4",
        headers: {
          Referer: BASE
        }
      }
    ]
  };
}

export { search, load };
