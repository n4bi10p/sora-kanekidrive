
const BASE_URL = "https://n4bi10p.vercel.app";

const FOLDER_MAP = {
    "01XOT3RXX7JQLISJGVFBDIK4PGBD7U4GH7": "/BotUpload",
    "01XOT3RXVSTY7LQNUAPNDYMM2S3JJ3I7QU": "/BotUpload/ae presets n all/User Presets/500 Bounce Text Presets/IN",
    "01XOT3RXRLLVTSNXJIWZG2MZ2SPSN247OR": "/BotUpload/n4bi1AE",
    // "01XOT3RXXJTTJCWD4C4ZHZWKJ5VQAFHA25": "/Path/To/CountFolder"
};

// Helper for Base64 encoding/decoding in environment without Buffer
const Base64 = {
    encode: (str) => {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) { return ""; }
    },
    decode: (str) => {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) { return ""; }
    }
};

class Anilist {
    static async search(keyword, filters = {}) {
        const query = `query (
                $search: String,
                $page: Int,
                $perPage: Int,
                $type: MediaType,
                $isAdult: Boolean
            ) {
                Page(page: $page, perPage: $perPage) {
                media(
                    search: $search,
                    type: $type,
                    isAdult: $isAdult
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    coverImage {
                        extraLarge
                        large
                        medium
                    }
                    description
                    seasonYear
                    bannerImage
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 10,
            "search": keyword,
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async lookup(filters) {
        const query = `query (
                $id: Int
            ) {
                Page(page: 1, perPage: 1) {
                media(
                    id: $id
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    status
                    description
                    seasonYear
                    coverImage {
                        extraLarge
                        large
                    }
                    bannerImage
                }
            }
        }`;

        const variables = {
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async anilistFetch(query, variables) {
        const url = 'https://graphql.anilist.co/';
        try {
            const response = await soraFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response) return null;
            if (!response.ok && response.status != 200) return null;

            const json = await response.json();
            return json?.data;
        } catch (error) {
            console.error('Error fetching Anilist data:', error);
            return null;
        }
    }
}

async function soraFetch(url, options = {}) {
    try {
        if (typeof fetchv2 !== 'undefined') {
            return await fetchv2(
                url,
                options.headers || {},
                options.method || 'GET',
                options.body || null,
                true,
                options.encoding || 'utf-8'
            );
        } else {
            return await fetch(url, options);
        }
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            console.error("soraFetch failed:", error);
            return null;
        }
    }
}

function cleanFilename(filename) {
    let name = filename.replace(/\.[^/.]+$/, "");
    name = name.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/\{.*?\}/g, "");
    const keywords = [
        "1080p", "720p", "480p", "4k", "2160p",
        "web", "bluray", "bd", "hdtv",
        "x264", "x265", "hevc", "av1", "h264",
        "aac", "ac3", "dts",
        "dual audio", "multi-audio", "multi audio"
    ];
    const regex = new RegExp(`(${keywords.join("|")})`, "gi");
    name = name.replace(regex, "");
    name = name.replace(/[\.\-_]/g, " ");
    return name.trim();
}

async function searchResults(keyword) {
    try {
        const url = `${BASE_URL}/api/search?q=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(url, { headers: { "User-Agent": "KanekiDrive/1.0" } });

        const isSuccess = response && (response.ok || response.status == 200);

        if (!isSuccess) {
            return JSON.stringify([{
                title: "Error: API Fetch Failed",
                image: "https://via.placeholder.com/300x450.png?text=Error",
                href: "error"
            }]);
        }

        const data = await response.json();

        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data.files || data.folders) {
            items = [...(data.folders || []), ...(data.files || [])];
        }

        // DEDUPLICATION & GROUPING
        const seen = new Set();
        const groupedResults = [];

        // Prioritize folders matching the keyword
        items.forEach(item => {
            // Logic:
            // 1. If item is a folder, use it directly.
            // 2. If item is a file, use its PARENT folder as the result (grouping).
            // 3. Skip if we've already added this ID/ParentID.

            let targetId = item.id;
            let targetName = item.name;
            let type = item.file ? 'file' : 'folder';

            // If it's a file, try to group by parent
            if (item.file && item.parentReference) {
                targetId = item.parentReference.id;
                // We don't have the parent name easily from search result usually, 
                // but we might use the file name as a proxy for search, 
                // or just accept we show the file's context.
                // Better strategy: Use the file name but link to parent folder?
                // No, user wants "Demon Slayer" not "Demon Slayer Ep 1".
                // We'll use the parent ID.
                type = 'folder';
                // Note: We don't know the parent Name, so we clean the File Name 
                // and hope it represents the show.
                targetName = item.name;
            }

            if (!seen.has(targetId)) {
                seen.add(targetId);
                groupedResults.push({
                    id: targetId,
                    name: targetName,
                    type: type,
                    originalItem: item
                });
            }
        });

