const BASE = "https://n4bi10p.vercel.app";

/**
 * REQUIRED: Source-scoped search
 */
export async function searchResults(keyword) {
  if (!keyword || !keyword.trim()) return [];

  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(keyword)}`
  );

  const files = await res.json();
  if (!Array.isArray(files) || files.length === 0) return [];

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
 * REQUIRED: Load items when a result is clicked
 */
export async function loadDetails(href) {
  const query = href.replace(/-/g, " ");

  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(query)}`
  );

  const files = await res.json();
  if (!Array.isArray(files)) return [];

  return files
    .map(file => {
      const match = file.title.match(/E(\d{1,3})/i);
      if (!match) return null;

      return {
        title: file.title,
        href: file.path
      };
    })
    .filter(Boolean);
}

/**
 * REQUIRED: Resolve stream
 */
export async function loadStreams(href) {
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
