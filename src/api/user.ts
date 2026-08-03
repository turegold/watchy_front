import axios from "axios";
import { http } from "./http";

export type MeResponseData = {
  id?: number | string;
  userId?: number | string;
  email?: string;
  nickname?: string;
  level?: number;
  exp?: number;
  profileImageUrl?: string | null;
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

// 프로필 이미지 업로드 (presigned URL 방식, 3단계)
export const uploadProfileImage = async (file: File): Promise<void> => {
  // 1) 서버에서 업로드용 presigned PUT URL + key 발급
  const presignRes = await http.post("/api/users/profile-image/upload-url", {
    contentType: file.type,
  });
  const { key, uploadUrl } = presignRes.data?.data ?? {};
  if (!key || !uploadUrl) {
    throw new Error("업로드 URL 발급에 실패했습니다.");
  }

  // 2) S3에 직접 PUT (인증 헤더 없이, presigned URL로. Content-Type은 발급 때와 일치해야 함)
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
  });

  // 3) 서버에 key 확정 (프로필에 저장 + 이전 이미지 삭제)
  await http.put("/api/users/profile-image", { key });
};
