import { API_BASE_URL } from "../api/config";

export default function LoginPage() {
  const startOAuthLogin = (provider: "google" | "kakao") => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  return (
    <main className="auth-page">
      <section className="card">
        <h1>로그인</h1>
        <p className="muted">OAuth 로그인 후 /auth/callback 으로 리다이렉트되어 토큰이 저장됩니다.</p>

        <div className="button-group">
          <button type="button" className="primary-button" onClick={() => startOAuthLogin("google")}>
            Google 로그인
          </button>
          <button type="button" className="primary-button" onClick={() => startOAuthLogin("kakao")}>
            Kakao 로그인
          </button>
        </div>

        <p className="notice-text">
          백엔드가 현재 JSON만 응답하면 콜백 처리가 되지 않습니다. OAuth2 성공 시
          <code> /auth/callback?accessToken=...&refreshToken=... </code>
          로 redirect 되도록 백엔드 수정이 필요합니다.
        </p>
      </section>
    </main>
  );
}
