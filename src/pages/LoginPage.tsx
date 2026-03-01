import React from "react";
import { API_BASE_URL } from "../api/config";
import googleIcon from "../imgs/google_icon.png";
import kakaoIcon from "../imgs/kakao_icon.png";

export default function LoginPage() {
  const startOAuthLogin = (provider: "google" | "kakao") => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  return (
    <main className="auth-page auth-page--login">
      <section className="login-hero card">
        <p className="login-hero__eyebrow">Sync. Chat. Watch.</p>
        <h1 className="login-hero__title">Watchy</h1>
        <p className="login-hero__description">같이 보고, 나누는 공간</p>

        <div className="login-actions">
          <button
            type="button"
            className="social-login social-login--google"
            onClick={() => startOAuthLogin("google")}
            aria-label="Google 로그인"
          >
            <img src={googleIcon} alt="" className="social-login__icon" />
            <span>구글 로그인</span>
          </button>
          <button
            type="button"
            className="social-login social-login--kakao"
            onClick={() => startOAuthLogin("kakao")}
            aria-label="Kakao 로그인"
          >
            <img src={kakaoIcon} alt="" className="social-login__icon" />
            <span>카카오 로그인</span>
          </button>
        </div>
      </section>
    </main>
  );
}
