import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { controlRoomVideo, getRoomVideoState } from "../api/room";
import speakerIcon from "../imgs/speacker.png";

const parseTimestampMs = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return value;
    if (value > 1_000_000_000) return value * 1000;
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const resolveCurrentTime = (state) => {
  const rawTime = Number(state?.currentTime ?? 0);
  const baseTime = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : 0;
  const status = state?.status ?? "PAUSED";
  if (status !== "PLAYING") return baseTime;

  const timestampCandidates = [
    state?.timestamp,
    state?.updatedAt,
    state?.lastUpdatedAt,
    state?.lastActionAt,
    state?.syncedAt,
    state?.serverTime,
  ];
  const syncedAt = timestampCandidates
    .map((candidate) => parseTimestampMs(candidate))
    .find((value) => value != null);
  if (syncedAt == null) return baseTime;

  const elapsedSec = (Date.now() - syncedAt) / 1000;
  return elapsedSec > 0 ? baseTime + elapsedSec : baseTime;
};

const RoomVideo = forwardRef(({ roomId, canControlVideo = true, onControlForbidden }, ref) => {
  const [videoId, setVideoId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState(null);
  const clientRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const playerFrameRef = useRef(null);
  const syncingRef = useRef(false);
  const suppressEventsUntilRef = useRef(0);
  const lastSentRef = useRef({ action: null, time: 0 });
  const initialSyncDoneRef = useRef(false);
  const statusRef = useRef(null);
  const currentTimeRef = useRef(0);
  const initialStateLoadedRef = useRef(false);
  const pendingStateRef = useRef(null);
  const playerReadyRef = useRef(false);
  const userInteractedRef = useRef(false);
  const lastAppliedRef = useRef({ videoId: null, time: 0, status: null });
  const [needsSoundUnlock, setNeedsSoundUnlock] = useState(false);
  const [localVolume, setLocalVolume] = useState(100);
  const [localMuted, setLocalMuted] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const lastBufferingAtRef = useRef(0);
  const lastPlayerTimeRef = useRef(0);
  const lastPlayerStateRef = useRef(null);
  const isSeekingRef = useRef(false);
  const seekTimerRef = useRef(null);
  const seekIgnoreUntilRef = useRef(0);
  const seekStartTimeRef = useRef(null);
  const lastTimeSampleRef = useRef(0);
  const seekPollRef = useRef(null);
  const lastSeekSentAtRef = useRef(0);
  const lastPlaySentAtRef = useRef(0);
  const pauseConfirmTimerRef = useRef(null);

  const applyLocalAudio = useCallback((volume, muted) => {
    if (!playerRef.current) return;
    if (typeof playerRef.current.setVolume === "function") {
      playerRef.current.setVolume(volume);
    }
    if (muted) {
      if (typeof playerRef.current.mute === "function") {
        playerRef.current.mute();
      }
      return;
    }
    if (typeof playerRef.current.unMute === "function") {
      playerRef.current.unMute();
    }
  }, []);

  const applyServerState = useCallback(
    (nextState) => {
      if (!nextState?.videoId) return;
      if (!playerRef.current || !playerReadyRef.current) {
        pendingStateRef.current = nextState;
        return;
      }
      const rawNextTime = Number(nextState.currentTime ?? 0);
      const nextTime = Number.isFinite(rawNextTime) && rawNextTime > 0 ? rawNextTime : 0;
      const nextStatus = nextState.status ?? "PAUSED";
      suppressEventsUntilRef.current = Date.now() + 1000;
      syncingRef.current = true;
      const currentVideoId =
        typeof playerRef.current.getVideoData === "function"
          ? playerRef.current.getVideoData().video_id
          : null;
      if (currentVideoId !== nextState.videoId) {
        if (nextStatus === "PLAYING" && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById({
            videoId: nextState.videoId,
            startSeconds: nextTime,
          });
        } else if (playerRef.current.cueVideoById) {
          playerRef.current.cueVideoById({
            videoId: nextState.videoId,
            startSeconds: nextTime,
          });
        }
      } else if (playerRef.current.seekTo) {
        playerRef.current.seekTo(nextTime, true);
      }
      setTimeout(() => {
        if (playerRef.current.seekTo) {
          playerRef.current.seekTo(nextTime, true);
        }
        if (nextStatus === "PLAYING" && playerRef.current.playVideo) {
          if (!userInteractedRef.current && playerRef.current.mute) {
            playerRef.current.mute();
            setNeedsSoundUnlock(true);
          }
          playerRef.current.playVideo();
        } else if (playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
        }
        lastAppliedRef.current = {
          videoId: nextState.videoId,
          time: nextTime,
          status: nextStatus,
        };
        initialSyncDoneRef.current = true;
        syncingRef.current = false;
      }, 300);
    },
    []
  );

  useEffect(() => {
    if (!roomId) {
      setVideoId(null);
      setCurrentTime(0);
      setStatus(null);
      return undefined;
    }
    initialStateLoadedRef.current = false;
    initialSyncDoneRef.current = false;
    pendingStateRef.current = null;
    setNeedsSoundUnlock(false);
    lastPlayerTimeRef.current = 0;
    lastPlayerStateRef.current = null;
    isSeekingRef.current = false;
    seekIgnoreUntilRef.current = 0;
    seekStartTimeRef.current = null;
    lastTimeSampleRef.current = 0;
    if (seekTimerRef.current) {
      clearTimeout(seekTimerRef.current);
      seekTimerRef.current = null;
    }
    if (seekPollRef.current) {
      clearInterval(seekPollRef.current);
      seekPollRef.current = null;
    }
    if (pauseConfirmTimerRef.current) {
      clearTimeout(pauseConfirmTimerRef.current);
      pauseConfirmTimerRef.current = null;
    }

    const fetchInitialState = async () => {
      try {
        const state = await getRoomVideoState(roomId);
        const nextVideoId = state?.videoId ?? null;
        const nextCurrentTime = resolveCurrentTime(state);
        const nextStatus = state?.status ?? null;
        initialStateLoadedRef.current = true;
        setVideoId(nextVideoId);
        setCurrentTime(nextCurrentTime);
        setStatus(nextStatus);
        currentTimeRef.current = nextCurrentTime;
        statusRef.current = nextStatus;
        if (nextStatus !== "PLAYING") {
          setNeedsSoundUnlock(false);
        }
        applyServerState({
          videoId: nextVideoId,
          currentTime: nextCurrentTime,
          status: nextStatus,
        });
      } catch (error) {
        console.error(error);
      }
    };

    fetchInitialState();

    const handleUserInteraction = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener("pointerdown", handleUserInteraction, {
      once: true,
    });
    window.addEventListener("keydown", handleUserInteraction, { once: true });

    const socket = new SockJS(`${VITE_API_BASE_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/rooms/${roomId}/video`, (message) => {
          try {
            const payload = JSON.parse(message.body);
            const nextVideoId = payload?.videoId ?? null;
            const nextCurrentTime = resolveCurrentTime(payload);
            const nextStatus = payload?.status ?? null;
            initialStateLoadedRef.current = true;
            setVideoId(nextVideoId);
            setCurrentTime(nextCurrentTime);
            setStatus(nextStatus);
            currentTimeRef.current = nextCurrentTime;
            statusRef.current = nextStatus;
            if (nextStatus !== "PLAYING") {
              setNeedsSoundUnlock(false);
            }
            applyServerState({
              videoId: nextVideoId,
              currentTime: nextCurrentTime,
              status: nextStatus,
            });
          } catch (error) {
            console.error("Failed to parse video state:", error);
          }
        });
      },
      onDisconnect: () => {
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      if (seekTimerRef.current) {
        clearTimeout(seekTimerRef.current);
        seekTimerRef.current = null;
      }
      if (seekPollRef.current) {
        clearInterval(seekPollRef.current);
        seekPollRef.current = null;
      }
      if (pauseConfirmTimerRef.current) {
        clearTimeout(pauseConfirmTimerRef.current);
        pauseConfirmTimerRef.current = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (!videoId) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      initialSyncDoneRef.current = false;
      pendingStateRef.current = null;
      playerReadyRef.current = false;
      return;
    }

    const callControlApi = async (action, time) => {
      if (!roomId || !canControlVideo) return;
      try {
        await controlRoomVideo(roomId, {
          roomId: Number(roomId),
          action,
          currentTime: time,
          videoId,
        });
        lastSentRef.current = { action, time: Date.now() };
      } catch (error) {
        const status = error?.response?.status;
        const code = error?.response?.data?.code;
        if (
          status === 403 ||
          code === "FORBIDDEN" ||
          code === "ACCESS_DENIED" ||
          code === "NOT_ROOM_HOST" ||
          code === "ROOM_HOST_REQUIRED"
        ) {
          onControlForbidden?.();
        }
        console.error(error);
      }
    };

    const handleSeekStart = (event) => {
      const frame = playerFrameRef.current;
      if (!frame || !playerRef.current) return;
      const point =
        event.touches && event.touches[0]
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : { x: event.clientX ?? 0, y: event.clientY ?? 0 };
      const rect = frame.getBoundingClientRect();
      const x = point.x;
      const y = point.y;
      const inside =
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (!inside) return;
      isSeekingRef.current = true;
      seekStartTimeRef.current =
        typeof playerRef.current.getCurrentTime === "function"
          ? playerRef.current.getCurrentTime()
          : null;
    };

    const handleSeekEnd = () => {
      if (!isSeekingRef.current || !playerRef.current) return;
      const endTime =
        typeof playerRef.current.getCurrentTime === "function"
          ? playerRef.current.getCurrentTime()
          : null;
      const startTime = seekStartTimeRef.current;
      const moved =
        startTime != null && endTime != null
          ? Math.abs(endTime - startTime) >= 1
          : false;
      if (moved) {
        callControlApi("SEEK", endTime ?? 0);
        seekIgnoreUntilRef.current = Date.now() + 1000;
        if (seekTimerRef.current) {
          clearTimeout(seekTimerRef.current);
        }
        seekTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
        }, 1000);
      } else {
        isSeekingRef.current = false;
      }
      seekStartTimeRef.current = null;
    };

    window.addEventListener("pointerdown", handleSeekStart);
    window.addEventListener("pointerup", handleSeekEnd);
    window.addEventListener("touchstart", handleSeekStart, { passive: true });
    window.addEventListener("touchend", handleSeekEnd);

    const ensureYouTubeApi = () =>
      new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }
        const existingScript = document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(script);
        }
        window.onYouTubeIframeAPIReady = () => resolve();
      });

    let cancelled = false;

    ensureYouTubeApi().then(() => {
      if (cancelled || !playerContainerRef.current) return;
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId,
        width: 560,
        height: 315,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            playerReadyRef.current = true;
            applyLocalAudio(localVolume, localMuted);
            if (pendingStateRef.current) {
              applyServerState(pendingStateRef.current);
              pendingStateRef.current = null;
            } else {
              applyServerState({
                videoId,
                currentTime: currentTimeRef.current,
                status: statusRef.current ?? "PAUSED",
              });
            }
            if (!seekPollRef.current) {
              lastTimeSampleRef.current =
                typeof event.target.getCurrentTime === "function"
                  ? event.target.getCurrentTime()
                  : 0;
              seekPollRef.current = setInterval(() => {
                if (!playerRef.current) return;
                if (syncingRef.current) {
                  lastTimeSampleRef.current =
                    typeof playerRef.current.getCurrentTime === "function"
                      ? playerRef.current.getCurrentTime()
                      : lastTimeSampleRef.current;
                  return;
                }
                const nowTime =
                  typeof playerRef.current.getCurrentTime === "function"
                    ? playerRef.current.getCurrentTime()
                    : lastTimeSampleRef.current;
                const diff = Math.abs(nowTime - lastTimeSampleRef.current);
                if (diff > 2) {
                  lastSeekSentAtRef.current = Date.now();
                  callControlApi("SEEK", nowTime);
                  seekIgnoreUntilRef.current = Date.now() + 3000;
                  lastTimeSampleRef.current = nowTime;
                  return;
                }
                lastTimeSampleRef.current = nowTime;
              }, 500);
            }
          },
          onStateChange: (event) => {
            if (!initialStateLoadedRef.current) return;
            if (!initialSyncDoneRef.current) return;
            if (syncingRef.current) return;
            const time =
              typeof event.target.getCurrentTime === "function"
                ? event.target.getCurrentTime()
                : 0;
            const now = Date.now();
            if (event.data === window.YT.PlayerState.BUFFERING) {
              if (pauseConfirmTimerRef.current) {
                clearTimeout(pauseConfirmTimerRef.current);
                pauseConfirmTimerRef.current = null;
              }
              lastBufferingAtRef.current = Date.now();
              lastPlayerTimeRef.current = time;
              lastPlayerStateRef.current = event.data;
              return;
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (pauseConfirmTimerRef.current) {
                clearTimeout(pauseConfirmTimerRef.current);
                pauseConfirmTimerRef.current = null;
              }
              if (
                lastSentRef.current.action === "PLAY" &&
                Date.now() - lastSentRef.current.time < 800
              ) {
                lastPlayerTimeRef.current = time;
                lastPlayerStateRef.current = event.data;
                return;
              }
              if (statusRef.current === "PLAYING" && Date.now() < suppressEventsUntilRef.current) {
                lastPlayerTimeRef.current = time;
                lastPlayerStateRef.current = event.data;
                return;
              }
              if (statusRef.current !== "PLAYING") {
                lastPlaySentAtRef.current = Date.now();
                callControlApi("PLAY", time);
                lastPlayerTimeRef.current = time;
                lastPlayerStateRef.current = event.data;
                return;
              }
              lastPlaySentAtRef.current = Date.now();
              callControlApi("PLAY", time);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              if (statusRef.current !== "PLAYING") {
                lastPlayerTimeRef.current = time;
                lastPlayerStateRef.current = event.data;
                return;
              }
              if (pauseConfirmTimerRef.current) {
                clearTimeout(pauseConfirmTimerRef.current);
              }
              const pauseAt = time;
              pauseConfirmTimerRef.current = setTimeout(() => {
                if (!playerRef.current) return;
                const stillPaused =
                  typeof playerRef.current.getPlayerState === "function"
                    ? playerRef.current.getPlayerState() ===
                    window.YT.PlayerState.PAUSED
                    : false;
                const nowTime =
                  typeof playerRef.current.getCurrentTime === "function"
                    ? playerRef.current.getCurrentTime()
                    : pauseAt;
                const stable = Math.abs(nowTime - pauseAt) < 0.3;
                if (!stillPaused || !stable) return;
                if (
                  lastSentRef.current.action === "PAUSE" &&
                  Date.now() - lastSentRef.current.time < 800
                ) {
                  return;
                }
                callControlApi("PAUSE", nowTime);
              }, 300);
            }
            lastPlayerTimeRef.current = time;
            lastPlayerStateRef.current = event.data;
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", handleSeekStart);
      window.removeEventListener("pointerup", handleSeekEnd);
      window.removeEventListener("touchstart", handleSeekStart);
      window.removeEventListener("touchend", handleSeekEnd);
    };
  }, [videoId, roomId, canControlVideo, applyLocalAudio, applyServerState]);

  useEffect(() => {
    if (!playerRef.current || !videoId) return;
    statusRef.current = status;
    currentTimeRef.current = currentTime;
    initialSyncDoneRef.current = true;
  }, [currentTime, status, videoId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const target = playerFrameRef.current;
      const active = Boolean(
        target &&
        (document.fullscreenElement === target ||
          document.webkitFullscreenElement === target ||
          document.mozFullScreenElement === target ||
          document.msFullscreenElement === target)
      );
      setFullscreenActive(active);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!videoId || !playerReadyRef.current) return;
    applyLocalAudio(localVolume, localMuted);
  }, [videoId, localVolume, localMuted, applyLocalAudio]);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      if (!playerRef.current || !playerRef.current.getCurrentTime) return 0;
      return playerRef.current.getCurrentTime();
    },
    seekTo: (time) => {
      if (!playerRef.current || !playerRef.current.seekTo) return;
      syncingRef.current = true;
      playerRef.current.seekTo(time, true);
      setTimeout(() => {
        syncingRef.current = false;
      }, 300);
    },
  }));

  return (
    <div className="player-card">
      {videoId ? (
        <>
          <div className={`player-frame ${canControlVideo ? "" : "player-frame--readonly"}`} ref={playerFrameRef}>
            <div className="player-frame__inner" ref={playerContainerRef} />
            {status === "PAUSED" && (
              <div className="player-overlay player-overlay--paused">
                <div className="player-overlay__badge">일시정지</div>
              </div>
            )}
            {!canControlVideo && <div className="player-readonly-badge">방장만 조작 가능</div>}
            {status === "PLAYING" && needsSoundUnlock && (
              <button
                type="button"
                className="sound-unlock"
                onClick={() => {
                  if (playerRef.current?.unMute) {
                    playerRef.current.unMute();
                  }
                  userInteractedRef.current = true;
                  setNeedsSoundUnlock(false);
                }}
              >
                소리 켜기
              </button>
            )}
          </div>
          <div className="player-audio-bar">
            <div className="player-audio-bar__volume">
              <button
                type="button"
                className="player-audio-bar__icon-btn"
                aria-label={localMuted || localVolume === 0 ? "음소거 해제" : "음소거"}
                onClick={() => {
                  const nextMuted = !localMuted;
                  setLocalMuted(nextMuted);
                  applyLocalAudio(localVolume, nextMuted);
                  if (!nextMuted) {
                    userInteractedRef.current = true;
                    setNeedsSoundUnlock(false);
                  }
                }}
              >
                <img src={speakerIcon} alt="소리" className="player-audio-bar__icon-image" />
              </button>
              <div className="player-audio-bar__volume-panel">
                <input
                  className="player-audio-bar__slider"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={localVolume}
                  onChange={(event) => {
                    const nextVolume = Number(event.target.value);
                    const nextMuted = nextVolume === 0;
                    setLocalVolume(nextVolume);
                    setLocalMuted(nextMuted);
                    applyLocalAudio(nextVolume, nextMuted);
                    if (!nextMuted) {
                      userInteractedRef.current = true;
                      setNeedsSoundUnlock(false);
                    }
                  }}
                />
                <span className="player-audio-bar__value">
                  {localMuted || localVolume === 0 ? 0 : localVolume}%
                </span>
              </div>
            </div>
            <div className="player-audio-bar__actions">
              <button
                type="button"
                className={`player-audio-bar__action-btn ${fullscreenActive ? "is-active" : ""}`}
                onClick={async () => {
                  const target = playerFrameRef.current;
                  if (!target) return;
                  try {
                    const fullscreenElement =
                      document.fullscreenElement ||
                      document.webkitFullscreenElement ||
                      document.mozFullScreenElement ||
                      document.msFullscreenElement;
                    if (fullscreenElement) {
                      if (document.exitFullscreen) {
                        await document.exitFullscreen();
                      } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                      } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                      } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                      }
                      return;
                    }
                    if (target.requestFullscreen) {
                      await target.requestFullscreen();
                    } else if (target.webkitRequestFullscreen) {
                      target.webkitRequestFullscreen();
                    } else if (target.mozRequestFullScreen) {
                      target.mozRequestFullScreen();
                    } else if (target.msRequestFullscreen) {
                      target.msRequestFullscreen();
                    }
                  } catch (error) {
                    console.error("전체화면 전환 실패:", error);
                  }
                }}
              >
                {fullscreenActive ? "축소" : "전체"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>재생 중인 영상이 없습니다.</p>
          <p className="empty-state__sub">방장이 영상을 변경하면 자동으로 로드됩니다.</p>
        </div>
      )}
    </div>
  );
});

export default RoomVideo;
