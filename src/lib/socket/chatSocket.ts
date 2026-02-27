import { Client, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL } from "../../api/config";
import type { ChatEventResponse } from "../../types/chat";

let chatClient: Client | null = null;
let chatSubscription: StompSubscription | null = null;
let connectedRoomId: number | null = null;

const getSocketUrl = () => `${API_BASE_URL}/ws`;

export const disconnectChatSocket = (): void => {
  if (chatSubscription) {
    chatSubscription.unsubscribe();
    chatSubscription = null;
  }
  if (chatClient) {
    chatClient.deactivate();
    chatClient = null;
  }
  connectedRoomId = null;
};

export const connectChatSocket = (
  roomId: number,
  onEvent: (event: ChatEventResponse) => void,
): Promise<void> => {
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) {
    console.error("[chat] accessToken이 없어 소켓 연결을 건너뜁니다.");
    return Promise.resolve();
  }

  if (chatClient || chatSubscription) {
    disconnectChatSocket();
  }

  const socket = new SockJS(getSocketUrl(), null, {
    withCredentials: false,
  });
  connectedRoomId = roomId;

  return new Promise((resolve, reject) => {
    let settled = false;

    chatClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      onConnect: () => {
        if (!chatClient) {
          return;
        }
        chatSubscription = chatClient.subscribe(
          `/topic/rooms/${roomId}/chat`,
          (frame) => {
            try {
              console.debug("[chat] socket raw frame:", frame.body);
              const evt = JSON.parse(frame.body) as ChatEventResponse;
              if (!evt || !evt.kind) {
                console.warn("[chat] unknown event:", frame.body);
                return;
              }
              console.debug("[chat] socket event:", evt);
              onEvent(evt);
            } catch (error) {
              console.error("[chat] 메시지 파싱 실패:", error);
            }
          },
        );

        if (!settled) {
          settled = true;
          resolve();
        }
      },
      onDisconnect: () => {
        console.warn("[chat] STOMP 연결이 종료되었습니다.");
      },
      onStompError: (frame) => {
        console.error("[chat] STOMP 에러:", frame.headers["message"], frame.body);
      },
      onWebSocketError: (event) => {
        console.error("[chat] WebSocket 에러:", event);
        if (!settled) {
          settled = true;
          reject(new Error("WebSocket connection error"));
        }
      },
      onWebSocketClose: () => {
        console.warn("[chat] WebSocket 연결이 닫혔습니다.");
      },
    });

    chatClient.activate();
  });
};

export const sendChat = (roomId: number, message: string): void => {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) {
    console.warn("[chat] accessToken이 없어 메시지를 전송할 수 없습니다.");
    return;
  }

  if (!chatClient || !chatClient.connected || connectedRoomId !== roomId) {
    console.warn("[chat] 연결이 없어 메시지를 전송할 수 없습니다.");
    return;
  }

  chatClient.publish({
    destination: `/app/rooms/${roomId}/chat/send`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message: trimmed }),
  });
};
