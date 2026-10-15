# Paste Time Namer

클립보드에서 Figma로 붙여넣은 이미지 레이어의 이름을 붙여넣기 시각으로 자동 변경하는 로컬 개발 플러그인입니다.

이름 형식: `YYYY-MM-DD HH.mm.ss.SSS`

## 설치

1. Figma Desktop을 엽니다.
2. **Plugins → Development → Import plugin from manifest…** 를 선택합니다.
3. 이 폴더의 `manifest.json`을 선택합니다.
4. 파일에서 **Plugins → Development → Paste Time Namer**를 실행합니다.

## 사용

- 플러그인 창을 열어 둔 상태에서 이미지를 붙여넣습니다.
- 새 이미지 레이어 또는 이미지 fill이 새로 적용된 레이어가 현재 로컬 시각으로 이름 변경됩니다.
- 같은 초 안에 여러 이미지를 붙여넣어도 구분되도록 밀리초를 포함합니다.
- Figma 플러그인 API 특성상 플러그인 창을 닫으면 감시도 종료됩니다.

## 팀 배포

팀원에게 배포 ZIP 파일을 전달합니다. 팀원은 ZIP을 원하는 위치에 압축 해제한 뒤, 아래의 `설치_및_사용_매뉴얼.html` 안내에 따라 `manifest.json`을 Figma Desktop으로 가져오면 됩니다.

폴더를 이동하거나 삭제하면 개발 플러그인이 실행되지 않을 수 있으므로 설치 후에도 압축을 푼 폴더를 유지하세요.
