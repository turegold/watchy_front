import { isAxiosError } from "axios";
import { clearTokens, getAccessToken } from "../auth/tokenStorage";
import type { RoomListItem } from "../types/room";
import { API_BASE_URL } from "./config";
import { http } from "./http";

const unwrapApiData = (payload: unknown): unknown => {
  if (payload && typeof payload === "object" && "success" in payload) {
    return (payload as { data?: unknown }).data;
  }
  return payload;
};

const resolveNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const next = Number(value);
    if (Number.isFinite(next) && next > 0) {
      return next;
    }
  }
  return null;
};

const normalizeRoomListItem = (room: Record<string, unknown>): RoomListItem | null => {
  const roomId = resolveNumber(room.roomId, room.id);
  if (!roomId) {
    return null;
  }

  const title = String(room.title ?? room.name ?? `방 ${roomId}`);
  const isPrivate = Boolean(room.isPrivate ?? room.private ?? false);
  const host = (room.host ?? {}) as Record<string, unknown>;
  const hostUserId = resolveNumber(room.hostUserId, host.userId, host.id) ?? 0;
  const hostNickname =
    (
      room.hostNickName ??
      room.hostNickname ??
      host.nickname ??
      room.hostName ??
      host.name ??
      null
    ) as string | null;
  const participantCount = resolveNumber(
    room.participantCount,
    room.memberCount,
    room.members,
  ) ?? 0;

  const maxMembers = resolveNumber(room.maxMembers) ?? undefined;
  const videoId = (room.videoId ?? room.currentVideoId ?? (room.video as { id?: unknown } | undefined)?.id ??
    null) as string | null;
  const videoTitle = (room.videoTitle ?? room.currentVideoTitle ?? "영상 없음") as string;
  const thumbnailUrl = (room.thumbnailUrl ?? room.thumbnail ?? null) as string | null;

  return {
    roomId,
    title,
    isPrivate,
    hostUserId,
    hostNickname,
    participantCount,
    maxMembers,
    videoId,
    videoTitle,
    thumbnailUrl,
  };
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) {
    return fallback;
  }
  const payload = error.response?.data as { message?: string } | undefined;
  return payload?.message ?? fallback;
};

const handleUnauthorized = (error: unknown): void => {
  if (!isAxiosError(error) || error.response?.status !== 401) {
    return;
  }
  clearTokens();
  if (window.location.pathname !== "/login") {
    window.alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
    window.location.href = "/login";
  }
};

export const fetchRooms = async (): Promise<RoomListItem[]> => {
  try {
    const response = await http.get("/api/rooms");
    const data = unwrapApiData(response.data);
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => normalizeRoomListItem((item ?? {}) as Record<string, unknown>))
      .filter(Boolean) as RoomListItem[];
  } catch (error) {
    handleUnauthorized(error);
    throw error;
  }
};

export const joinRoom = async (roomId: number): Promise<void> => {
  try {
    console.debug("[rooms] joinRoom request:", { roomId });
    await http.post(`/api/rooms/${roomId}/join`);
  } catch (error) {
    handleUnauthorized(error);
    throw new Error(extractErrorMessage(error, "방 참여에 실패했습니다."));
  }
};

export const leaveRoom = async (roomId: number): Promise<void> => {
  try {
    console.debug("[rooms] leaveRoom request:", { roomId });
    await http.post(`/api/rooms/${roomId}/leave`);
  } catch (error) {
    handleUnauthorized(error);
    throw new Error(extractErrorMessage(error, "방 나가기에 실패했습니다."));
  }
};

export const leaveRoomKeepalive = (roomId: number): void => {
  const accessToken = getAccessToken();
  if (!accessToken || !roomId) {
    return;
  }

  const endpoint = `${API_BASE_URL}/api/rooms/${roomId}/leave`;
  console.debug("[rooms] leaveRoom keepalive request:", { roomId });

  fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    keepalive: true,
  }).catch(() => {
    // 페이지 이탈 시에는 실패해도 사용자 상호작용으로 복구할 수 없으므로 무시한다.
  });
};
