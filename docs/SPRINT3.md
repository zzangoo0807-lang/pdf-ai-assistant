# Sprint 3: 네이티브 인쇄 스타일링(@media print) 및 UI/UX 고도화

> **목표**: 무거운 외부 라이브러리 없이 네이티브 `@media print`를 통한 고품질 A4 출력 구현 및 인터랙션 완성

---

## 1. 개요 및 연관 제약 사항

| 항목 | 내용 |
| :--- | :--- |
| **관련 제약 사항 2** | **경량 PDF 저장 (`@media print`)**: `html2pdf.js` 등 외부 라이브러리 금지, `window.print()` 및 CSS `@media print` 스타일 적용 |

---

## 2. 세부 태스크 목록

- [x] **3.1. `@media print` 전용 CSS 구현 (제약 2)**
  - `app/globals.css` 내 인쇄 전용 스타일 시트 작성
  - 인쇄 시 숨겨야 할 요소 처리 (`.print:hidden`, 헤더, 탭 바, 파일 업로더, 액션 버튼, 네비게이션)
  - A4 규격 여백(`@page { size: A4; margin: 20mm; }`), 글꼴 크기, 줄 간격 및 페이지 넘김(`break-inside: avoid`) 최적화
- [x] **3.2. [PDF로 저장하기] 액션 바인딩**
  - 정리 노트 하단 `[PDF로 저장하기]` 버튼 클릭 시 `window.print()` 호출 트리거
- [x] **3.3. 상태 표시 및 로딩 인터랙션 고도화**
  - AI 생성(`Processing`) 진행 중 모든 입력창, 탭, 업로드, 버튼 완전 비활성화
  - 세련된 스켈레톤 및 로딩 스피너 애니메이션 표시
- [x] **3.4. 반응형 레이아웃 및 디자인 폴리싱**
  - 데스크톱/태블릿/모바일 반응형 UI 지원
  - API Key 직접 입력 팝업/토글 및 로컬 스토리지 연동 추가

---

## 3. 구현 소스코드 위치

- **인쇄 CSS 스타일시트**: [app/globals.css](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/app/globals.css)
- **인쇄 트리거 및 UI 상태 비활성화**: [components/pdf-study-app.tsx](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/components/pdf-study-app.tsx)

---

## 4. 완료 기준 (DoD)

- [x] [PDF로 저장하기] 클릭 시 브라우저 인쇄 미리보기에 정리 노트 본문만 깔끔하게 A4 레이아웃으로 표시됨
- [x] API 처리 중 모든 UI 컴포넌트 비활성화 및 스피너 정상 표시
