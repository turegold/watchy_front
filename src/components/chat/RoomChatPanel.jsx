import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "../../hooks/useChat";

const formatMessageTime = (isoString) => {
  if (!isoString) return "";
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const RoomChatPanel = ({ roomId, onEvent }) => {
  const parsedRoomId = useMemo(() => {
    const next = Number(roomId);
    return Number.isFinite(next) ? next : null;
  }, [roomId]);
  const { events, sendMessage } = useChat(parsedRoomId, { onEvent });
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const messagesRef = useRef(null);
  const lastSubmitRef = useRef({ text: "", at: 0 });

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [events]);

  const submitMessage = () => {
    const next = input.trim();
    if (!next) return;

    const now = Date.now();
    const last = lastSubmitRef.current;
    if (last.text === next && now - last.at < 250) {
      return;
    }

    const sent = sendMessage(next);
    if (!sent) return;
    lastSubmitRef.current = { text: next, at: now };
    setInput("");
  };

  return (
    <aside className="chat-panel">
      <div className="chat-panel__header">
        <h2>채팅</h2>
      </div>
      <div className="chat-panel__messages" ref={messagesRef}>
        {events.length === 0 && (
          <p className="chat-panel__empty">아직 채팅이 없습니다. 첫 메시지를 보내보세요.</p>
        )}
        {events.map((event, index) => {
          if (event.kind === "SYSTEM" && event.system) {
            return (
              <div
                key={`${event.createdAt}-${event.system.type}-${event.system.message}-${index}`}
                className="chat-system-message"
              >
                <span className="chat-system-message__text">{event.system.message}</span>
              </div>
            );
          }

          if (event.kind !== "CHAT" || !event.chat) {
            return null;
          }

          const optimistic = event.chat.sendUserId === -1;
          return (
            <div
              key={`${event.createdAt}-${event.chat.nickname}-${event.chat.message}-${index}`}
              className={`chat-bubble ${optimistic ? "chat-bubble--me" : ""}`}
            >
              <div className="chat-bubble__meta">
                <span className="chat-bubble__name">{event.chat.nickname || "unknown"}</span>
                <span className="chat-bubble__time">{formatMessageTime(event.chat.createdAt)}</span>
              </div>
              <p>{event.chat.message}</p>
            </div>
          );
        })}
      </div>
      <div className="chat-panel__input">
        <input
          type="text"
          placeholder="메시지를 입력하세요"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              if (event.nativeEvent.isComposing || isComposing) {
                return;
              }
              event.preventDefault();
              submitMessage();
            }
          }}
        />
        <button type="button" onClick={submitMessage} disabled={!parsedRoomId}>
          전송
        </button>
      </div>
    </aside>
  );
};

export default RoomChatPanel;
