import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAccessToken } from "./tokenStorage";

export default function RequireAuth() {
  const location = useLocation();
  const accessToken = getAccessToken();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
