import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { getMe, MeResponseData, patchNickname, uploadProfileImage } from "../api/user";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageMessage, setImageMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMe = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getMe();
      const me = response?.data ?? {};
      setUser(me);
      setNickname(String(me.nickname ?? ""));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? "유저 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  const onSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 선택해도 onChange가 발생하도록 input 초기화
    if (event.target) event.target.value = "";
    if (!file) return;

    setImageMessage(null);

    if (!file.type.startsWith("image/")) {
      setImageMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageMessage("이미지 크기는 5MB 이하여야 합니다.");
      return;
    }

    setImageUploading(true);
    try {
      await uploadProfileImage(file);
      await loadMe(); // 갱신된 presigned 이미지 URL 다시 받기
      setImageMessage("프로필 이미지가 변경되었습니다.");
    } catch (uploadError: any) {
      setImageMessage(
        uploadError?.response?.data?.message ?? "이미지 업로드에 실패했습니다.",
      );
    } finally {
      setImageUploading(false);
    }
  };

  const onSubmitNickname = async (event: FormEvent) => {
    event.preventDefault();
    setResultMessage(null);

    try {
      const response = await patchNickname(nickname);
      const changedNickname = response?.data?.nickname ?? nickname;
      setUser((prev) => ({ ...(prev ?? {}), nickname: changedNickname }));
      setResultMessage(response?.message ?? "닉네임이 변경되었습니다.");
    } catch (requestError: any) {
      const code = requestError?.response?.data?.code;
      const message = requestError?.response?.data?.message;

      if (code === "DUPLICATE_NICKNAME") {
        setResultMessage("이미 사용 중인 닉네임입니다.");
        return;
      }

      if (code === "INVALID_NICKNAME") {
        setResultMessage("유효하지 않은 닉네임 형식입니다.");
        return;
      }

      setResultMessage(message ?? "닉네임 변경에 실패했습니다.");
    }
  };

  const level = Number(user?.level ?? 1);
  const exp = Number(user?.exp ?? 0);
  const expInLevel = ((exp % 1000) + 1000) % 1000; // 현재 레벨 내 진행(0~999)
  const toNext = 1000 - expInLevel;
  const expPct = `${(expInLevel / 1000) * 100}%`;
  const nicknameInitial = String(user?.nickname ?? "?").slice(0, 1).toUpperCase();

  return (
    <main className="profile-page">
      <div className="profile-wrap">
        {loading && <div className="profile-card profile-status">불러오는 중...</div>}
        {!loading && error && <div className="profile-card profile-status">{error}</div>}

        {!loading && !error && (
          <>
            <section className="profile-hero">
              <div className="profile-hero__cover" />
              <div className="profile-hero__body">
                <div className="profile-hero__row">
                  <div className="profile-hero__avatar">
                    {user?.profileImageUrl ? (
                      <img src={String(user.profileImageUrl)} alt="프로필 이미지" />
                    ) : (
                      <span className="profile-hero__avatar-initial">{nicknameInitial}</span>
                    )}
                  </div>
                  <div className="profile-hero__id">
                    <div className="profile-hero__namerow">
                      <h1 className="profile-hero__name">{String(user?.nickname ?? "닉네임")}</h1>
                      <span className="profile-hero__level">Lv.{level}</span>
                    </div>
                    <p className="profile-hero__email">{String(user?.email ?? "")}</p>
                  </div>
                  <button
                    type="button"
                    className="profile-hero__photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading ? "업로드 중..." : "사진 변경"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onSelectImage}
                    style={{ display: "none" }}
                  />
                </div>

                {imageMessage && <p className="profile-hint">{imageMessage}</p>}

                <div className="profile-exp">
                  <div className="profile-exp__meta">
                    <span>경험치 {expInLevel} / 1,000</span>
                    <span className="profile-exp__next">다음 레벨까지 {toNext}</span>
                  </div>
                  <div className="profile-exp__bar">
                    <div className="profile-exp__fill" style={{ width: expPct }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="profile-card">
              <h2 className="profile-card__title">닉네임 변경</h2>
              <p className="profile-card__sub">채팅과 방 목록에서 이 이름으로 보여요.</p>
              <form className="profile-nickname" onSubmit={onSubmitNickname}>
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="닉네임 입력"
                />
                <button type="submit" className="profile-nickname__submit">
                  변경하기
                </button>
              </form>
              {resultMessage && <p className="profile-hint">{resultMessage}</p>}
              <p className="profile-hint">2~50자 · 이미 사용 중인 닉네임은 사용할 수 없어요.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
