import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RoomVideo from "../components/RoomVideo";
import RoomChatPanel from "../components/chat/RoomChatPanel";
import { controlRoomVideo } from "../api/room";
import { fetchRooms, joinRoom, leaveRoom, leaveRoomKeepalive } from "../api/rooms";
import { getMe } from "../api/user";
import { extractYouTubeVideoId } from "../utils/youtube";

const parseUserId = (value) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
};

const parseHostUserIdFromHostChange = (event) => {
  if (event?.kind !== "SYSTEM" || event?.system?.type !== "HOST_CHANGE") {
    return null;
  }

  const candidates = [
    event?.system?.newHostUserId,
    event?.system?.hostUserId,
    event?.newHostUserId,
    event?.hostUserId,
  ];
  for (const candidate of candidates) {
    const parsed = parseUserId(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const message = String(event?.system?.message ?? "");
  const userIdMatch = message.match(/userId\s*[:=]\s*(\d+)/i) ?? message.match(/(\d+)/);
  if (!userIdMatch) {
    return null;
  }
  return parseUserId(userIdMatch[1]);
};

const RoomPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const parsedRoomId = Number(roomId);
  const validRoomId = Number.isFinite(parsedRoomId) ? parsedRoomId : null;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoIdInput, setVideoIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [joinStatus, setJoinStatus] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [roomMeta, setRoomMeta] = useState(null);
  const [myUserId, setMyUserId] = useState(null);
  const joinAttemptedRoomRef = useRef(null);
  const joinedRef = useRef(false);
  const leftRef = useRef(false);
  const enableUnmountLeaveRef = useRef(false);

  const refreshRoomMeta = useCallback(async () => {
    if (!validRoomId) {
      setRoomMeta(null);
      return;
    }

    try {
      const rooms = await fetchRooms();
      const targetRoom = rooms.find((item) => item.roomId === validRoomId) ?? null;
      setRoomMeta(targetRoom);
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, [validRoomId]);

  useEffect(() => {
    let cancelled = false;

    const fetchMe = async () => {
      try {
        const response = await getMe();
        const me = response?.data ?? response ?? {};
        const nextUserId = parseUserId(me.userId ?? me.id);
        if (!cancelled) {
          setMyUserId(nextUserId);
        }
      } catch {
        if (!cancelled) {
          setMyUserId(null);
        }
      }
    };

    fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshRoomMeta();
    const pollingId = window.setInterval(() => {
      refreshRoomMeta();
    }, 7000);

    return () => {
      window.clearInterval(pollingId);
    };
  }, [refreshRoomMeta]);

  useEffect(() => {
    if (!validRoomId) {
      return;
    }
    if (joinAttemptedRoomRef.current === validRoomId) {
      return;
    }
    joinAttemptedRoomRef.current = validRoomId;

    const alreadyJoined = Boolean(location.state?.alreadyJoined);
    if (alreadyJoined) {
      joinedRef.current = true;
      setJoinStatus(null);
      return;
    }

    setJoinStatus("joining");
    joinRoom(validRoomId)
      .then(() => {
        joinedRef.current = true;
        setJoinStatus(null);
        refreshRoomMeta();
      })
      .catch((joinError) => {
        const message = joinError?.message ?? "방 참여에 실패했습니다.";
        setJoinStatus(message);
        window.alert(message);
      });
  }, [validRoomId, location.state, refreshRoomMeta]);

  const isHost = useMemo(() => {
    if (!roomMeta?.hostUserId || !myUserId) {
      return false;
    }
    return roomMeta.hostUserId === myUserId;
  }, [roomMeta, myUserId]);

  const canControlVideo = isHost;
  const permissionMessage = useMemo(() => {
    if (canControlVideo) {
      return "";
    }
    if (!roomMeta?.hostUserId) {
      return "방장 정보 확인 중입니다.";
    }
    return "방장만 영상을 변경/재생/일시정지/건너뛰기할 수 있습니다.";
  }, [canControlVideo, roomMeta]);

  const isPermissionDeniedError = (requestError) => {
    const status = requestError?.response?.status;
    const code = requestError?.response?.data?.code;
    return (
      status === 403 ||
      code === "FORBIDDEN" ||
      code === "ACCESS_DENIED" ||
      code === "NOT_ROOM_HOST" ||
      code === "ROOM_HOST_REQUIRED"
    );
  };

  const handleSaveVideoId = async () => {
    if (!validRoomId || !videoIdInput.trim()) {
      return;
    }
    if (!canControlVideo) {
      setError("방장만 영상을 변경할 수 있습니다.");
      return;
    }

    const parsedVideoId = extractYouTubeVideoId(videoIdInput);
    if (!parsedVideoId) {
      setError("유효한 YouTube URL 또는 videoId를 입력해주세요.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await controlRoomVideo(validRoomId, {
        roomId: validRoomId,
        action: "CHANGE_VIDEO",
        videoId: parsedVideoId,
        currentTime: 0,
      });
      setSettingsOpen(false);
      setVideoIdInput("");
    } catch (saveError) {
      if (isPermissionDeniedError(saveError)) {
        setError("방장만 영상을 변경할 수 있습니다.");
        refreshRoomMeta();
        return;
      }
      setError("영상 설정에 실패했습니다.");
      console.error(saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!validRoomId || leaving || leftRef.current) {
      return;
    }

    setLeaving(true);
    leftRef.current = true;
    try {
      await leaveRoom(validRoomId);
      navigate("/rooms", { replace: true });
    } catch (leaveError) {
      leftRef.current = false;
      const message = leaveError?.message ?? "방 나가기에 실패했습니다.";
      setError(message);
      window.alert(message);
    } finally {
      setLeaving(false);
    }
  };

  useEffect(() => {
    if (!validRoomId) {
      return undefined;
    }

    enableUnmountLeaveRef.current = false;
    const enableTimerId = window.setTimeout(() => {
      enableUnmountLeaveRef.current = true;
    }, 0);

    const leaveByKeepalive = () => {
      if (!joinedRef.current || leftRef.current) {
        return;
      }
      leftRef.current = true;
      leaveRoomKeepalive(validRoomId);
    };

    const handleBeforeUnload = () => {
      leaveByKeepalive();
    };
    const handlePageHide = () => {
      leaveByKeepalive();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearTimeout(enableTimerId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);

      // React StrictMode(dev) 초기 검사용 unmount에서는 leave를 보내지 않는다.
      if (!enableUnmountLeaveRef.current) {
        return;
      }
      if (!joinedRef.current || leftRef.current) {
        return;
      }
      leftRef.current = true;
      leaveRoomKeepalive(validRoomId);
    };
  }, [validRoomId]);

  const handleChatEvent = useCallback(
    (event) => {
      if (event?.kind !== "SYSTEM" || !event?.system?.type) {
        return;
      }

      const eventType = event.system.type;
      const nextHostUserId =
        eventType === "HOST_CHANGE" ? parseHostUserIdFromHostChange(event) : null;
      setRoomMeta((prev) => {
        if (!prev) {
          return prev;
        }

        if (eventType === "JOIN") {
          return {
            ...prev,
            participantCount: Math.max(0, Number(prev.participantCount ?? 0) + 1),
          };
        }

        if (eventType === "LEAVE") {
          return {
            ...prev,
            participantCount: Math.max(0, Number(prev.participantCount ?? 0) - 1),
          };
        }

        if (eventType === "HOST_CHANGE") {
          if (!nextHostUserId) {
            return prev;
          }
          return {
            ...prev,
            hostUserId: nextHostUserId,
            hostNickname: null,
          };
        }

        return prev;
      });

      if (eventType === "HOST_CHANGE") {
        refreshRoomMeta();
      }
    },
    [refreshRoomMeta],
  );

  return (
    <div className="page page--room">
      <header className="topbar">
        <div className="topbar__brand">
          <div className="logo-badge">WP</div>
          <div>
            <p className="eyebrow">Watch Party</p>
            <h1 className="title">Room {roomId}</h1>
            <p className="eyebrow">
              방장: {roomMeta?.hostNickname ?? "확인 중"} | 인원: {roomMeta?.participantCount ?? "-"}명
            </p>
          </div>
        </div>
        <div className="topbar__actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              if (!canControlVideo) return;
              setSettingsOpen(true);
            }}
            disabled={!canControlVideo}
            title={canControlVideo ? "영상 설정" : "방장만 영상 설정 가능"}
          >
            설정
          </button>
          <button className="btn btn--ghost" type="button" onClick={handleLeaveRoom} disabled={leaving}>
            {leaving ? "나가는 중..." : "나가기"}
          </button>
          <Link className="btn btn--ghost" to="/rooms">
            목록
          </Link>
        </div>
      </header>
      {joinStatus && joinStatus !== "joining" && <p className="error-text">{joinStatus}</p>}
      <div className="room-layout">
        <section className="video-shell">
          <RoomVideo
            roomId={roomId}
            canControlVideo={canControlVideo}
            onControlForbidden={() => {
              setError("방장만 영상을 조작할 수 있습니다.");
              refreshRoomMeta();
            }}
          />
          {permissionMessage && <p className="video-permission">{permissionMessage}</p>}
        </section>
        <RoomChatPanel roomId={roomId} onEvent={handleChatEvent} />
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
                YouTube URL 또는 videoId
              </label>
              <input
                id="video-id-input"
                type="text"
                value={videoIdInput}
                onChange={(event) => setVideoIdInput(event.target.value)}
                placeholder="예: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
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
