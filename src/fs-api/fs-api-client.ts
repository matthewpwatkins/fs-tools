import { FsSessionIdStorage } from "./fs-session-id-storage";
import { TokenResponse } from "./models/token-response";
import { SearchRecordsResponse } from "./models/search-records-response";
import { SourceAttachment } from "./models/source-attachment";
import { GedcomX } from "./models/gedcomx";

// enum for auth level
enum AuthLevel {
  NONE,
  ANONYMOUS,
  AUTHENTICATED
};

export class FsApiClient {
  private static readonly WEB_BASE_URL = 'https://www.familysearch.org';
  private static readonly API_BASE_URL = 'https://api.familysearch.org';
  private static readonly CLIENT_ID = 'a02f100000TnN56AAF';
  // TODO: Use the user's actual IP address
  private static readonly IP_ADDRESS = '216.49.186.122';
  private static readonly GEDCOMX_JSON_TYPE = 'application/x-gedcomx-v1+json';
  
  private sessionIdStorage: FsSessionIdStorage;
  private anonymousRequestCounter = 0;
  private static readonly ANONYMOUS_REFRESH_THRESHOLD = 100;
  
  constructor(fsSessionIdStorage: FsSessionIdStorage) {
    this.sessionIdStorage = fsSessionIdStorage;
  }

  /**
   * Gets or refreshes the anonymous session
   * @param forceNewToken Force getting a new token even if one exists
   */
  public async fetchNewAnonymousSessionId(): Promise<void> {
    console.log('Getting a new anonymous session ID from FamilySearch');
    const res: TokenResponse = await this.request({
      authLevel: AuthLevel.NONE,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: '/service/ident/cis/cis-web/oauth2/v3/token',
      body: new URLSearchParams({
        'grant_type': 'unauthenticated_session',
        'ip_address': FsApiClient.IP_ADDRESS,
        'client_id': FsApiClient.CLIENT_ID
      })
    });

    await this.sessionIdStorage.setAnonymousSessionId(res.access_token);
  }

  public async getPerson(personId: string, includeRelatives?: boolean): Promise<GedcomX> {
    return await this.request({
      authLevel: AuthLevel.AUTHENTICATED,
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
      authLevel: AuthLevel.NONE,
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
      authLevel: AuthLevel.ANONYMOUS,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: '/service/search/hr/v2/personas',
      queryStringParams: searchParams
    });
  }

  public async getAttachmentsForRecord(recordId: string): Promise<SourceAttachment[]> {
    return this.request({
      authLevel: AuthLevel.AUTHENTICATED,
      baseUrl: FsApiClient.WEB_BASE_URL,
      path: '/service/tree/links/sources/attachments',
      queryStringParams: new URLSearchParams({
        'uri': `https://www.familysearch.org/ark:/61903/1:1:${recordId}`
      })
    });
  }

  // #region Private helpers

  private async request<T>({ authLevel, baseUrl, path, headers = {}, body, queryStringParams, allowRetry = true }: RequestProps): Promise<T> {    
    const baseHeaders: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      ...headers
    };

    switch (authLevel) {
      case AuthLevel.NONE:
        break;
      case AuthLevel.ANONYMOUS:
        // Check if we need to refresh the anonymous session ID
        if (this.anonymousRequestCounter >= FsApiClient.ANONYMOUS_REFRESH_THRESHOLD) {
          await this.fetchNewAnonymousSessionId();
          this.anonymousRequestCounter = 0;
        }
        
        // Always use anonymous session ID for anonymous requests
        let anonymousSessionId = await this.sessionIdStorage.getAnonymousSessionId();
        if (!anonymousSessionId) {
          await this.fetchNewAnonymousSessionId();
          anonymousSessionId = await this.sessionIdStorage.getAnonymousSessionId()!;
        }
        
        // Increment counter after getting/refreshing the session ID
        this.anonymousRequestCounter++;
        
        baseHeaders['Authorization'] = `Bearer ${anonymousSessionId}`;
        break;
      case AuthLevel.AUTHENTICATED:
        const authenticatedSessionId = await this.sessionIdStorage.getAuthenticatedSessionId();
        if (!authenticatedSessionId) {
          throw new Error('An authenticated session ID is required but not available');
        }
        baseHeaders['Authorization'] = `Bearer ${authenticatedSessionId}`;
        break;
      default:
        throw new Error(`Invalid auth level: ${authLevel}`);
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
      if (response.status === 401 || response.status === 403) {
        if (authLevel === AuthLevel.AUTHENTICATED) {
          // If the session is authenticated but expired, we need to clear the session ID
          console.warn('Authenticated session ID expired. Clearing it.');
          await this.sessionIdStorage.setAuthenticatedSessionId(undefined);
        } else if (authLevel === AuthLevel.ANONYMOUS && allowRetry) {
          // If the session is anonymous and expired, we need to refresh it
          console.warn('Anonymous session ID expired. Refreshing it.');
          await this.fetchNewAnonymousSessionId();
          return await this.request({ authLevel, baseUrl, path, headers, body, queryStringParams, allowRetry: false });
        }
      }
      throw new Error(`${requestInit.method} request to ${url} failed with status ${response.status}`);
    }

    return response.json();
  }

  // #endregion
}

interface RequestProps {
  authLevel: AuthLevel;
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams | object;
  queryStringParams?: URLSearchParams;
  allowRetry?: boolean;
}