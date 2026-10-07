import QRCode from 'qrcode';

export interface LanServerInfo {
  ip: string;
  port: number;
  qrDataUrl: string;
  companionUrl: string;
}

export interface PushedCredentials {
  type: 'xtream' | 'm3u_url' | 'm3u_file';
  name?: string;
  url?: string;
  epgUrl?: string;
  content?: string;
  xtreamConfig?: {
    host: string;
    user: string;
    pass: string;
  };
  timestamp?: number;
}

export class LanCompanionService {
  /**
   * Generates a companion pairing QR code data URL.
   * Encodes the landing page URL on the local network.
   */
  static async generateQrCode(url: string): Promise<string> {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate QR code', err);
      return '';
    }
  }

  static getEstimatedLanIp(): string {
    return window.location.hostname !== 'localhost' ? window.location.hostname : '192.168.1.145';
  }

  static getCompanionBaseUrl(port: number = 8080): string {
    const ip = this.getEstimatedLanIp();
    return `http://${ip}:${port}`;
  }

  /**
   * Polls the bundled-service on the local TV loopback / LAN to check for incoming credentials
   */
  static async fetchPendingCredentials(port: number = 8080): Promise<PushedCredentials | null> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/credentials`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.credentials || null;
    } catch {
      return null;
    }
  }

  /**
   * Acknowledges and clears credentials once imported by the TV app
   */
  static async clearPendingCredentials(port: number = 8080): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/clear`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if bundled-service is active
   */
  static async checkStatus(port: number = 8080): Promise<{ online: boolean; localIp?: string }> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (!res.ok) return { online: false };
      const data = await res.json();
      return { online: true, localIp: data.localIp };
    } catch {
      return { online: false };
    }
  }

  /**
   * Fetches QR code URL and pairing info from bundled-service /api/pair-qr
   */
  static async fetchPairQrInfo(port: number = 8080): Promise<{ qrCodeUrl: string; pairUrl: string; localIp: string } | null> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/pair-qr`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}
