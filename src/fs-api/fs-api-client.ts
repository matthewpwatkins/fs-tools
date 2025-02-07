import { FsSessionIdStorage } from "./fs-session-id-storage";
import { TokenResponse } from "./models/token-response";
import { SearchRecordsResponse } from "./models/search-records-response";
import { SourceAttachment } from "./models/source-attachment";

export class FsApiClient {
  private static readonly BASE_URL = 'https://www.familysearch.org';
  private static readonly CLIENT_ID = 'a02f100000TnN56AAF';
  // TODO: Use the user's actual IP address
  private static readonly IP_ADDRESS = '216.49.186.122';
  
  private sessionIdStorage: FsSessionIdStorage;
  private sessionId?: string;
  
  constructor(fsSessionIdStorage: FsSessionIdStorage) {
    this.sessionIdStorage = fsSessionIdStorage;
  }

  public async auth(forceNewToken: boolean): Promise<void> {
    if (!forceNewToken) {
      if (!this.sessionId) {
        this.sessionId = await this.sessionIdStorage.getSessionId();
      }
      if (this.sessionId) {
        return;
      }
    }

    console.log('No session ID found. Getting a new anonymous session ID from FamilySearch');
    const res: TokenResponse = await this.postForm(false, '/service/ident/cis/cis-web/oauth2/v3/token', new URLSearchParams(), new URLSearchParams({
      'grant_type': 'unauthenticated_session',
      'ip_address': FsApiClient.IP_ADDRESS,
      'client_id': FsApiClient.CLIENT_ID
    }));

    this.sessionId = res.access_token;
    this.sessionIdStorage.setSessionId(res.access_token);
  }

  public async searchRecords(searchParams: URLSearchParams): Promise<SearchRecordsResponse> {
    return this.get(true, '/service/search/hr/v2/personas', searchParams);
  }

  public async getAttachmentsForRecord(recordId: string): Promise<SourceAttachment[]> {
    return this.get(true, '/service/tree/links/sources/attachments', new URLSearchParams({
      'uri': `https://www.familysearch.org/ark:/61903/1:1:${recordId}`
    }));
  }

  // #region Private helpers

  private async get<T>(requireAuth: boolean, path: string, queryStringParams?: URLSearchParams): Promise<T> {
    return this.request<T>(requireAuth, path, queryStringParams || new URLSearchParams(), {
      method: 'GET'
    });
  }

  private async postJson<T, U>(requireAuth: boolean, path: string, queryStringParams: URLSearchParams, body: T): Promise<U> {
    return this.request<U>(requireAuth, path, queryStringParams, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(body)
    });
  }

  private async postForm<T>(requireAuth: boolean, path: string, queryStringParams: URLSearchParams, body: URLSearchParams): Promise<T> {
    return this.request<T>(requireAuth, path, queryStringParams, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: body
    });
  }

  private async request<T>(requireAuth: boolean, path: string, queryStringParams: URLSearchParams, options: Omit<Tampermonkey.Request,  'url' | 'onload' | 'onerror'>): Promise<T> {
    const baseHeaders: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*'
    };

    if (requireAuth) {
      await this.auth(false);
      baseHeaders['Authorization'] = `Bearer ${this.sessionId!}`;
    }
    
    const url = new URL(path, FsApiClient.BASE_URL);
    for (const [key, value] of queryStringParams) {
      url.searchParams.append(key, value);
    }
    
    return new Promise<T>((resolve, reject) => {
      GM.xmlHttpRequest({
        ...options,
        url,
        headers: {
          ...baseHeaders,
          ...options.headers
        },
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(JSON.parse(response.responseText));
          } else {
            reject(new Error(`${options.method} request to ${url} failed with status ${response.status}`));
          }
        },
        onerror: (error) => {
          reject(new Error(`${options.method} request to ${url} failed onerror with message: ${JSON.stringify(error)}`));
        }
      });
    });
  }

  // #endregion
}