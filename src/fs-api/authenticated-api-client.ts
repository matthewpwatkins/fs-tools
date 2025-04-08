import { DataStorage } from "./data-storage";
import { RequestExecutor } from "./request-executor";
import { GedcomX } from "./models/gedcomx";
import { SourceAttachment } from "./models/source-attachment";
import { API_BASE_URL, WEB_BASE_URL, GEDCOMX_JSON_TYPE } from "./constants";

export class AuthenticatedApiClient {
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
  
  private async getAuthenticatedSessionId(): Promise<string> {
    const sessionId = await this.dataStorage.getAuthenticatedSessionId();
    if (!sessionId) {
      throw new Error('An authenticated session ID is required but not available');
    }
    return sessionId;
  }
  
  private async executeAuthenticatedRequest<T>(requestParams: {
    baseUrl: string;
    path: string;
    headers?: Record<string, string>;
    queryStringParams?: URLSearchParams;
  }): Promise<T> {
    const sessionId = await this.getAuthenticatedSessionId();
    
    try {
      const response = await this.requestExecutor.executeRequest<T>({
        ...requestParams,
        authHeader: `Bearer ${sessionId}`
      });
      
      response.throwIfNotOk();
      return response.data!;
    } catch (error) {
      // Clear session ID if authentication failed
      if (error instanceof Error && (error.message.includes('status 401') || error.message.includes('status 403'))) {
        console.warn('Authenticated session ID expired. Clearing it.');
        await this.dataStorage.setAuthenticatedSessionId(undefined);
      }
      throw error;
    }
  }
}
