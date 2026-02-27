const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const isLocalhostRuntime = (() => {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
})();

// dev proxy가 없는 실행(예: vite preview)에서도 로컬 백엔드로 직접 붙도록 fallback.
export const API_BASE_URL = envApiBaseUrl ?? (isLocalhostRuntime ? "http://localhost:8080" : "");
