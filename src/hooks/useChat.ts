import { useCallback, useEffect, useState } from "react";
import {
  connectChatSocket,
  disconnectChatSocket,
  sendChat,
} from "../lib/socket/chatSocket";
import type { ChatEventResponse } from "../types/chat";

type TimelineEvent = ChatEventResponse & {
  _optimistic?: boolean;
};

type UseChatOptions = {
  onEvent?: (event: ChatEventResponse) => void;
};

const OPTIMISTIC_WINDOW_MS = 10000;

export const useChat = (roomId: number | null, options: UseChatOptions = {}) => {
  const { onEvent } = options;
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleIncomingMessage = useCallback(
    (event: ChatEventResponse) => {
      onEvent?.(event);
      if (!event?.kind) {
        console.warn("[chat] invalid event:", event);
        return;
      }

      if (event.kind === "CHAT" && event.chat) {
        setEvents((prev) => {
          const incomingTime = Date.parse(event.chat?.createdAt ?? event.createdAt);
          const optimisticIdx = prev.findIndex((entry) => {
            if (!entry._optimistic || entry.kind !== "CHAT" || !entry.chat) {
              return false;
            }
            if (entry.chat.message !== event.chat?.message) {
              return false;
            }
            const optimisticTime = Date.parse(entry.chat.createdAt ?? entry.createdAt);
            if (Number.isNaN(incomingTime) || Number.isNaN(optimisticTime)) {
              return true;
            }
            return Math.abs(incomingTime - optimisticTime) < OPTIMISTIC_WINDOW_MS;
          });

          if (optimisticIdx >= 0) {
            return prev;
          }
          return [...prev, event];
        });
        return;
      }

      setEvents((prev) => [...prev, event]);
    },
    [onEvent],
  );

  useEffect(() => {
    if (!roomId || Number.isNaN(roomId)) {
      setEvents([]);
      setIsConnected(false);
      disconnectChatSocket();
      return;
    }

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      console.error("[chat] accessToken이 없어 채팅 연결을 시도하지 않습니다.");
      setEvents([]);
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    setEvents([]);
    setIsConnected(false);

    connectChatSocket(roomId, handleIncomingMessage)
      .then(() => {
        if (cancelled) return;
        setIsConnected(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[chat] 소켓 연결 실패:", error);
        setIsConnected(false);
      });

    return () => {
      cancelled = true;
      setIsConnected(false);
      disconnectChatSocket();
    };
  }, [roomId, handleIncomingMessage]);

  const sendMessage = useCallback(
    (rawMessage: string) => {
      if (!roomId || Number.isNaN(roomId)) {
        return false;
      }

      const message = rawMessage.trim();
      if (!message) {
        return false;
      }

      const optimisticEvent: TimelineEvent = {
        kind: "CHAT",
        roomId,
        createdAt: new Date().toISOString(),
        chat: {
          roomId,
          sendUserId: -1,
          nickname: "me",
          message,
          createdAt: new Date().toISOString(),
        },
        _optimistic: true,
      };

      setEvents((prev) => [...prev, optimisticEvent]);
      sendChat(roomId, message);
      return true;
    },
    [roomId],
  );

  return { events, sendMessage, isConnected };
};
