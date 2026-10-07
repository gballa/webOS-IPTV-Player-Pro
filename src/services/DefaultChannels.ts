import { Channel, Program, VodItem } from '../types/iptv';

export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'ch-nasa-hd',
    num: 1,
    name: 'NASA TV Live HD',
    group: 'Science & Nature',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
    epgId: 'nasa.tv',
    resolution: '1080p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AAC Stereo',
    bitrateKbps: 6200,
    fps: 60,
    isFavorite: true,
  },
  {
    id: 'ch-euronews-en',
    num: 2,
    name: 'Euronews International',
    group: 'News',
    streamUrl: 'https://euronews-euronews-world-1-eu.rakuten.wurl.tv/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png',
    epgId: 'euronews.en',
    resolution: '1080p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AAC Stereo',
    bitrateKbps: 4800,
    fps: 50,
    isFavorite: true,
  },
  {
    id: 'ch-dw-english',
    num: 3,
    name: 'DW News HD',
    group: 'News',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/512px-Deutsche_Welle_symbol_2012.svg.png',
    epgId: 'dw.en',
    resolution: '1080p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AAC-LC',
    bitrateKbps: 5200,
    fps: 50,
  },
  {
    id: 'ch-redbull-tv',
    num: 4,
    name: 'Red Bull TV Extreme',
    group: 'Sports',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png',
    epgId: 'redbull.tv',
    resolution: '1080p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AAC Stereo',
    bitrateKbps: 8500,
    fps: 60,
    isFavorite: true,
  },
  {
    id: 'ch-france24-en',
    num: 5,
    name: 'France 24 HD (English)',
    group: 'News',
    streamUrl: 'https://f24hls-i.akamaihd.net/hls/live/221193/F24_EN_LO_HLS/master_500.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/France_24_logo.svg/512px-France_24_logo.svg.png',
    epgId: 'france24.en',
    resolution: '720p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AAC-LC',
    bitrateKbps: 3400,
    fps: 50,
  },
  {
    id: 'ch-aljazeera-en',
    num: 6,
    name: 'Al Jazeera English HD',
    group: 'News',
    streamUrl: 'https://live-hls-web-aje.getaj.net/AJE/03.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/512px-Al_Jazeera_English_logo.svg.png',
    epgId: 'aje.en',
    resolution: '1080p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AAC Stereo',
    bitrateKbps: 5500,
    fps: 50,
  },
  {
    id: 'ch-test-4k-hdr',
    num: 7,
    name: 'UltraHD 4K HDR10 Test Stream',
    group: 'UHD & HDR Demo',
    streamUrl: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    logo: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=160&auto=format&fit=crop&q=80',
    epgId: 'test.4k',
    resolution: '4K',
    hdr: 'HDR10',
    codec: 'HEVC / H.265',
    audioCodec: 'E-AC3 Atmos',
    bitrateKbps: 18500,
    fps: 60,
    isFavorite: true,
  },
  {
    id: 'ch-sintel-demo',
    num: 8,
    name: 'Cinema 4K Surround Passthrough',
    group: 'Cinema & VOD',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    logo: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=160&auto=format&fit=crop&q=80',
    epgId: 'sintel.cinema',
    resolution: '4K',
    hdr: 'DolbyVision',
    codec: 'HEVC / H.265',
    audioCodec: 'Dolby Atmos 5.1',
    bitrateKbps: 16200,
    fps: 24,
  },
  {
    id: 'ch-tearsofsteel-hd',
    num: 9,
    name: 'Sci-Fi Showcase: Tears of Steel',
    group: 'Cinema & VOD',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    logo: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=160&auto=format&fit=crop&q=80',
    epgId: 'tos.cinema',
    resolution: '1080p',
    hdr: 'SDR',
    codec: 'H.264 / AVC',
    audioCodec: 'AC3 5.1',
    bitrateKbps: 9400,
    fps: 24,
  },
  {
    id: 'ch-classic-cartoons',
    num: 10,
    name: 'Classic Animation Channel',
    group: 'Kids & Family',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    logo: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=160&auto=format&fit=crop&q=80',
    epgId: 'classic.animation',
    resolution: '1080p',
    hdr: 'SDR',
  },
];

