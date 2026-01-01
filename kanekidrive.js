const BASE = "https://n4bi10p.vercel.app";
const RAW = `${BASE}/api/raw/?path=`;

async function getEpisodes(meta) {
  const title = meta.title;
  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(title)}`
  );
  const files = await res.json();

  // map files → episodes
  return files.map(file => {
    const epMatch = file.title.match(/E(\d{1,3})/i);
    return {
      number: epMatch ? parseInt(epMatch[1]) : 0,
      title: file.title,
      file
    };
  }).filter(ep => ep.number > 0);
}

async function load(episode) {
  return {
    title: episode.title,
    streams: [
      {
        url: RAW + episode.file.path,
        quality: "Auto",
        type: "MP4",
        headers: {
          Referer: BASE
        }
      }
    ]
  };
}

export { getEpisodes, load };
