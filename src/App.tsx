import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import RequireAuth from "./auth/RequireAuth";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RoomPage from "./pages/RoomPage";
import RoomsPage from "./pages/RoomsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/rooms" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/rooms" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
