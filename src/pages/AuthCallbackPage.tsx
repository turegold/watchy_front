import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setTokens } from "../auth/tokenStorage";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");

    if (!accessToken || !refreshToken) {
      setError("토큰이 누락되었습니다. 백엔드 OAuth 성공 후 redirect URL 설정을 확인해주세요.");
      return;
    }

    setTokens(accessToken, refreshToken);
    navigate("/profile", { replace: true });
  }, [navigate]);

  return (
    <main className="auth-page">
      <section className="card">
        <h1>OAuth 콜백 처리</h1>
        {!error && <p className="muted">토큰을 저장하는 중입니다...</p>}
        {error && (
          <>
            <p className="error-text">{error}</p>
            <Link className="primary-button link-button" to="/login">
              로그인으로 이동
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
