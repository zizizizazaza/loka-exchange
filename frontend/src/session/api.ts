import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';

import type { ApiError } from './types';

function toApiError(status: number, statusText: string, body: Record<string, unknown>): ApiError {
  return {
    status,
    code: (body.code as string) ?? 'UNKNOWN',
    message: (body.message as string) ?? statusText,
    problems: body.problems as string[] | undefined,
    providerCode: body.providerCode as string | undefined,
  };
}

/**
 * Calls the backend as the signed-in user (Privy access token). Throws an ApiError on any non-2xx response.
 * `form` sends multipart data (file uploads); `json` sends a JSON body.
 */
export function useApi() {
  const { getAccessToken } = usePrivy();
  return useCallback(
    async <T>(path: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch(`/api${path}`, {
        method: opts.method ?? (opts.json !== undefined || opts.form ? 'POST' : 'GET'),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(opts.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw toApiError(res.status, res.statusText, body);
      return body as T;
    },
    [getAccessToken],
  );
}

/**
 * POSTs a multipart form and reports upload progress (fetch cannot). `onProgress` gets 0 to 1 while the file is
 * sent, then 1 once it has all arrived and the server is working on it.
 */
export function useUpload() {
  const { getAccessToken } = usePrivy();
  return useCallback(
    async <T>(path: string, form: FormData, onProgress: (sent: number) => void): Promise<T> => {
      const token = await getAccessToken();
      return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.upload.onload = () => onProgress(1);
        xhr.onerror = () => reject(toApiError(0, 'Network error', { message: 'Could not reach the server. Try again.' }));
        xhr.onload = () => {
          let body: Record<string, unknown> = {};
          try {
            body = JSON.parse(xhr.responseText) as Record<string, unknown>;
          } catch {
            // Not JSON: keep the status text.
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
          else reject(toApiError(xhr.status, xhr.statusText, body));
        };
        xhr.send(form);
      });
    },
    [getAccessToken],
  );
}
