const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const pickId = (value) => {
  if (!value) return null;
  const candidate = value.trim();
  return VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
};

export const extractYouTubeVideoId = (input) => {
  if (!input) return null;

  const raw = input.trim();
  if (!raw) return null;

  const directId = pickId(raw);
  if (directId) return directId;

  const urlCandidates = /^https?:\/\//i.test(raw) ? [raw] : [raw, `https://${raw}`];

  for (const candidate of urlCandidates) {
    try {
      const url = new URL(candidate);
      const hostname = url.hostname.replace(/^www\./, "").replace(/^m\./, "").toLowerCase();

      if (hostname === "youtu.be") {
        const shortId = pickId(url.pathname.split("/").filter(Boolean)[0] ?? "");
        if (shortId) return shortId;
      }

      if (hostname === "youtube.com" || hostname === "youtube-nocookie.com") {
        const watchId = pickId(url.searchParams.get("v") ?? "");
        if (watchId) return watchId;

        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length >= 2) {
          if (["shorts", "embed", "live", "v"].includes(pathParts[0])) {
            const pathId = pickId(pathParts[1]);
            if (pathId) return pathId;
          }
        }
      }
    } catch {
      // Ignore invalid URL and continue fallback parsing.
    }
  }

  const fallbackMatch = raw.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/i);
  return fallbackMatch?.[1] ?? null;
};
