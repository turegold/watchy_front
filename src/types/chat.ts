export type ChatEventKind = "CHAT" | "SYSTEM";

export type ChatMessage = {
  roomId: number;
  sendUserId: number;
  nickname: string;
  message: string;
  createdAt: string;
};

export type ChatSystemType = "JOIN" | "LEAVE" | "HOST_CHANGE";

export type ChatSystemMessage = {
  type: ChatSystemType;
  message: string;
  createdAt: string;
};

export type ChatEventResponse = {
  kind: ChatEventKind;
  roomId: number;
  createdAt: string;
  chat?: ChatMessage | null;
  system?: ChatSystemMessage | null;
};
