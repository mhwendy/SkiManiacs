import { HttpApiClient } from './httpClient';
import { mockApiClient } from './mockClient';
import type { ApiClient } from './client';

// Set EXPO_PUBLIC_API_URL (see .env.example) to use the real API; otherwise the in-memory mock is used.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const apiClient: ApiClient = apiUrl
  ? new HttpApiClient(apiUrl)
  : mockApiClient;