export function generateSyntheticEpg(channels: Channel[]): Program[] {
  const programs: Program[] = [];
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const HALF_HOUR = 30 * 60 * 1000;

  // Generate 8 hours of schedule (2 hours past for catchup testing, 6 hours future)
  const baseStart = Math.floor(now / HALF_HOUR) * HALF_HOUR - (2 * ONE_HOUR);

  const sampleTitles: Record<string, { title: string; desc: string; cat: string }[]> = {
    'News': [
      { title: 'Global News Hour Live', desc: 'Comprehensive international coverage, financial markets, and world diplomacy reports.', cat: 'News' },
      { title: 'World Business Today', desc: 'In-depth analysis of global trade, stock indices, and emerging technology sectors.', cat: 'Business' },
      { title: 'Prime Time Debate', desc: 'Experts and analysts deliberate on breaking geopolitical developments and policy shifts.', cat: 'Talk' },
      { title: 'The Headline Review', desc: 'Hourly wrap-up of leading stories from correspondents stationed worldwide.', cat: 'News' },
    ],
    'Science & Nature': [
      { title: 'ISS Live Earth Orbit & Telemetry', desc: 'Live high-definition views from the International Space Station with crew communications.', cat: 'Science' },
      { title: 'Deep Cosmos: James Webb Observations', desc: 'Spectacular deep field imagery and cosmic discovery breakdowns from deep space astrophysicists.', cat: 'Documentary' },
      { title: 'Mars Rover Mission Logs', desc: 'Subsurface geological sampling and atmospheric metrics from the Jezero Crater.', cat: 'Science' },
    ],
    'Sports': [
      { title: 'Extreme World Downhill Cup', desc: 'Elite mountain athletes tackle treacherous alpine trails at breakneck speeds.', cat: 'Sports' },
      { title: 'Red Bull Cliff Diving World Series', desc: 'Acrobatic high dives from 27-meter cliffs into azure waters.', cat: 'Sports' },
      { title: 'Motorsports Highlights & Telemetry', desc: 'Precision racing analysis, aerodynamic breakdowns, and post-race paddock interviews.', cat: 'Sports' },
    ],
    'Cinema & VOD': [
      { title: 'Feature Film: Cybernetic Odyssey', desc: 'A visually arresting journey through futuristic robotics and digital consciousness.', cat: 'Movie' },
      { title: 'Director Spotlight: 4K Masterworks', desc: 'Restored cinematic classics presented in wide color gamut and Atmos audio.', cat: 'Movie' },
      { title: 'Indie Short Film Showcase', desc: 'Award-winning creative films from international festivals around the globe.', cat: 'Cinema' },
    ],
    'Kids & Family': [
      { title: 'Bunny & Friends Enchanted Meadow', desc: 'A whimsical animated adventure full of playful critters and forest humor.', cat: 'Animation' },
      { title: 'Junior Science Lab Explorer', desc: 'Hands-on physics and chemistry experiments made accessible and fun.', cat: 'Education' },
    ],
  };

  const defaultTemplates = [
    { title: 'Live Broadcast Spotlight', desc: 'High-definition live programming and real-time regional coverage.', cat: 'General' },
    { title: 'Special Documentary Feature', desc: 'Fascinating perspectives on contemporary society, art, and innovation.', cat: 'Documentary' },
    { title: 'Late Night Cultural Magazine', desc: 'Interviews with leading authors, musicians, and filmmakers.', cat: 'Culture' },
  ];

  channels.forEach((ch) => {
    const list = sampleTitles[ch.group] || defaultTemplates;
    let slotTime = baseStart;
    let idx = 0;

    while (slotTime < baseStart + (8 * ONE_HOUR)) {
      const template = list[idx % list.length];
      const duration = (idx % 2 === 0) ? ONE_HOUR : HALF_HOUR;
      programs.push({
        id: `epg-${ch.id}-${slotTime}`,
        channelId: ch.id,
        title: template.title,
        description: template.desc,
        start: slotTime,
        end: slotTime + duration,
        category: template.cat,
        rating: 'TV-G',
      });
      slotTime += duration;
      idx++;
    }
  });

  return programs;
}

export const SAMPLE_VOD: VodItem[] = [
  {
    id: 'vod-sintel',
    title: 'Sintel (4K HDR Master)',
    type: 'movie',
    poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=360&auto=format&fit=crop&q=80',
    backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280&auto=format&fit=crop&q=80',
    rating: 8.8,
    year: '2024 Remaster',
    genre: 'Fantasy / Animation',
    plot: 'A lonely young woman searches the world for a baby dragon companion taken by an elder beast.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: 888,
  },
  {
    id: 'vod-tears-steel',
    title: 'Tears of Steel',
    type: 'movie',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=360&auto=format&fit=crop&q=80',
    backdrop: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&auto=format&fit=crop&q=80',
    rating: 8.4,
    year: '2023',
    genre: 'Sci-Fi / Action',
    plot: 'A dystopian Amsterdam where warriors and scientists attempt to avert a catastrophic robotic uprising.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    duration: 734,
  },
  {
    id: 'vod-bbb',
    title: 'Big Buck Bunny (UHD)',
    type: 'movie',
    poster: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=360&auto=format&fit=crop&q=80',
    backdrop: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&auto=format&fit=crop&q=80',
    rating: 9.1,
    year: '2022',
    genre: 'Animation / Comedy',
    plot: 'A giant rabbit devises ingenious traps to teach forest troublemakers a lesson.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 596,
  },
  {
    id: 'vod-series-cosmos',
    title: 'Cosmic Horizons (Series)',
    type: 'series',
    poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=360&auto=format&fit=crop&q=80',
    backdrop: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1280&auto=format&fit=crop&q=80',
    rating: 9.4,
    year: '2025',
    genre: 'Docuseries / Space',
    plot: 'An eye-opening exploration of exoplanetary geology, gravitational waves, and stellar evolution.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    seasons: [
      {
        seasonNumber: 1,
        episodes: [
          {
            id: 'ep-1',
            episodeNumber: 1,
            title: 'Stellar Nurseries & Nebula Origins',
            streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            duration: 900,
            overview: 'How stars ignite in dense clouds of interstellar gas.',
          },
          {
            id: 'ep-2',
            episodeNumber: 2,
            title: 'Black Holes & Event Horizons',
            streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            duration: 900,
            overview: 'Unraveling spacetime distortion at the edge of singularity.',
          },
        ],
      },
    ],
  },
];
