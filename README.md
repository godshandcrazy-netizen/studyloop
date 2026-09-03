# StudyLoop Arena

시험공부용 듀오링고 스타일 웹앱입니다.

## GitHub에 올릴 파일
- index.html
- style.css
- app.js
- config.js
- config-maker.html

## Supabase 연결
1. `config-maker.html`을 브라우저에서 열거나, 아래 형식으로 `config.js`를 수정합니다.
2. Project URL과 **Publishable key**만 사용합니다.
3. `secret`, `service_role`, DB password는 절대 넣지 않습니다.

```js
window.STUDYLOOP_CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxx"
};
```

Publishable key는 브라우저에 노출되는 공개용 키입니다. 실제 보안은 Supabase RLS 정책이 담당합니다.

## Vercel
GitHub 저장소를 Vercel에서 Import한 뒤 별도 빌드 설정 없이 정적 사이트로 배포할 수 있습니다.

## 중요
현재 XP 지급은 학습 클라이언트에서 요청하는 데모 구조입니다. 공개 경쟁 서비스를 크게 운영하기 전에는 XP 지급용 Postgres RPC/서버 함수를 추가해 조작 방지를 강화하는 것이 좋습니다.
