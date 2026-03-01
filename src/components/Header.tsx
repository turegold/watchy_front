import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { clearTokens, getAccessToken } from "../auth/tokenStorage";

export default function Header() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(getAccessToken());

  const onLogout = async () => {
    try {
      await logout();
    } catch (_error) {
      // Logout should clear local tokens even when server token is already invalid.
    } finally {
      clearTokens();
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand">
        Watchy
      </Link>
      <nav className="app-header__nav">
        <Link to="/rooms">방 목록</Link>
        <Link to="/profile">프로필</Link>
        {!isLoggedIn && <Link to="/login">로그인</Link>}
        {isLoggedIn && (
          <button type="button" className="secondary-button" onClick={onLogout}>
            로그아웃
          </button>
        )}
      </nav>
    </header>
  );
}
