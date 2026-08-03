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

  return (
    <main className="content-page">
      <section className="card">
        <h1>유저 정보</h1>

        {loading && <p className="muted">불러오는 중...</p>}
        {!loading && error && <p className="error-text">{error}</p>}

        {!loading && !error && (
          <div className="profile-grid">
            <div className="profile-image">
              {user?.profileImageUrl ? (
                <img
                  src={String(user.profileImageUrl)}
                  alt="프로필 이미지"
                  className="profile-image__preview"
                />
              ) : (
                <div className="profile-image__placeholder">이미지 없음</div>
              )}
              <button
                type="button"
                className="primary-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
              >
                {imageUploading ? "업로드 중..." : "이미지 변경"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectImage}
                style={{ display: "none" }}
              />
              {imageMessage && <p className="muted">{imageMessage}</p>}
            </div>
            <p>
              <strong>Email:</strong> {String(user?.email ?? "준비중")}
            </p>
            <p>
              <strong>Nickname:</strong> {String(user?.nickname ?? "준비중")}
            </p>
            <p>
              <strong>Level:</strong> {String(user?.level ?? "준비중")}
            </p>
            <p>
              <strong>Experience:</strong> {String(user?.experience ?? "준비중")}
            </p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>닉네임 변경</h2>
        <form className="form" onSubmit={onSubmitNickname}>
          <label htmlFor="nickname">새 닉네임</label>
          <input
            id="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="닉네임 입력"
          />
          <button type="submit" className="primary-button">
            변경하기
          </button>
        </form>
        {resultMessage && <p className="muted">{resultMessage}</p>}
      </section>
    </main>
  );
}
