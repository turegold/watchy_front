import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "../../hooks/useChat";

const formatMessageTime = (isoString) => {
  if (!isoString) return "";
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// 닉네임 기준 안정적인 아바타 색상
const AVATAR_COLORS = ["#69be97", "#46a57e", "#8fd3b0", "#2e8060", "#58b58c", "#a7dcc2"];
const colorFor = (name) => {
  const key = String(name || "?");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const RoomChatPanel = ({ roomId, onEvent, me }) => {
  const parsedRoomId = useMemo(() => {
    const next = Number(roomId);
    return Number.isFinite(next) ? next : null;
  }, [roomId]);
  const { events, sendMessage } = useChat(parsedRoomId, { onEvent, me });
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
                className="chat-row chat-row--system"
              >
                <span className="chat-system">{event.system.message}</span>
              </div>
            );
          }

          if (event.kind !== "CHAT" || !event.chat) {
            return null;
          }

          const chat = event.chat;
          const isMe = chat.sendUserId === -1;
          const nickname = chat.nickname || "unknown";
          const initial = String(nickname).slice(0, 1).toUpperCase();

          return (
            <div
              key={`${event.createdAt}-${nickname}-${chat.message}-${index}`}
              className={`chat-row chat-row--chat ${isMe ? "chat-row--me" : ""}`}
            >
              {chat.profileImageUrl ? (
                <img src={chat.profileImageUrl} alt="" className="chat-avatar" />
              ) : (
                <span className="chat-avatar chat-avatar--initial" style={{ background: colorFor(nickname) }}>
                  {initial}
                </span>
              )}
              <div className="chat-bubble-wrap">
                <div className="chat-bubble-meta">
                  <span className="chat-bubble-name">{nickname}</span>
                  <span className="chat-bubble-time">{formatMessageTime(chat.createdAt)}</span>
                </div>
                <div className="chat-bubble">{chat.message}</div>
              </div>
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
