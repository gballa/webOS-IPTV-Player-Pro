// Web Worker for asynchronous parsing of massive M3U/M3U8 playlists

self.onmessage = function (e: MessageEvent) {
  const { content, chunkLimit } = e.data;
  if (!content) {
    self.postMessage({ type: 'ERROR', error: 'No playlist content provided' });
    return;
  }

  const lines = content.split(/\r?\n/);
  const channels: any[] = [];
  const groupsSet = new Set<string>();

  let currentExtinf: string | null = null;
  let chNo = 1;
  const totalLines = lines.length;

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtinf = line;
    } else if (!line.startsWith('#') && currentExtinf) {
      // Channel title extraction
      const commaIdx = currentExtinf.indexOf(',');
      let rawTitle = commaIdx !== -1 ? currentExtinf.substring(commaIdx + 1).trim() : 'Channel ' + chNo;

      // Extract attributes
      const tvgIdMatch = currentExtinf.match(/tvg-id=["']([^"']*)["']/i);
      const tvgNameMatch = currentExtinf.match(/tvg-name=["']([^"']*)["']/i);
      const tvgLogoMatch = currentExtinf.match(/tvg-logo=["']([^"']*)["']/i);
      const groupMatch = currentExtinf.match(/group-title=["']([^"']*)["']/i);
      const chnoMatch = currentExtinf.match(/tvg-chno=["']([^"']*)["']/i);

      const name = tvgNameMatch ? tvgNameMatch[1] : rawTitle;
      const group = groupMatch ? groupMatch[1] : 'General';
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : undefined;
      const epgId = tvgIdMatch ? tvgIdMatch[1] : undefined;
      const num = chnoMatch ? parseInt(chnoMatch[1], 10) : chNo;

      const lower = (name + ' ' + group).toLowerCase();
      let resolution = '1080p';
      if (lower.includes('4k') || lower.includes('uhd')) resolution = '4K';
      else if (lower.includes('720p') || lower.includes('sd')) resolution = '720p';

      channels.push({
        id: `ch-${epgId || ''}-${num}-${Math.random().toString(36).substring(2, 6)}`,
        num: isNaN(num) ? chNo : num,
        name: name.trim(),
        group: group.trim(),
        logo,
        streamUrl: line,
        epgId,
        resolution,
        hdr: lower.includes('hdr') ? 'HDR10' : 'SDR',
        isFavorite: false,
      });

      groupsSet.add(group.trim());
      chNo++;
      currentExtinf = null;
    }

    // Periodic progress reporting every 1,500 items
    if (channels.length % 1500 === 0 && channels.length > 0) {
      self.postMessage({
        type: 'PROGRESS',
        parsedCount: channels.length,
        percent: Math.min(99, Math.round((i / totalLines) * 100)),
      });
    }
  }

  self.postMessage({
    type: 'COMPLETE',
    channels,
    groups: Array.from(groupsSet).sort(),
  });
};
