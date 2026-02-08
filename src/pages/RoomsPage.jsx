import { useEffect, useRef, useState } from "react";
import RoomCard from "../components/RoomCard";

const RoomsPage = () => {
  const [rooms, setRooms] = useState([]);
  const [status, setStatus] = useState("loading");
  const enrichedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fetchRooms = async () => {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) {
          throw new Error(`Failed to load rooms: ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          const baseRooms = Array.isArray(data) ? data : [];
          setRooms(baseRooms);
          setStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setStatus("error");
        }
      }
    };

    fetchRooms();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const enrichRooms = async () => {
      if (enrichedRef.current || rooms.length === 0) return;
      const nextRooms = await Promise.all(
        rooms.map(async (room) => {
          const roomId = room.id ?? room.roomId;
          const existingVideoId =
            room.videoId ?? room.currentVideoId ?? room.video?.id;
          if (existingVideoId || !roomId) return room;
          try {
            const response = await fetch(`/api/rooms/${roomId}/video`);
            if (!response.ok) return room;
            const state = await response.json();
            return { ...room, videoId: state?.videoId ?? null };
          } catch {
            return room;
          }
        })
      );
      if (!cancelled) {
        setRooms(nextRooms);
      }
      enrichedRef.current = true;
    };

    enrichRooms();

    return () => {
      cancelled = true;
    };
  }, [rooms]);

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
        <div className="rooms-page__status">방 목록을 불러오지 못했습니다.</div>
      </div>
    );
  }

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
          <span className="user-name">Guest</span>
          <div className="user-avatar">G</div>
        </div>
      </header>

      <div className="rooms-tabs">
        <button className="tab-button tab-button--active" type="button">
          방 만들기
        </button>
        <button className="tab-button" type="button">
          빠른 입장
        </button>
        <button className="tab-button" type="button">
          즐겨찾기
        </button>
      </div>

      <main className="rooms-main">
        <div className="rooms-grid">
          {rooms.length === 0 ? (
            <div className="rooms-page__status">현재 생성된 방이 없습니다.</div>
          ) : (
            rooms.map((room) => (
              <RoomCard key={room.id ?? room.roomId} room={room} />
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
