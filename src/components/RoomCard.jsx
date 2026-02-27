const RoomCard = ({ room, onJoin, joining = false }) => {
  const roomId = room.roomId ?? room.id;
  const title = room.title ?? room.name ?? `방 ${roomId}`;
  const isPrivate = room.isPrivate ?? room.private ?? false;
  const memberCount = room.participantCount ?? room.memberCount ?? room.members ?? 0;
  const maxMembers = room.maxMembers ?? 8;
  const videoTitle = room.videoTitle ?? "영상 없음";
  const videoId = room.videoId ?? room.currentVideoId ?? room.video?.id;
  const thumbnail =
    room.thumbnailUrl ??
    room.thumbnail ??
    (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);

  return (
    <div className={`room-card ${isPrivate ? "room-card--private" : ""}`}>
      <div className="room-card__index">
        <span className="room-card__dot" />
        <span className="room-card__number">{roomId}</span>
      </div>
      <div className="room-card__info">
        <h2 className="room-card__title">{title}</h2>
        <div className="room-card__video">
          <div className="room-card__thumb">
            {thumbnail ? (
              <img src={thumbnail} alt="영상 썸네일" />
            ) : (
              <div className="room-card__thumb-placeholder" />
            )}
          </div>
          <div>
            <p className="room-card__video-title">{videoTitle}</p>
            <p className="room-card__members">
              참여 {memberCount}명 / 최대 {maxMembers}명
            </p>
          </div>
        </div>
      </div>
      <div className="room-card__actions">
        {isPrivate && <span className="room-card__lock">LOCK</span>}
        <button className="room-card__enter" type="button" onClick={() => onJoin?.(roomId)} disabled={joining}>
          {joining ? "입장 중..." : "입장"}
        </button>
      </div>
    </div>
  );
};

export default RoomCard;
