import { DataStorage, Session } from "../data/data-storage";
import { ApiResponse, RequestExecutor, RequestProps } from "./request-executor";
import { GedcomX } from "./models/gedcomx";
import { SourceAttachment } from "./models/source-attachment";
import { API_BASE_URL, WEB_BASE_URL, GEDCOMX_JSON_TYPE } from "../constants";
import { Logger } from "../util/logger";
import { SearchRecordsResponse } from "./models/search-records-response";
import { BulkSourceAttachmentsRequest } from "./models/bulk-source-attachments-request";
import { BulkSourceAttachmentsResponse } from "./models/bulk-source-attachments-response";

export class AuthenticatedApiClient {
  private static readonly THROTTLE_TIME_MS = 1_000;

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

    const request: BulkSourceAttachmentsRequest = {
      uris: recordIds.map(recordId => `https://www.familysearch.org/ark:/61903/1:1:${recordId}`),
    };

    const response = await this.executeAuthenticatedRequest<BulkSourceAttachmentsResponse>({
      baseUrl: WEB_BASE_URL,
      path: '/service/tree/links/sources/attachments',
      body: request,
    });

    const personMap: Record<string, string> = {};
    for (const key in response.attachedSourcesMap) {
      const recordId = key.split(':').pop()!;
      const personId = response.attachedSourcesMap[key][0].persons[0].entityId;
      personMap[recordId] = personId;
    }
    return personMap;
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
      const response = await this.requestExecutor.executeRequestWithMinResponseTime<T>({
        ...requestParams,
        headers: {
          ...requestParams.headers || {},
          'Authorization': `Bearer ${session.sessionId}`,
        }
      }, AuthenticatedApiClient.THROTTLE_TIME_MS);

      response.throwIfNotOk();
      // Return data immediately without throttling
      return response.data!;
    } catch (error) {
      // Clear session ID if authentication failed
      if (error instanceof Error && (error.message.includes('status 401') || error.message.includes('status 403'))) {
        Logger.warn('Authentication error. Clearing session ID.');
        await this.dataStorage.setAuthenticatedSession(undefined);
      }
      throw error;
    }
  }

  

  // #endregion
}
