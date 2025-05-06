import { DataStorage, Session } from "../data/data-storage";
import { ApiResponse, RequestExecutor, RequestProps } from "./request-executor";
import { GedcomX } from "./models/gedcomx";
import { SourceAttachment } from "./models/source-attachment";
import { API_BASE_URL, WEB_BASE_URL, GEDCOMX_JSON_TYPE } from "../constants";
import { Logger } from "../util/logger";
import { SearchRecordsResponse } from "./models/search-records-response";

export class AuthenticatedApiClient {
  private static readonly THROTTLE_TIME_MS = 500;

  private requestExecutor: RequestExecutor;
  private dataStorage: DataStorage;

  constructor(dataStorage: DataStorage, requestExecutor: RequestExecutor) {
    this.requestExecutor = requestExecutor;
    this.dataStorage = dataStorage;
  }

  public async getPerson(personId: string, includeRelatives?: boolean): Promise<GedcomX> {
    return this.executeAuthenticatedRequest<GedcomX>({
      baseUrl: API_BASE_URL,
      path: `/platform/tree/persons/${personId}`,
      headers: {
        'Accept': GEDCOMX_JSON_TYPE,
      },
      queryStringParams: new URLSearchParams({
        'relatives': includeRelatives ? 'true' : 'false'
      })
    });
  }

  public async getAttachmentsForRecord(recordId: string): Promise<SourceAttachment[]> {
    return this.executeAuthenticatedRequest<SourceAttachment[]>({
      baseUrl: WEB_BASE_URL,
      path: '/service/tree/links/sources/attachments',
      queryStringParams: new URLSearchParams({
        'uri': `https://www.familysearch.org/ark:/61903/1:1:${recordId}`
      })
    });
  }
  
  public async getPersonsForRecords(recordIds: string[]): Promise<Record<string, string>> {
    if (recordIds.length === 0) return {};
    
    return this.executeAuthenticatedRequest<Record<string, string>>({
      baseUrl: WEB_BASE_URL,
      path: '/match/resolutions/match/bulk',
      queryStringParams: new URLSearchParams({
        'ids': recordIds.join(',')
      })
    });
  }
  
  public async getArk(ark: string): Promise<GedcomX> {
    return await this.executeAuthenticatedRequest<GedcomX>({
      baseUrl: WEB_BASE_URL,
      path: `/${ark}`,
      queryStringParams: new URLSearchParams({ 'useSLS': 'true' }),
      headers: {
        'Accept': GEDCOMX_JSON_TYPE,
      },
    });
  }

  public async searchRecords(searchParams: URLSearchParams): Promise<SearchRecordsResponse> {
    return await this.executeAuthenticatedRequest<SearchRecordsResponse>({
      baseUrl: WEB_BASE_URL,
      path: '/service/search/hr/v2/personas',
      queryStringParams: searchParams
    });
  }

  // #region Private helpers

  private async getAuthenticatedSession(): Promise<Session> {
    const session = await this.dataStorage.getAuthenticatedSession();
    if (!session) {
      throw new Error('An authenticated session is required but not available');
    }
    return session;
  }

  private async executeAuthenticatedRequest<T>(requestParams: RequestProps): Promise<T> {
    const session = await this.getAuthenticatedSession();

    try {
      const response = await this.requestExecutor.executeRequest<T>({
        ...requestParams,
        headers: {
          ...requestParams.headers || {},
          'Authorization': `Bearer ${session.sessionId}`,
        }
      });

      response.throwIfNotOk();
      return await this.requestWithThrottling(response);
    } catch (error) {
      // Clear session ID if authentication failed
      if (error instanceof Error && (error.message.includes('status 401') || error.message.includes('status 403'))) {
        Logger.warn('Authentication error. Clearing session ID.');
        await this.dataStorage.setAuthenticatedSession(undefined);
      }
      throw error;
    }
  }

  private requestWithThrottling<T>(response: ApiResponse<T>): T | Promise<T> {
    return new Promise<T>((resolve) => setTimeout(() => {
      resolve(response.data!);
    }, AuthenticatedApiClient.THROTTLE_TIME_MS));
  }

  // #endregion
}
