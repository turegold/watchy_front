const RoomCard = ({ room, onJoin, joining = false }) => {
  const roomId = room.roomId ?? room.id;
  const title = room.title ?? room.name ?? `방 ${roomId}`;
  const isPrivate = room.isPrivate ?? room.private ?? false;
  const memberCount = room.participantCount ?? room.memberCount ?? room.members ?? 0;
  const maxMembers = room.maxMembers ?? 8;
  const hostNickname = room.hostNickname ?? room.hostNickName ?? "방장";
  const videoId = room.videoId ?? room.currentVideoId ?? room.video?.id;
  const thumbnail =
    room.thumbnailUrl ??
    room.thumbnail ??
    (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);
  const hostInitial = String(hostNickname).slice(0, 1).toUpperCase();

  return (
    <article className={`room-card ${isPrivate ? "room-card--private" : ""}`}>
      <div className="room-card__top">
        <div className="room-card__thumb">
          {thumbnail ? (
            <img src={thumbnail} alt="영상 썸네일" />
          ) : (
            <div className="room-card__thumb-empty">재생 중인 영상 없음</div>
          )}
          {videoId && (
            <span className="room-card__live">
              <span className="room-card__live-dot" />
              LIVE
            </span>
          )}
          {isPrivate && <span className="room-card__private-badge">비공개</span>}
        </div>
        <div className="room-card__info">
          <h2 className="room-card__title">{title}</h2>
          <div className="room-card__host">
            <span className="room-card__host-avatar">{hostInitial}</span>
            <span className="room-card__host-name">{hostNickname}</span>
            <span className="room-card__host-badge">방장</span>
          </div>
        </div>
      </div>
      <div className="room-card__bottom">
        <span className="room-card__count">
          참여 {memberCount}명 / 최대 {maxMembers}명
        </span>
        <button
          className="room-card__enter"
          type="button"
          onClick={() => onJoin?.(roomId)}
          disabled={joining}
        >
          {joining ? "입장 중..." : "입장하기"}
        </button>
      </div>
    </article>
  );
};

export default RoomCard;
