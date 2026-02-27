import axios from "axios";
import { API_BASE_URL } from "./config";
import { http } from "./http";

export const requestTokenRefresh = async (refreshToken: string): Promise<string> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/auth/refresh`,
    { refreshToken },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.data?.success || !response.data?.data?.accessToken) {
    throw new Error(response.data?.message ?? "토큰 재발급에 실패했습니다.");
  }

  return response.data.data.accessToken;
};

export const logout = async () => {
  return http.post("/api/auth/logout");
};
