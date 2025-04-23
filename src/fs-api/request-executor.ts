import { Logger } from "../util/logger";

export interface RequestProps {
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams | object;
  queryStringParams?: URLSearchParams;
}

export interface ApiResponse<T> {
  data?: T;
  exception?: Error;
  errorBody?: any;
  status?: number;
  statusText?: string;
  headers?: Headers;
  url: string;
  ok: boolean;
  throwIfNotOk(): void;
}

export class RequestExecutor {
  private static readonly REQUEST_TIMEOUT_MS = 10_000;

  public async executeRequest<T>(props: RequestProps): Promise<ApiResponse<T>> {    
    const baseHeaders: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      ...props.headers
    };

    const url = new URL(props.path, props.baseUrl);
    if (props.queryStringParams) {
      for (const [key, value] of props.queryStringParams) {
        url.searchParams.append(key, value);
      }
    }
    
    // Prepare request options with default method and content type
    const requestInit: RequestInit = {
      headers: baseHeaders
    };
    
    // Set method based on body presence
    if (props.body) {
      requestInit.method = 'POST';
      
      // Set appropriate content type based on body type
      if (props.body instanceof URLSearchParams) {
        requestInit.body = props.body.toString();
        if (!baseHeaders['Content-Type']) {
          baseHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else if (typeof props.body === 'string') {
        requestInit.body = props.body;
      } else {
        // Assume JSON object
        requestInit.body = JSON.stringify(props.body);
        if (!baseHeaders['Content-Type']) {
          baseHeaders['Content-Type'] = 'application/json';
        }
      }
    } else {
      requestInit.method = 'GET';
    }

    const urlString = url.toString();
    const apiResponse: ApiResponse<T> = {
      ok: false,
      url: urlString,
      throwIfNotOk: () => {
        if (!apiResponse.ok) {
          if (apiResponse.exception) {
            throw apiResponse.exception;
          }
          throw new Error(`${requestInit.method} request to ${url} failed with status ${apiResponse.status}`);
        }
      },
    };
    
    const startTime = Date.now();
    let endTime = 0;
    try {
      Logger.debug(`Issuing request to ${urlString} with options:`, requestInit);
      const fetchResponse = await fetch(urlString,{
        ...requestInit,
        signal: AbortSignal.timeout(RequestExecutor.REQUEST_TIMEOUT_MS)
      });
      await this.populateApiResponseFieldsFromFetchResponse<T>(apiResponse, fetchResponse);
      endTime = Date.now();
    } catch (err: any) {
      Logger.error(`Error occurred issuing request to ${urlString}: ${err}`);
      this.populateApiResponseFieldsFromError<T>(apiResponse, err);
      endTime = Date.now();
    }
    endTime = endTime || Date.now();
    const duration = endTime - startTime;

    Logger.debug(`Finished request to ${urlString} after ${duration}ms. Result:`, apiResponse);
    return apiResponse;
  }

  private async populateApiResponseFieldsFromFetchResponse<T>(apiResponse: ApiResponse<T>, fetchResponse: Response) {
    apiResponse.ok = fetchResponse.ok;
    apiResponse.status = fetchResponse.status;
    apiResponse.statusText = fetchResponse.statusText;
    apiResponse.headers = fetchResponse.headers;

    if (fetchResponse.ok) {
      apiResponse.data = await fetchResponse.json() as T;
    } else {
      try {
        apiResponse.errorBody = await fetchResponse.json();
      } catch (err) {
        try {
          apiResponse.errorBody = await fetchResponse.text();
        } catch (err) { }
      }
    }
  }

  private populateApiResponseFieldsFromError<T>(apiResponse: ApiResponse<T>, err: any) {
    apiResponse.ok = false;
    if (err instanceof Error) {
      apiResponse.exception = err;
    } else if (typeof err === 'string') {
      apiResponse.exception = new Error(err);
    } else {
      apiResponse.exception = new Error("An error occurred: " + err);
    }
  }
}
