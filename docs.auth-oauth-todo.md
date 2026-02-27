# OAuth 연동 TODO (백엔드)

현재 백엔드 OAuth2 SuccessHandler가 JSON을 직접 응답하면, 프론트 라우트(`/auth/callback`)에서 토큰 저장을 자동 처리할 수 없습니다.

권장 수정:

- OAuth 성공 시 JSON 응답 대신 프론트로 redirect
- 예시:
  - `redirectUrl = FRONTEND_BASE_URL + "/auth/callback?accessToken=...&refreshToken=..."`
  - `response.sendRedirect(redirectUrl)`

프론트 구현은 위 redirect 구조(옵션 B)를 기준으로 완료되어 있습니다.

추가 개선(선택):

- refreshToken은 HttpOnly 쿠키 저장 방식으로 전환
- accessToken만 응답 본문 또는 메모리 저장으로 처리
