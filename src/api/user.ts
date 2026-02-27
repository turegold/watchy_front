import { http } from "./http";

export type MeResponseData = {
  userId?: number | string;
  email?: string;
  nickname?: string;
  level?: number;
  experience?: number;
  [key: string]: unknown;
};

export const getMe = async () => {
  const response = await http.get("/api/me");
  return response.data;
};

export const patchNickname = async (nickname: string) => {
  const response = await http.patch("/api/users/nickname", { nickname });
  return response.data;
};
