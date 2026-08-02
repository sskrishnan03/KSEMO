// Google OAuth 2.0 Authentication Service

const TOKEN_STORAGE_KEY = 'ksemo_google_token';
const EXPIRY_STORAGE_KEY = 'ksemo_google_token_expiry';

export class GoogleAuthService {
  private clientId: string;
  private scopes: string[];
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    this.scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks',
    ];

    // Restore a previously stored token so connections survive page refresh
    this.accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    this.tokenExpiry = Number(localStorage.getItem(EXPIRY_STORAGE_KEY)) || null;
  }

  async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.isAuthenticated()) {
      return this.accessToken as string;
    }

    // Use OAuth 2.0 implicit flow for client-side
    const authUrl = this.buildAuthUrl();
    const token = await this.getAccessTokenFromPopup(authUrl);

    this.accessToken = token;
    this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour expiry

    // Persist so the connection survives a page refresh
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EXPIRY_STORAGE_KEY, String(this.tokenExpiry));

    return token;
  }

  // Alias kept for clarity in UI code
  async signIn(): Promise<string> {
    return await this.authenticate();
  }

  private buildAuthUrl(): string {
    const redirectUri = `${window.location.origin}/oauth/callback`;
    const scope = this.scopes.join(' ');

    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(this.clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}&` +
      `include_granted_scopes=true`;
  }

  private async getAccessTokenFromPopup(authUrl: string): Promise<string> {
    const width = 520;
    const height = 620;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    const popup = window.open(
      authUrl,
      'Google OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    return new Promise((resolve, reject) => {
      if (!popup) {
        reject(new Error('Popup was blocked. Please allow popups for this site and try again.'));
        return;
      }

      let settled = false;
      let closedAt: number | null = null;

      const cleanup = () => {
        clearInterval(interval);
        window.removeEventListener('message', onMessage);
      };

      const finish = (err: Error | null, token?: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (err) reject(err);
        else resolve(token!);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'oauth_callback') return;

        const data = event.data;
        if (data.error) {
          finish(new Error(data.error));
        } else if (data.access_token) {
          finish(null, data.access_token);
        }
      };

      window.addEventListener('message', onMessage);

      const interval = setInterval(() => {
        if (settled) return;
        if (popup.closed) {
          // Give the callback page a short grace window to post the token
          // back to this window before we treat the close as a failure.
          if (closedAt === null) {
            closedAt = Date.now();
          } else if (Date.now() - closedAt > 800) {
            finish(new Error('OAuth popup was closed before sign-in finished.'));
          }
        }
      }, 300);
    });
  }

  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null &&
           this.tokenExpiry !== null &&
           Date.now() < this.tokenExpiry;
  }

  logout(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
  }

  // Alias kept for clarity in UI code
  signOut(): void {
    this.logout();
  }
}

let instance: GoogleAuthService | null = null;

export function getGoogleAuthService(): GoogleAuthService {
  if (!instance) {
    instance = new GoogleAuthService();
  }
  return instance;
}
