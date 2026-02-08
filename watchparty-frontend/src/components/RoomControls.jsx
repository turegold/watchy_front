import { useState } from "react";

const RoomControls = ({ roomId, getCurrentTime }) => {
  const [videoId, setVideoId] = useState("");
  const [seekTime, setSeekTime] = useState("");
  const [status, setStatus] = useState(null);

  const callControlApi = async (body) => {
    if (!roomId) return;
    setStatus("loading");
    try {
      const timeFromPlayer = Number(getCurrentTime?.() ?? 0);
      const requestBody = {
        roomId: Number(roomId),
        userId: 1,
        currentTime: timeFromPlayer,
        ...body,
      };
      const response = await fetch(
        `/api/rooms/${roomId}/video/control?userId=1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      setStatus("ok");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  const handleChangeVideo = () => {
    callControlApi({ action: "CHANGE_VIDEO", videoId });
  };

  const handlePlay = () => {
    callControlApi({ action: "PLAY" });
  };

  const handlePause = () => {
    callControlApi({ action: "PAUSE" });
  };

  const handleSeek = () => {
    const currentTime = Number(seekTime);
    if (Number.isNaN(currentTime)) return;
    callControlApi({ action: "SEEK", currentTime });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={videoId}
          onChange={(event) => setVideoId(event.target.value)}
          placeholder="YouTube videoId"
        />
        <button type="button" onClick={handleChangeVideo}>
          영상 변경
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="number"
          min="0"
          value={seekTime}
          onChange={(event) => setSeekTime(event.target.value)}
          placeholder="시크 시간 (초)"
        />
        <button type="button" onClick={handleSeek}>
          시크
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handlePlay}>
          재생
        </button>
        <button type="button" onClick={handlePause}>
          정지
        </button>
      </div>
      {status === "error" && (
        <p style={{ marginTop: 8 }}>요청에 실패했습니다.</p>
      )}
    </div>
  );
};

export default RoomControls;
