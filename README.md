# 골목 카페 타이쿤

## Alley Cafe Tycoon

손님은 알아서 와요. 당신은 카페만 키우세요.

`골목 카페 타이쿤`은 모바일 세로 화면을 우선한 코지 아이들 경영 게임입니다. 손님 유입, 주문, 조리, 서빙, 매출이 1초 단위로 자동 진행되고, 플레이어는 시설·메뉴·직원·인테리어·확장에 투자합니다.

## 주요 기능

- CSS 도형과 이모지로 만든 카페 디오라마
- 자동 손님 트윈, 주문 말풍선, 조리·서빙 진행바, 돈 흡입 파티클
- 첫 화면은 보유 금액, 카페 현황, 추천 업그레이드, 한 줄 힌트 중심으로 구성
- 첫 업그레이드 뒤 메뉴와 관리 패널을 순차적으로 노출하는 progressive disclosure
- 1초 경제 tick과 시설별 대기열·생산·서빙 병목 힌트
- 시설 5종: 커피머신, 카운터, 좌석, 디저트 오븐, 간판/매력
- 메뉴 6종: 아메리카노, 라떼, 쿠키, 케이크 조각, 아이스티, 시즌 특선
- 직원 3종: 서빙, 자리비움, 매니저 역할의 동물 직원
- 인테리어 8종과 카페 성장에 따른 외형 티어 변화
- 손님 도감 8종과 방문 횟수 기반 보너스
- 오프라인 보상: 최대 120분, 기본 온라인 예상 보상의 70%; 토끼 직원으로 효율 상승
- 매출과 시설을 키운 뒤 2호점을 여는 프랜차이즈/프레스티지 1단계
- 오프라인 선물상자, 확장 confetti, 카페 사진 저장/공유
- 네이티브 버튼, 키보드 포커스, `prefers-reduced-motion`, forced-colors 대응
- 외부 백엔드·로그인·결제·광고 강제·가챠·유료 재화 없음

## 실행 방법

프로젝트 루트에서 정적 서버를 실행합니다.

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

브라우저에서 `http://localhost:4173`을 엽니다. GitHub Pages workflow를 사용하면 정적 페이지로도 배포할 수 있습니다.

외부 CDN은 Lucide 아이콘, confetti, 카페 사진 캡처에 선택적으로 사용합니다. CDN이 실패해도 핵심 카페 경제와 UI는 작동하며, 사진 기능만 숨겨질 수 있습니다.

## 파일 구조

```text
.
├── index.html                         # 화면, 디자인 토큰, 게임 state와 1초 경제 로직
├── README.md                          # 프로젝트 설명과 실행/저장 안내
└── .github/workflows/deploy-pages.yml # GitHub Pages 정적 배포
```

## 저장 방식

- 저장 키: `alley-cafe-tycoon-save-v1`
- 하나의 state 객체에 `cash`, `prestigePoints`, `stations`, `menus`, `staff`, `interiors`, `customersCollection`, `currentBottleneckHint`, `lastSavedAt`, `lastSeenAt`, `offlineRewardPending`, `unlockedPanels`, `settings`, `cafeVisualTier`를 포함합니다.
- 브라우저 `localStorage`에만 저장합니다. 서버나 계정은 필요하지 않습니다.
- 5초 자동 저장과 함께 업그레이드·메뉴·직원·인테리어·확장 같은 주요 클릭 직후 저장합니다.
- 탭 숨김, 페이지 종료(`visibilitychange`, `pagehide`, `beforeunload`)에도 저장합니다.
- 마지막 접속 시각에서 최대 120분을 계산하고 기본 효율 70%로 오프라인 매출을 선물상자에 담습니다.
- 저장 데이터를 삭제하면 초기 자금으로 새 카페를 시작합니다.

## 디자인/접근성 원칙

- 크림·카라멜·민트·핑크·골드 색상 토큰과 역할 기반 semantic token 사용
- 320px reflow, 360px 가로 스크롤 없는 모바일 레이아웃, 1280px 데스크톱 대응
- 짧은 문구, 아이콘·숫자·라벨 우선, 첫 접속 안내 한 줄
- 색상만으로 상태를 전달하지 않고 텍스트·아이콘·진행바를 함께 사용
- `:focus-visible`, 44px 안팎의 터치 영역, 다이얼로그 포커스 이동, `aria-live` 상태 알림
- `prefers-reduced-motion`, forced-colors, 긴 문자열과 200% 확대를 고려한 반응형 스타일

## 적용한 skills

- `better-ui`
- `better-typography`
- `better-colors`
- `better-accessibility`
- `better-layout`
- `better-writing`
- `interface-review`

## 향후 확장 아이디어

현재 구현에 포함하지 않은 선택적 확장입니다.

- 카페별 날씨와 계절 배경
- 더 많은 메뉴 레시피와 인테리어 세트
- 여러 지점 사이의 장식 프리셋
- 오프라인 수익 상세 리포트

## 저장소명 변경 권장값

GitHub 저장소 이름은 코드만으로 바꿀 수 없으므로 저장소 설정에서 직접 변경해야 합니다.

**권장 저장소명: `alley-cafe-tycoon`**
