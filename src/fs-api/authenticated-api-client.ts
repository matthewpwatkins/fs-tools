import { DataStorage, Session } from "./data-storage";
import { RequestExecutor, RequestProps } from "./request-executor";
import { GedcomX } from "./models/gedcomx";
import { SourceAttachment } from "./models/source-attachment";
import { API_BASE_URL, WEB_BASE_URL, GEDCOMX_JSON_TYPE } from "./constants";
import { Logger } from "../util/logger";

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
}
