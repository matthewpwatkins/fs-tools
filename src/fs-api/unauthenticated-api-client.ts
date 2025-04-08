import { RequestExecutor } from "./request-executor";
import { GedcomX } from "./models/gedcomx";
import { GEDCOMX_JSON_TYPE, WEB_BASE_URL } from "./constants";

export class UnauthenticatedApiClient {
  private requestExecutor: RequestExecutor;
  
  constructor(requestExecutor: RequestExecutor) {
    this.requestExecutor = requestExecutor;
  }
  
  public async getArk(ark: string): Promise<GedcomX> {
    const params = new URLSearchParams();
    params.append('useSLS', 'true');

    const response = await this.requestExecutor.executeRequest<GedcomX>({
      baseUrl: WEB_BASE_URL,
      path: `/${ark}`,
      headers: {
        'Accept': GEDCOMX_JSON_TYPE,
      },
      queryStringParams: params
    });
    
    response.throwIfNotOk();
    return response.data!;
  }
}
