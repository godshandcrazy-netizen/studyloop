StudyLoop PWA v8

GitHub에 올릴 파일:
- index.html (기존 파일 교체)
- manifest.webmanifest (새 파일)
- sw.js (새 파일)
- icon-192.png (새 파일)
- icon-512.png (새 파일)

기존 app.js, style.css, config.js는 그대로 둡니다.

업로드 후 GitHub Pages 사이트를 Chrome에서 열면,
조건이 충족될 때 화면 오른쪽 아래에 '📲 앱 설치' 버튼이 나타납니다.

안 나타나면 Chrome 메뉴(⋮) → '앱 설치' 또는 '홈 화면에 추가'를 사용하세요.

서비스워커는 네트워크 우선 방식이라 새 GitHub 업데이트를 가능한 최신으로 가져옵니다.
