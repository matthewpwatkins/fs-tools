import { FsSessionIdStorage } from "./fs-session-id-storage";
import { TokenResponse } from "./models/token-response";
import { SearchRecordsResponse } from "./models/search-records-response";
import { SourceAttachment } from "./models/source-attachment";
import { GedcomX } from "./models/gedcomx";

export class FsApiClient {
  private static readonly WEB_BASE_URL = 'https://www.familysearch.org';
  private static readonly API_BASE_URL = 'https://api.familysearch.org';
  private static readonly CLIENT_ID = 'a02f100000TnN56AAF';
  // TODO: Use the user's actual IP address
  private static readonly IP_ADDRESS = '216.49.186.122';
  private static readonly GEDCOMX_JSON_TYPE = 'application/x-gedcomx-v1+json';
  
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
    const res: TokenResponse = await this.request({
      requireAuth: false,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: '/service/ident/cis/cis-web/oauth2/v3/token',
      body: new URLSearchParams({
        'grant_type': 'unauthenticated_session',
        'ip_address': FsApiClient.IP_ADDRESS,
        'client_id': FsApiClient.CLIENT_ID
      })
    });

    this.sessionId = res.access_token;
    this.sessionIdStorage.setSessionId(res.access_token);
  }

  public async getPerson(personId: string, includeRelatives?: boolean): Promise<GedcomX> {
    return await this.request({
      requireAuth: true,
      baseUrl: FsApiClient.API_BASE_URL,
      path: `/platform/tree/persons/${personId}`,
      headers: {
        'Accept': FsApiClient.GEDCOMX_JSON_TYPE,
      },
      queryStringParams: new URLSearchParams({
        'relatives': includeRelatives ? 'true' : 'false'
      })
    });
  }

  public async getArk(ark: string): Promise<GedcomX> {
    const params = new URLSearchParams();
    params.append('useSLS', 'true');

    return this.request({
      requireAuth: true,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: `/${ark}`,
      headers: {
        'Accept': FsApiClient.GEDCOMX_JSON_TYPE,
      },
      queryStringParams: params
    });
  }

  public async searchRecords(searchParams: URLSearchParams): Promise<SearchRecordsResponse> {
    return this.request({
      requireAuth: true,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: '/service/search/hr/v2/personas',
      queryStringParams: searchParams
    });
  }

  public async getAttachmentsForRecord(recordId: string): Promise<SourceAttachment[]> {
    return this.request({
      requireAuth: true,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: '/service/tree/links/sources/attachments',
      queryStringParams: new URLSearchParams({
        'uri': `https://www.familysearch.org/ark:/61903/1:1:${recordId}`
      })
    });
  }

  // #region Private helpers

  private async request<T>({ requireAuth, baseUrl, path, headers = {}, body, queryStringParams }: RequestProps): Promise<T> {
    const baseHeaders: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      ...headers
    };

    if (requireAuth) {
      await this.auth(false);
      baseHeaders['Authorization'] = `Bearer ${this.sessionId!}`;
    }

    const url = new URL(path, baseUrl);
    if (queryStringParams) {
      for (const [key, value] of queryStringParams) {
        url.searchParams.append(key, value);
      }
    }
    
    // Prepare request options with default method and content type
    const requestInit: RequestInit = {
      headers: baseHeaders
    };
    
    // Set method based on body presence
    if (body) {
      requestInit.method = 'POST';
      
      // Set appropriate content type based on body type
      if (body instanceof URLSearchParams) {
        requestInit.body = body.toString();
        if (!baseHeaders['Content-Type']) {
          baseHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else if (typeof body === 'string') {
        requestInit.body = body;
      } else {
        // Assume JSON object
        requestInit.body = JSON.stringify(body);
        if (!baseHeaders['Content-Type']) {
          baseHeaders['Content-Type'] = 'application/json';
        }
      }
    } else {
      requestInit.method = 'GET';
    }

    const response = await fetch(url.toString(), requestInit);

    if (!response.ok) {
      throw new Error(`${requestInit.method} request to ${url} failed with status ${response.status}`);
    }

    return response.json();
  }

  // #endregion
}

interface RequestProps {
  requireAuth: boolean;
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams | object;
  queryStringParams?: URLSearchParams;
}