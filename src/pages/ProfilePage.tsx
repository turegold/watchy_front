import { FormEvent, useEffect, useState } from "react";
import { getMe, MeResponseData, patchNickname } from "../api/user";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

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