        const results = await Promise.all(groupedResults.slice(0, 15).map(async (item) => {
            const cleanName = cleanFilename(item.name);
            let image = "";
            let description = "";
            let anilistId = 0;

            try {
                const aniData = await Anilist.search(cleanName, { isAdult: false });
                if (aniData?.Page?.media?.[0]) {
                    const media = aniData.Page.media[0];
                    image = media.coverImage.extraLarge || media.coverImage.large;
                    description = media.description;
                    anilistId = media.id;
                }
            } catch (e) {
                console.log("Metadata fetch failed for " + cleanName);
            }

            if (!image) image = "https://via.placeholder.com/300x450.png?text=No+Image";

            const payload = {
                type: item.type, // 'folder' if grouped
                id: item.id,
                anilistId: anilistId,
                name: cleanName // Use cleaned name for display
            };

            const href = `kdrv://${Base64.encode(JSON.stringify(payload))}`;

            return {
                title: cleanName,
                image: image,
                href: href,
                description: description
            };
        }));

        if (results.length === 0) {
            results.push({
                title: "No Results Found",
                image: "https://via.placeholder.com/300x450.png?text=Empty",
                href: "empty"
            });
        }

        return JSON.stringify(results);
    } catch (error) {
        console.error("searchResults error:", error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        if (url === "error" || url === "empty" || url === "crash") {
            return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
        }

        let payload = {};
        if (url.startsWith("kdrv://")) {
            const base64 = url.replace("kdrv://", "");
            payload = JSON.parse(Base64.decode(base64));
        } else {
            payload = { id: url, type: "file", name: "Unknown" };
        }

        let description = `Watch ${payload.name} on KanekiDrive.`;
        let year = "Unknown";

        if (payload.anilistId) {
            const aniData = await Anilist.lookup({ id: payload.anilistId });
            if (aniData?.Page?.media?.[0]) {
                const media = aniData.Page.media[0];
                description = media.description || description;
                year = media.seasonYear || "Unknown";
            }
        }

        if (description) {
            description = description.replace(/<[^>]+>/g, '');
        }

        const details = [{
            description: description,
            aliases: "Source: OneDrive",
            airdate: `Released: ${year}`
        }];

        return JSON.stringify(details);
    } catch (error) {
        console.error("extractDetails error:", error);
        return JSON.stringify([{ description: "Error loading details", aliases: "", airdate: "" }]);
    }
}


// Helper for recursive folder listing
async function listFolderRecursively(path, depth = 0, maxDepth = 2) {
    if (depth > maxDepth) return [];

    try {
        const url = `${BASE_URL}/api?path=${encodeURIComponent(path)}`;
        // Add User-Agent header (Standard Chrome to avoid bot detection)
        const response = await soraFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
        if (!response || !response.ok) return [];

        const json = await response.json();
        const items = json.folder?.value || [];

        let allFiles = [];

        for (const item of items) {
            if (item.folder) {
                const subFiles = await listFolderRecursively(`${path}/${item.name}`, depth + 1, maxDepth);
                allFiles = [...allFiles, ...subFiles];
            } else if (item.file) {
                item._parentPath = path;
                allFiles.push(item);
            }
        }

        return allFiles;
    } catch (e) {
        console.error("Recursive list error:", e.message);
        return [];
    }
}

