// Web worker for parsing XMLTV and keeping the active schedule window in memory

self.onmessage = function (e: MessageEvent) {
  const { xmlContent, windowStartMs, windowEndMs } = e.data;
  if (!xmlContent) {
    self.postMessage({ type: 'COMPLETE', programs: [] });
    return;
  }

  const programs: any[] = [];

  try {
    // Regex-based fast parser for XMLTV <programme> blocks
    // <programme start="20261005120000 +0000" stop="20261005130000 +0000" channel="bbc1.uk">
    //   <title lang="en">News at One</title>
    //   <desc lang="en">Description</desc>
    // </programme>
    const progRegex = /<programme\s+start="([^"]+)"\s+stop="([^"]+)"\s+channel="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/gi;
    let match;

    while ((match = progRegex.exec(xmlContent)) !== null) {
      const rawStart = match[1];
      const rawStop = match[2];
      const channelId = match[3];
      const inner = match[4];

      const startMs = parseXmltvDate(rawStart);
      const stopMs = parseXmltvDate(rawStop);

      // Only retain programs overlapping the visible time window
      if (windowStartMs && windowEndMs) {
        if (stopMs < windowStartMs || startMs > windowEndMs) {
          continue;
        }
      }

      const titleMatch = inner.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch = inner.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i);
      const catMatch = inner.match(/<category[^>]*>([\s\S]*?)<\/category>/i);

      programs.push({
        id: `epg-${channelId}-${startMs}`,
        channelId,
        title: titleMatch ? decodeEntities(titleMatch[1].trim()) : 'Scheduled Broadcast',
        description: descMatch ? decodeEntities(descMatch[1].trim()) : '',
        category: catMatch ? decodeEntities(catMatch[1].trim()) : 'General',
        start: startMs,
        end: stopMs,
      });
    }

    self.postMessage({ type: 'COMPLETE', programs });
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', error: err?.message || 'XMLTV parse error' });
  }
};

function parseXmltvDate(dateStr: string): number {
  try {
    // Standard format: YYYYMMDDHHmmss [+/-]HHMM
    const clean = dateStr.trim();
    const year = parseInt(clean.substring(0, 4), 10);
    const month = parseInt(clean.substring(4, 6), 10) - 1;
    const day = parseInt(clean.substring(6, 8), 10);
    const hour = parseInt(clean.substring(8, 10), 10);
    const min = parseInt(clean.substring(10, 12), 10);
    const sec = parseInt(clean.substring(12, 14), 10);
    return Date.UTC(year, month, day, hour, min, sec);
  } catch {
    return Date.now();
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
