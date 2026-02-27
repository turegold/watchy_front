import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from "../auth/tokenStorage";
import { API_BASE_URL } from "./config";
import { requestTokenRefresh } from "./auth";

type AuthRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuth?: boolean;
};

const REFRESH_ENDPOINT = "/api/auth/refresh";

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string> | null = null;

const isRefreshRequest = (url?: string): boolean => {
  if (!url) {
    return false;
  }
  return url.includes(REFRESH_ENDPOINT);
};

http.interceptors.request.use((config) => {
  const authConfig = config as AuthRequestConfig;

  if (authConfig.skipAuth || isRefreshRequest(authConfig.url)) {
    return authConfig;
  }

  const accessToken = getAccessToken();
  if (accessToken) {
    authConfig.headers.Authorization = `Bearer ${accessToken}`;
  }

  return authConfig;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = (error.config ?? {}) as AuthRequestConfig;
    const status = error.response?.status;
    const code = (error.response?.data as { code?: string } | undefined)?.code;

    if (
      status === 401 &&
      code === "EXPIRED_TOKEN" &&
      !originalConfig._retry &&
      !originalConfig.skipAuth &&
      !isRefreshRequest(originalConfig.url)
    ) {
      originalConfig._retry = true;

      try {
        if (!refreshPromise) {
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            throw new Error("리프레시 토큰이 없습니다.");
          }

          refreshPromise = requestTokenRefresh(refreshToken)
            .then((newAccessToken) => {
              setAccessToken(newAccessToken);
              return newAccessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;
        originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
        return http(originalConfig);
      } catch (refreshError) {
        clearTokens();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
