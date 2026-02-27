import { http } from "./http";

const unwrapApiData = (payload: any) => {
  if (payload && typeof payload === "object" && "success" in payload) {
    return payload.data;
  }
  return payload;
};

export const getRooms = async () => {
  const response = await http.get("/api/rooms");
  const data = unwrapApiData(response.data);
  return Array.isArray(data) ? data : [];
};

export const getRoomVideoState = async (roomId: number | string) => {
  const response = await http.get(`/api/rooms/${roomId}/video`);
  return unwrapApiData(response.data);
};

export const createRoom = async (title: string, isPrivate: boolean) => {
  console.debug("[room] createRoom request:", { title, isPrivate });
  const response = await http.post(
    "/api/rooms",
    { title, isPrivate },
  );
  return unwrapApiData(response.data);
};

export const controlRoomVideo = async (roomId: number | string, body: Record<string, unknown>) => {
  const response = await http.post(`/api/rooms/${roomId}/video/control`, body);
  return unwrapApiData(response.data);
};
