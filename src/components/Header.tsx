import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { clearTokens, getAccessToken } from "../auth/tokenStorage";
import brandIcon from "../imgs/watchy_icon.png";

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
        <img src={brandIcon} alt="" className="app-header__brand-icon" />
        <span className="app-header__brand-name font-brand">Watchy</span>
      </Link>
      <nav className="app-header__nav">
        <Link to="/rooms" className="app-header__nav-link">방 목록</Link>
        <Link to="/profile" className="app-header__nav-link">프로필</Link>
        {!isLoggedIn && (
          <Link to="/login" className="app-header__nav-link app-header__nav-link--outline">
            로그인
          </Link>
        )}
        {isLoggedIn && (
          <button
            type="button"
            className="app-header__nav-link app-header__nav-link--outline"
            onClick={onLogout}
          >
            로그아웃
          </button>
        )}
      </nav>
    </header>
  );
}
