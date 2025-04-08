import { DataStorage } from "./data-storage";
import { RequestExecutor } from "./request-executor";
import { TokenResponse } from "./models/token-response";
import { SearchRecordsResponse } from "./models/search-records-response";
import { WEB_BASE_URL } from "./constants";

export class AnonymousApiClient {
  private static RETRY_ERROR_STATUSES = new Set<number>([401, 403]);

  private requestExecutor: RequestExecutor;
  private dataStorage: DataStorage;
  private anonymousRequestCounter = 0;
  private static readonly ANONYMOUS_REFRESH_THRESHOLD = 100;
  
  constructor(dataStorage: DataStorage, requestExecutor: RequestExecutor) {
    this.requestExecutor = requestExecutor;
    this.dataStorage = dataStorage;
  }
  
  /**
   * Gets or refreshes the anonymous session
   */
  public async fetchNewAnonymousSessionId(): Promise<void> {
    console.log('Getting a new anonymous session ID from FamilySearch');
    const response = await this.requestExecutor.executeRequest<TokenResponse>({
      baseUrl: WEB_BASE_URL,
      path: '/service/ident/cis/cis-web/oauth2/v3/token',
      body: new URLSearchParams({
        'grant_type': 'unauthenticated_session',
        'ip_address': RequestExecutor.IP_ADDRESS,
        'client_id': RequestExecutor.CLIENT_ID
      })
    });

    response.throwIfNotOk();
    await this.dataStorage.setAnonymousSessionId(response.data!.access_token);
  }
  
  public async searchRecords(searchParams: URLSearchParams, allowRetry: boolean = true): Promise<SearchRecordsResponse> {
    // Check if we need to refresh the anonymous session ID
    if (this.anonymousRequestCounter >= AnonymousApiClient.ANONYMOUS_REFRESH_THRESHOLD) {
      await this.fetchNewAnonymousSessionId();
      this.anonymousRequestCounter = 0;
    }
    
    // Always use anonymous session ID for anonymous requests
    let anonymousSessionId = await this.dataStorage.getAnonymousSessionId();
    if (!anonymousSessionId) {
      await this.fetchNewAnonymousSessionId();
      anonymousSessionId = await this.dataStorage.getAnonymousSessionId()!;
    }
    
    // Increment counter after getting/refreshing the session ID
    this.anonymousRequestCounter++;

    const response = await this.requestExecutor.executeRequest<SearchRecordsResponse>({
      baseUrl: WEB_BASE_URL,
      path: '/service/search/hr/v2/personas',
      queryStringParams: searchParams,
      authHeader: `Bearer ${anonymousSessionId}`
    });

    if (allowRetry && AnonymousApiClient.RETRY_ERROR_STATUSES.has(response.status)) {
      console.warn('Anonymous session ID expired. Refreshing it.');
      await this.fetchNewAnonymousSessionId();
      anonymousSessionId = await this.dataStorage.getAnonymousSessionId()!;
      return await this.searchRecords(searchParams, false);
    }

    response.throwIfNotOk();
    return response.data!;
  }
}
