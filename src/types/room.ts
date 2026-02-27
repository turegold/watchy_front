export type RoomListItem = {
  roomId: number;
  title: string;
  isPrivate: boolean;
  hostUserId: number;
  hostNickname?: string | null;
  participantCount: number;
  maxMembers?: number;
  videoId?: string | null;
  videoTitle?: string;
  thumbnailUrl?: string | null;
};
