import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RoomCard from "../components/RoomCard";
import { createRoom } from "../api/room";
import { fetchRooms, joinRoom } from "../api/rooms";

const RoomsPage = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [status, setStatus] = useState("loading");
  const [statusMessage, setStatusMessage] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [createStatus, setCreateStatus] = useState(null);
  const [joiningRoomId, setJoiningRoomId] = useState(null);

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
        <main className="rooms-main">
          <div className="rooms-page__status">방 목록을 불러오는 중...</div>
        </main>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rooms-page">
        <main className="rooms-main">
          <div className="rooms-page__status">{statusMessage ?? "방 목록을 불러오지 못했습니다."}</div>
        </main>
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

  const totalPeople = rooms.reduce(
    (acc, room) => acc + Number(room.participantCount ?? room.memberCount ?? 0),
    0,
  );

  return (
    <div className="rooms-page">
      <main className="rooms-main">
        <div className="rooms-heading">
          <div>
            <p className="rooms-heading__eyebrow">WATCH PARTY</p>
            <h1 className="rooms-heading__title">지금 열려 있는 방</h1>
            <p className="rooms-heading__sub">
              {rooms.length}개의 방에서 {totalPeople}명이 함께 보고 있어요
            </p>
          </div>
          <button
            type="button"
            className="rooms-create-btn"
            onClick={() => {
              setCreateOpen((prev) => !prev);
              setCreateStatus(null);
            }}
          >
            <span className="rooms-create-btn__plus">+</span>
            방 만들기
          </button>
        </div>

        {statusMessage && <p className="error-text">{statusMessage}</p>}

        {createOpen && (
          <section className="rooms-create">
            <h2 className="rooms-create__title">새 방 만들기</h2>
            <div className="rooms-create__row">
              <input
                className="rooms-create__input"
                type="text"
                value={newRoomTitle}
                onChange={(event) => setNewRoomTitle(event.target.value)}
                placeholder="예: 주말 영화 감상방"
              />
              <button
                type="button"
                className={`rooms-create__toggle ${newRoomPrivate ? "is-on" : ""}`}
                onClick={() => setNewRoomPrivate((prev) => !prev)}
              >
                <span className="rooms-create__toggle-mark">{newRoomPrivate ? "✓" : ""}</span>
                비공개 방
              </button>
              <button
                type="button"
                className="rooms-create__submit"
                onClick={handleCreateRoom}
                disabled={createStatus === "creating"}
              >
                {createStatus === "creating" ? "생성 중..." : "생성"}
              </button>
            </div>
            {createStatus && createStatus !== "creating" && createStatus !== "created" && (
              <p className="error-text" style={{ marginTop: 12 }}>{createStatus}</p>
            )}
          </section>
        )}

        <div className="rooms-grid">
          {rooms.length === 0 ? (
            <div className="rooms-empty">현재 생성된 방이 없습니다. 첫 방을 만들어보세요!</div>
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
    </div>
  );
};

export default RoomsPage;