async function extractEpisodes(url) {
    try {
        if (url === "error" || url === "empty" || url === "crash") return JSON.stringify([]);

        let payload = {};
        if (url.startsWith("kdrv://")) {
            const base64 = url.replace("kdrv://", "");
            payload = JSON.parse(Base64.decode(base64));
        } else {
            payload = { id: url, type: "file", name: "Unknown" };
        }

        if (payload.type === 'file') {
            const href = `kdrv://${Base64.encode(JSON.stringify(payload))}`;
            return JSON.stringify([{
                href: href,
                number: 1,
                title: payload.name || "Movie / Episode"
            }]);
        }

        let listPath = "";


        if (FOLDER_MAP[payload.id]) {
            listPath = FOLDER_MAP[payload.id];
        } else {
            console.error(`[DEBUG] Resolving path dynamically for ${payload.id}`);
            try {
                const itemUrl = `${BASE_URL}/api/item?id=${payload.id}`;
                const itemRes = await soraFetch(itemUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });

                if (itemRes && (itemRes.ok || itemRes.status == 200)) {
                    const itemData = await itemRes.json();
                    if (itemData.parentReference && itemData.parentReference.path) {
                        const rawPath = itemData.parentReference.path;
                        const cleanParent = rawPath.replace("/drive/root:", "");
                        listPath = `${cleanParent}/${itemData.name}`;
                    } else if (!itemData.parentReference && itemData.name) {
                        listPath = `/${itemData.name}`;
                    }
                } else {
                    // UI DEBUG: Return error episode
                    return JSON.stringify([{
                        href: "error",
                        number: 1,
                        title: `Error: Item API ${itemRes ? itemRes.status : 'Null'}`
                    }]);
                }
            } catch (e) {
                return JSON.stringify([{
                    href: "error",
                    number: 1,
                    title: `Error: Path Resolve Crash ${e.message}`
                }]);
            }
        }

        if (!listPath) {
            console.error("[DEBUG] No listPath found, returning empty.");
            return JSON.stringify([{
                href: "error",
                number: 1,
                title: `Error: No Path Found For ID ${payload.id}`
            }]);
        }

        const files = await listFolderRecursively(listPath);

        if (files.length === 0) {
            return JSON.stringify([{
                href: "error",
                number: 1,
                title: `Error: No Files in ${listPath}`
            }]);
        }

        // Improve sorting: Try to parse S01E01 if possible, else name sort
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        const episodes = files.map((f, i) => {
            const epPayload = {
                type: 'file',
                id: f.id,
                name: f.name,
                anilistId: payload.anilistId,
                parentPath: f._parentPath
            };

            return {
                href: `kdrv://${Base64.encode(JSON.stringify(epPayload))}`,
                number: i + 1,
                title: f.name
            };
        });

        return JSON.stringify(episodes);

    } catch (error) {
        console.error("[DEBUG] extractEpisodes crash:", error.message);
        return JSON.stringify([{
            href: "error",
            number: 1,
            title: `Crash: ${error.message}`
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        let payload = {};
        if (url.startsWith("kdrv://")) {
            const base64 = url.replace("kdrv://", "");
            payload = JSON.parse(Base64.decode(base64));
        } else {
            payload = { id: url };
        }

        let streamUrl = "";

        let fullPath = "";

        // 1. Try Known Parent Path (from Search/Map)
        if (payload.parentPath) {
            fullPath = `${payload.parentPath}/${payload.name}`;
        } else {
            // 2. Dynamic Lookup via ID
            try {
                const itemUrl = `${BASE_URL}/api/item?id=${payload.id}`;
                const itemRes = await soraFetch(itemUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
                if (itemRes && (itemRes.ok || itemRes.status == 200)) {
                    const itemData = await itemRes.json();
                    if (itemData.parentReference && itemData.parentReference.path) {
                        // usage: "/drive/root:/BotUpload/n4bi1AE" -> "/BotUpload/n4bi1AE"
                        const rawPath = itemData.parentReference.path;
                        const cleanParent = rawPath.replace("/drive/root:", "");
                        fullPath = `${cleanParent}/${payload.name}`;
                    }
                }
            } catch (e) {
                console.log("Dynamic path lookup failed for " + payload.name);
            }

            if (!fullPath) {
                // 3. Fallback to root
                fullPath = `/${payload.name}`;
            }
        }

        streamUrl = `${BASE_URL}/api/raw?path=${encodeURIComponent(fullPath)}&raw=true`;

        const result = {
            streams: [{
                title: "OneDrive Direct",
                streamUrl: streamUrl,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Referer": BASE_URL
                }
            }],
            subtitles: []
        };

        return JSON.stringify(result);
    } catch (error) {
        console.error("extractStreamUrl error:", error);
        return JSON.stringify({ streams: [], subtitles: [] });
    }
}
