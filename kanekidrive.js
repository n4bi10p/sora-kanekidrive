const BASE = "https://n4bi10p.vercel.app";

/**
 * THIS is what Sora calls.
 * Name MUST be searchResults
 */
async function searchResults(keyword) {
  if (!keyword || !keyword.trim()) return [];

  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(keyword)}`
  );

  const files = await res.json();

  if (!files.length) return [];

  // Group files by anime name
  const map = new Map();

  for (const file of files) {
    const match = file.title.match(/^(.*?)(?:\.S\d{1,2}E\d{1,3})/i);
    const title = match
      ? match[1].replace(/\./g, " ").trim()
      : keyword;

    if (!map.has(title)) {
      map.set(title, {
        title,
        image: "https://n4bi10p.vercel.app/favicon.ico",
        href: title.toLowerCase().replace(/\s+/g, "-")
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Called when user clicks a search result
 */
async function loadDetails(href) {
  const query = href.replace(/-/g, " ");

  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(query)}`
  );

  const files = await res.json();

  const episodes = files
    .map(file => {
      const match = file.title.match(/E(\d{1,3})/i);
      if (!match) return null;

      return {
        title: file.title,
        href: file.path
      };
    })
    .filter(Boolean);

  return episodes;
}

/**
 * Called to resolve stream
 */
async function loadStreams(href) {
  return [
    {
      url: `${BASE}/api/raw/?path=${href}`,
      quality: "Auto",
      type: "MP4",
      headers: {
        Referer: BASE
      }
    }
  ];
}

export { searchResults, loadDetails, loadStreams };
