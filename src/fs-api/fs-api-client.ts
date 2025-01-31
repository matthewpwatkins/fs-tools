import { TokenResponse } from "./token-response";

export class FsApiClient {
  private static readonly BASE_URL = 'https://www.familysearch.org';
  private static readonly CLIENT_ID = 'a02f100000TnN56AAF';
  
  private token?: string;
  
  constructor(token?: string) {
    this.token = token;
  }

  public setToken(token: string) {
    this.token = token;
  }

  public async auth(forceNewToken: boolean, ipAddress: string): Promise<void> {
    if (!forceNewToken && this.token) {
      return;
    }

    const res: TokenResponse = await this.postForm('/service/ident/cis/cis-web/oauth2/v3/token', new URLSearchParams({
      'grant_type': 'unauthenticated_session',
      'ip_address': ipAddress,
      'client_id': FsApiClient.CLIENT_ID
    }));

    this.setToken(res.token);
    console.log('Authenticated', this.token);
  }

  // #region Private helpers

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, {
      method: 'GET'
    });
  }

  private async postJson<T, U>(path: string, body: T): Promise<U> {
    return this.request<U>(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(body)
    });
  }

  private async postForm<T>(path: string, body: URLSearchParams): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: body
    });
  }

  private async request<T>(path: string, options: Omit<Tampermonkey.Request,  'url' | 'onload' | 'onerror'>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      GM.xmlHttpRequest({
        ...options,
        url: `${FsApiClient.BASE_URL}${path}`,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          ...options.headers
        },
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(JSON.parse(response.responseText));
          } else {
            reject(new Error(`${options.method} request failed with status ${response.status}:\n${response.responseText}`));
          }
        },
        onerror: (error) => {
          reject(new Error(`${options.method} request failed: ${error.error}`));
        }
      });
    });
  }

  // #endregion
}