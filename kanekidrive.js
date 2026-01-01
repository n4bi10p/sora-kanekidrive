const BASE = "https://n4bi10p.vercel.app";
const RAW = `${BASE}/api/raw/?path=`;

async function search(query) {
  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(query)}`
  );
  return await res.json();
}

async function load(item) {
  return {
    title: item.title,
    streams: [
      {
        url: RAW + item.path,
        quality: "Auto",
        type: "MP4"
      }
    ]
  };
}

export { search, load };
