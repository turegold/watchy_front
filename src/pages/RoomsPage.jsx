import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RoomCard from "../components/RoomCard";
import { createRoom } from "../api/room";
import { fetchRooms, joinRoom } from "../api/rooms";
import { getMe } from "../api/user";

const RoomsPage = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [status, setStatus] = useState("loading");
  const [statusMessage, setStatusMessage] = useState(null);
  const [currentUserNickname, setCurrentUserNickname] = useState("Guest");
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [createStatus, setCreateStatus] = useState(null);
  const [joiningRoomId, setJoiningRoomId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMe = async () => {
      try {
        const response = await getMe();
        const me = response?.data ?? {};
        if (!cancelled) {
          setCurrentUserNickname(me.nickname ?? "Guest");
        }
      } catch {
        if (!cancelled) {
          setCurrentUserNickname("Guest");
        }
      }
    };

    fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const data = await fetchRooms();
      setRooms(data);
      setStatus("ready");
      setStatusMessage(null);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setStatusMessage(error?.message ?? "방 목록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const pollingId = window.setInterval(() => {
      loadRooms();
    }, 7000);

    return () => {
      window.clearInterval(pollingId);
    };
  }, [loadRooms]);

  if (status === "loading") {
    return (
      <div className="rooms-page">
        <div className="rooms-page__status">방 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rooms-page">
        <div className="rooms-page__status">{statusMessage ?? "방 목록을 불러오지 못했습니다."}</div>
      </div>
    );
  }

  const handleCreateRoom = async () => {
    const title = newRoomTitle.trim();
    if (!title) {
      setCreateStatus("방 제목을 입력해주세요.");
      return;
    }

    try {
      setCreateStatus("creating");
      const created = await createRoom(title, newRoomPrivate);
      const createdRoomId = created?.id ?? created?.roomId;
      setCreateStatus("created");
      setCreateOpen(false);
      setNewRoomTitle("");
      setNewRoomPrivate(false);

      if (createdRoomId) {
        navigate(`/room/${createdRoomId}`, { state: { alreadyJoined: true } });
        return;
      }

      await loadRooms();
    } catch (error) {
      const message = error?.response?.data?.message ?? "방 생성에 실패했습니다.";
      setCreateStatus(message);
    }
  };

  const handleJoinRoom = async (roomId) => {
    if (!roomId || joiningRoomId) {
      return;
    }

    setJoiningRoomId(roomId);
    setStatusMessage(null);
    try {
      await joinRoom(Number(roomId));
      navigate(`/room/${roomId}`, { state: { alreadyJoined: true } });
    } catch (error) {
      const message = error?.message ?? "방 참여에 실패했습니다.";
      setStatusMessage(message);
      window.alert(message);
    } finally {
      setJoiningRoomId(null);
    }
  };

  return (
    <div className="rooms-page">
      <header className="rooms-header">
        <div className="rooms-header__brand">
          <div className="brand-mark">WP</div>
          <div>
            <p className="brand-label">Watch Party</p>
            <h1 className="brand-title">방 목록</h1>
          </div>
        </div>
        <div className="rooms-header__user">
          <span className="user-name">{currentUserNickname}</span>
          <div className="user-avatar">{String(currentUserNickname).slice(0, 1).toUpperCase()}</div>
        </div>
      </header>

      <div className="rooms-tabs">
        <button
          className={`tab-button ${createOpen ? "tab-button--active" : ""}`}
          type="button"
          onClick={() => {
            setCreateOpen((prev) => !prev);
            setCreateStatus(null);
          }}
        >
          방 만들기
        </button>
        <button className="tab-button" type="button" disabled>
          빠른 입장
        </button>
        <button className="tab-button" type="button">
          즐겨찾기
        </button>
      </div>

      {statusMessage && <p className="error-text">{statusMessage}</p>}

      {createOpen && (
        <div className="rooms-page__status">
          <div className="form">
            <label htmlFor="create-room-title">방 제목</label>
            <input
              id="create-room-title"
              type="text"
              value={newRoomTitle}
              onChange={(event) => setNewRoomTitle(event.target.value)}
              placeholder="예: 주말 영화 감상방"
            />
            <label>
              <input
                type="checkbox"
                checked={newRoomPrivate}
                onChange={(event) => setNewRoomPrivate(event.target.checked)}
              />{" "}
              비공개 방
            </label>
            <button
              className="primary-button"
              type="button"
              onClick={handleCreateRoom}
              disabled={createStatus === "creating"}
            >
              {createStatus === "creating" ? "생성 중..." : "생성"}
            </button>
            {createStatus && createStatus !== "creating" && createStatus !== "created" && (
              <p className="error-text">{createStatus}</p>
            )}
          </div>
        </div>
      )}

      <main className="rooms-main">
        <div className="rooms-grid">
          {rooms.length === 0 ? (
            <div className="rooms-page__status">현재 생성된 방이 없습니다.</div>
          ) : (
            rooms.map((room) => (
              <RoomCard
                key={room.roomId ?? room.id}
                room={room}
                onJoin={handleJoinRoom}
                joining={joiningRoomId === (room.roomId ?? room.id)}
              />
            ))
          )}
        </div>
      </main>

      <footer className="rooms-footer">
        <div className="rooms-footer__placeholder">
          채팅/정보 패널을 여기에 확장할 수 있습니다.
        </div>
      </footer>
    </div>
  );
};

export default RoomsPage;
