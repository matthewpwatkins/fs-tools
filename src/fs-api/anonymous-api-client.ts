import { DataStorage, Session } from "../data/data-storage";
import { ApiResponse, RequestExecutor, RequestProps } from "./request-executor";
import { TokenResponse } from "./models/token-response";
import { SearchRecordsResponse } from "./models/search-records-response";
import { GEDCOMX_JSON_TYPE, WEB_BASE_URL } from "../constants";
import { GedcomX } from "./models/gedcomx";
import { Logger } from "../util/logger";

export class AnonymousApiClient {
  private static readonly RETRY_ERROR_STATUSES = new Set<number>([401, 403, 429]);
  private static readonly ANONYMOUS_REFRESH_TIME_THRESHOLD_MS = 1000 * 60 * 5;
  private static readonly THROTTLE_TIME_MS = 1_000;
  private static readonly DEFAULT_IP_ADDRESS = '216.49.186.122';
  private static readonly CLIENT_ID = 'a02f100000TnN56AAF';

  private requestExecutor: RequestExecutor;
  private dataStorage: DataStorage;

  constructor(dataStorage: DataStorage, requestExecutor: RequestExecutor) {
    this.requestExecutor = requestExecutor;
    this.dataStorage = dataStorage;
  }

  public async fetchNewAnonymousSessionId(): Promise<Session> {
    Logger.info('Getting a new anonymous session ID from FamilySearch');
    const ipAddress = (await this.dataStorage.getIpAddressData())?.ipAddress || AnonymousApiClient.DEFAULT_IP_ADDRESS;
    const response = await this.requestExecutor.executeRequest<TokenResponse>({
      baseUrl: WEB_BASE_URL,
      path: '/service/ident/cis/cis-web/oauth2/v3/token',
      body: new URLSearchParams({
        'grant_type': 'unauthenticated_session',
        'ip_address': ipAddress,
        'client_id': AnonymousApiClient.CLIENT_ID
      })
    });

    response.throwIfNotOk();

    const session: Session = {
      createdAt: Date.now(),
      sessionId: response.data!.access_token
    };

    await this.dataStorage.setAnonymousSession(session);
    return session;
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

  private async executeRequest<T>(props: RequestProps, isRetry: boolean = false, allowRetry: boolean = true): Promise<T> {
    let session = await this.dataStorage.getAnonymousSession();
    if (isRetry || this.shouldFetchNewAnonymousSessionId(session)) {
      session = await this.fetchNewAnonymousSessionId();
    }

    props.headers = props.headers || {};
    props.headers['Authorization'] = `Bearer ${session!.sessionId}`;

    const response = await this.requestExecutor.executeRequestWithMinResponseTime<T>(props, AnonymousApiClient.THROTTLE_TIME_MS);

    if (allowRetry && this.shouldRetry(response)) {
      return this.executeRequest(props, true, false);
    }

    response.throwIfNotOk();
    return response.data!;
  }

  private shouldRetry<T>(response: ApiResponse<T>) {
    if (response.status && AnonymousApiClient.RETRY_ERROR_STATUSES.has(response.status)) {
      return true;
    }
    if (response.exception && (response.exception.name.indexOf("TimeoutError") >= 0 || response.exception.message.indexOf("timed out") >= 0)) {
      return true;
    }
    return false;
  }

  private shouldFetchNewAnonymousSessionId(session?: Session): boolean {
    if (!session) {
      return true;
    }    
    if (session.createdAt + AnonymousApiClient.ANONYMOUS_REFRESH_TIME_THRESHOLD_MS <= Date.now()) {
      return true;
    }

    return false;
  }

  
}
