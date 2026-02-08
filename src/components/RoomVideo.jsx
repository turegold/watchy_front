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

const RoomVideo = forwardRef(({ roomId }, ref) => {
  const [connected, setConnected] = useState(false);
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

  const applyServerState = useCallback(
    (nextState) => {
      if (!nextState?.videoId) return;
      if (!playerRef.current || !playerReadyRef.current) {
        pendingStateRef.current = nextState;
        return;
      }
      const nextTime = nextState.currentTime ?? 0;
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
        const response = await fetch(`/api/rooms/${roomId}/video`);
        if (!response.ok) {
          throw new Error(`Failed to load video state: ${response.status}`);
        }
        const state = await response.json();
        const nextVideoId = state?.videoId ?? null;
        const nextCurrentTime = state?.currentTime ?? 0;
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

    const socket = new SockJS("/ws");
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/rooms/${roomId}/video`, (message) => {
          try {
            const payload = JSON.parse(message.body);
            const nextVideoId = payload?.videoId ?? null;
            const nextCurrentTime = payload?.currentTime ?? 0;
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
        setConnected(false);
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
      if (!roomId) return;
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
              action,
              currentTime: time,
              videoId,
            }),
          }
        );
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        lastSentRef.current = { action, time: Date.now() };
      } catch (error) {
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
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            playerReadyRef.current = true;
            if (pendingStateRef.current) {
              applyServerState(pendingStateRef.current);
              pendingStateRef.current = null;
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
  }, [videoId, roomId]);

  useEffect(() => {
    if (!playerRef.current || !videoId) return;
    statusRef.current = status;
    currentTimeRef.current = currentTime;
    initialSyncDoneRef.current = true;
  }, [currentTime, status, videoId]);

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
      <div className="player-card__meta">
        <span className={connected ? "pill pill--on" : "pill pill--off"}>
          {connected ? "LIVE" : "OFFLINE"}
        </span>
        <span className="player-card__hint">웹소켓 동기화 중</span>
      </div>
      {videoId ? (
        <div className="player-frame" ref={playerFrameRef}>
          <div className="player-frame__inner" ref={playerContainerRef} />
          {status === "PAUSED" && (
            <div className="player-overlay">
              <div className="player-overlay__badge">일시정지</div>
            </div>
          )}
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
