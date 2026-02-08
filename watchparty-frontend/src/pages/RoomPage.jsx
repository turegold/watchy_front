import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import RoomVideo from "../components/RoomVideo";

const RoomPage = () => {
  const { roomId } = useParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoIdInput, setVideoIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSaveVideoId = async () => {
    if (!roomId || !videoIdInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/rooms/${roomId}/video/control?userId=1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: Number(roomId),
            userId: 1,
            action: "CHANGE_VIDEO",
            videoId: videoIdInput.trim(),
            currentTime: 0,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to update video: ${response.status}`);
      }
      setSettingsOpen(false);
      setVideoIdInput("");
    } catch (err) {
      setError("영상 설정에 실패했습니다.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page page--room">
      <header className="topbar">
        <div className="topbar__brand">
          <div className="logo-badge">WP</div>
          <div>
            <p className="eyebrow">Watch Party</p>
            <h1 className="title">Room {roomId}</h1>
          </div>
        </div>
        <div className="topbar__actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            설정
          </button>
          <Link className="btn btn--ghost" to="/rooms">
            나가기
          </Link>
        </div>
      </header>
      <div className="room-layout">
        <aside className="chat-panel">
          <div className="chat-panel__header">
            <h2>채팅</h2>
            <span className="chat-panel__status">LIVE</span>
          </div>
          <div className="chat-panel__messages">
            <div className="chat-bubble">
              <span className="chat-bubble__name">Host</span>
              <p>영상이 시작됐어요!</p>
            </div>
            <div className="chat-bubble">
              <span className="chat-bubble__name">Viewer</span>
              <p>타이밍 좋아요.</p>
            </div>
          </div>
          <div className="chat-panel__input">
            <input type="text" placeholder="메시지를 입력하세요" />
            <button type="button">보내기</button>
          </div>
        </aside>
        <section className="video-shell">
          <RoomVideo roomId={roomId} />
          <div className="video-status">
            <span className="dot" />
            실시간 동기화 중
          </div>
        </section>
      </div>
      {settingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__header">
              <h3>영상 설정</h3>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSettingsOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="modal__body">
              <label className="modal__label" htmlFor="video-id-input">
                YouTube videoId
              </label>
              <input
                id="video-id-input"
                type="text"
                value={videoIdInput}
                onChange={(event) => setVideoIdInput(event.target.value)}
                placeholder="예: dQw4w9WgXcQ"
              />
              {error && <p className="modal__error">{error}</p>}
            </div>
            <div className="modal__footer">
              <button
                className="btn btn--primary"
                type="button"
                onClick={handleSaveVideoId}
                disabled={saving}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomPage;
