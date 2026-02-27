import { useState } from "react";
import { controlRoomVideo } from "../api/room";
import { extractYouTubeVideoId } from "../utils/youtube";

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
        currentTime: timeFromPlayer,
        ...body,
      };
      await controlRoomVideo(roomId, requestBody);
      setStatus("ok");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  const handleChangeVideo = () => {
    const parsedVideoId = extractYouTubeVideoId(videoId);
    if (!parsedVideoId) {
      setStatus("invalid_video");
      return;
    }
    callControlApi({ action: "CHANGE_VIDEO", videoId: parsedVideoId });
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
          placeholder="YouTube URL 또는 videoId"
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
          placeholder="건너뛰기 시간 (초)"
        />
        <button type="button" onClick={handleSeek}>
          건너뛰기
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
      {status === "invalid_video" && (
        <p style={{ marginTop: 8 }}>유효한 YouTube URL 또는 videoId를 입력하세요.</p>
      )}
    </div>
  );
};

export default RoomControls;
