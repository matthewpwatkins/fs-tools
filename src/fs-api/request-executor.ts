export interface RequestProps {
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams | object;
  queryStringParams?: URLSearchParams;
}

export interface ApiResponse<T> {
  data?: T;
  errorBody?: any;
  status: number;
  statusText: string;
  headers: Headers;
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
    const response = await fetch(urlString,{
      ...requestInit,
      signal: AbortSignal.timeout(RequestExecutor.REQUEST_TIMEOUT_MS)
    });
    
    // Create the response object
    const apiResponse: ApiResponse<T> = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.url,
      ok: response.ok,
      throwIfNotOk: () => {
        if (!response.ok) {
          throw new Error(`${requestInit.method} request to ${url} failed with status ${response.status}`);
        }
      }
    };

    // Set the response data or error body
    if (response.ok) {
      apiResponse.data = await response.json() as T;
    } else {
      try {
        apiResponse.errorBody = await response.json();
      } catch (err) {
        try {
          apiResponse.errorBody = await response.text();
        } catch (err) { }
      }
    }
    
    return apiResponse;
  }
}
