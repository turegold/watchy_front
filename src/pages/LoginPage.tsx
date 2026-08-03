import React from "react";
import { API_BASE_URL } from "../api/config";
import googleIcon from "../imgs/google_icon.png";
import kakaoIcon from "../imgs/kakao_icon.png";
import watchyIcon from "../imgs/watchy_icon.png";

export default function LoginPage() {
  const startOAuthLogin = (provider: "google" | "kakao") => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  return (
    <main className="auth-page auth-page--login">
      <section className="login-hero card">
        <span className="login-hero__badge">SYNC · CHAT · WATCH</span>
        <img src={watchyIcon} alt="" className="login-hero__logo" />
        <h1 className="login-hero__title font-brand">Watchy</h1>
        <p className="login-hero__description">같이 보고, 나누는 공간</p>

        <div className="login-actions">
          <button
            type="button"
            className="social-login social-login--google"
            onClick={() => startOAuthLogin("google")}
            aria-label="Google 로그인"
          >
            <img src={googleIcon} alt="" className="social-login__icon" />
            <span>구글로 시작하기</span>
          </button>
          <button
            type="button"
            className="social-login social-login--kakao"
            onClick={() => startOAuthLogin("kakao")}
            aria-label="Kakao 로그인"
          >
            <img src={kakaoIcon} alt="" className="social-login__icon" />
            <span>카카오로 시작하기</span>
          </button>
        </div>

        <p className="login-hero__hint">가입 즉시 친구들과 같은 순간을 함께 볼 수 있어요</p>
      </section>
    </main>
  );
}
