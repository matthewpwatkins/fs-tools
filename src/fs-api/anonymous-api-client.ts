import { DataStorage } from "./data-storage";
import { RequestExecutor, RequestProps } from "./request-executor";
import { TokenResponse } from "./models/token-response";
import { SearchRecordsResponse } from "./models/search-records-response";
import { GEDCOMX_JSON_TYPE, WEB_BASE_URL } from "./constants";
import { GedcomX } from "./models/gedcomx";

export class AnonymousApiClient {
  private static readonly RETRY_ERROR_STATUSES = new Set<number>([401, 403, 429]);
  private static readonly ANONYMOUS_REFRESH_THRESHOLD = 100;
  private static readonly THROTTLE_TIME_MS = 200;

  private requestExecutor: RequestExecutor;
  private dataStorage: DataStorage;
  private anonymousRequestCounter = 0;

  constructor(dataStorage: DataStorage, requestExecutor: RequestExecutor) {
    this.requestExecutor = requestExecutor;
    this.dataStorage = dataStorage;
  }

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

  public async getArk(ark: string): Promise<GedcomX> {
    return await this.executeRequest<GedcomX>({
      baseUrl: WEB_BASE_URL,
      path: `/${ark}`,
      queryStringParams: new URLSearchParams({ 'useSLS': 'true' }),
      headers: {
        'Accept': GEDCOMX_JSON_TYPE,
      },
    });
  }

  public async searchRecords(searchParams: URLSearchParams): Promise<SearchRecordsResponse> {
    return await this.executeRequest<SearchRecordsResponse>({
      baseUrl: WEB_BASE_URL,
      path: '/service/search/hr/v2/personas',
      queryStringParams: searchParams
    });
  }

  private async executeRequest<T>(props: RequestProps, allowRetry: boolean = true): Promise<T> {
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

    props.headers = props.headers || {};
    props.headers['Authorization'] = `Bearer ${anonymousSessionId}`;

    const response = await this.requestExecutor.executeRequest<T>(props);

    if (allowRetry && AnonymousApiClient.RETRY_ERROR_STATUSES.has(response.status)) {
      console.warn('Anonymous session ID expired. Refreshing it.');
      await this.fetchNewAnonymousSessionId();
      anonymousSessionId = await this.dataStorage.getAnonymousSessionId()!;
      return await this.executeRequest(props, false);
    }

    response.throwIfNotOk();

    return new Promise<T>((resolve) => setTimeout(() => {
      resolve(response.data!);
    }, AnonymousApiClient.THROTTLE_TIME_MS));
  }
}
