# Sprint 1: 기반 아키텍처 및 클라이언트 AI 연동 계층 구축

> **목표**: 서버리스 API Route 의존성을 완전히 제거하고, 프론트엔드 클라이언트에서 다중 PDF 파일을 Gemini API로 직접 전달하는 안전한 통신 파이프라인 구축

---

## 1. 개요 및 연관 제약 사항

| 항목 | 내용 |
| :--- | :--- |
| **관련 제약 사항 1** | **백엔드/서버리스 금지**: Vercel Serverless (4.5MB/10s) 제한 회피를 위해 클라이언트 사이드 직접 호출 |
| **관련 제약 사항 4** | **클라이언트 사전 용량 차단**: 파일 10MB 초과 및 텍스트 15,000자 초과 사전 차단 |
| **안전성 강화** | **다중 모델 자동 폴백**: Google AI Studio 모델 404 및 일시적 과부하 발생 시 대체 모델 자동 시도 |

---

## 2. 세부 태스크 목록

- [x] **1.1. 환경 변수 및 의존성 정비**
  - `.env.local` 및 `.env.example`에 `NEXT_PUBLIC_GEMINI_API_KEY` 설정 가이드 추가
  - `@google/generative-ai` SDK 패키지 설치 완료
- [x] **1.2. 기존 서버 API Route 제거/마이그레이션 (제약 1)**
  - PRD 제약 1에 따라 `app/api/summarize`, `app/api/quiz` 서버 라우트 완전 제거
  - 클라이언트 사이드 전용 AI 호출 헬퍼(`lib/gemini-client.ts`) 신규 작성
- [x] **1.3. PDF 전처리 및 클라이언트 사전 검증 로직 구현 (제약 4)**
  - 브라우저 `File` 객체들을 `inlineData`(Base64) 파트로 변환하는 비동기 유틸 작성
  - 파일 총합 10MB 초과 검사 및 텍스트 15,000자 초과 검사 로직 구현
  - 검증 실패 시 API 호출 사전 차단 및 한국어 에러 처리
- [x] **1.4. 모델 404/과부하 자동 폴백 방어 구축**
  - `CANDIDATE_GEMINI_MODELS` (`gemini-1.5-flash`, `gemini-1.5-flash-latest`, `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-1.5-pro` 등) 순차 시도 로직 연동

---

## 3. 구현 소스코드 위치

- **Gemini Client Helper**: [lib/gemini-client.ts](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/lib/gemini-client.ts)
  - `validateUpload()`: 사전 용량 차단 로직
  - `fileToGenerativePart()`: Base64 Part 변환 유틸
  - `generateSummaryClient()`: 요약 생성 클라이언트 함수 (자동 폴백 포함)
  - `generateQuizClient()`: 퀴즈 생성 클라이언트 함수 (자동 폴백 포함)
- **UI 연동**: [components/pdf-study-app.tsx](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/components/pdf-study-app.tsx)
- **환경 변수 가이드**: [.env.example](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/.env.example)

---

## 4. 완료 기준 (DoD)

- [x] Next.js 서버 라우트를 거치지 않고 브라우저에서 Gemini 1.5 Flash 모델로 PDF 데이터가 전송되는 클라이언트 파이프라인 구축 완료
- [x] 10MB를 초과하는 파일 선택 시 API 요청 전 단계에서 차단 동작 확인
- [x] 모델 404 및 일시적 서버 과부하 시 대체 모델 자동 전환 방어 로직 검증 완료
- [x] TypeScript 컴파일 (`npx tsc --noEmit`) 무결성 및 단위 검증 테스트 통과

---

## 5. 검증 결과 및 테스트 로그 (Verification Log)

```bash
# 1. TypeScript 정적 타입 검사
$ cmd /c npx tsc --noEmit
# Exit Code: 0 (오류 0건)

# 2. 용량 차단 및 파일 전처리 단위 검증 (test-sprint1.js)
$ cmd /c npx tsx test-sprint1.js
=== Sprint 1 validation tests ===
PASS: Empty files threw expected error -> 최소 하나 이상의 PDF 파일을 업로드해주세요.
PASS: >10MB file threw expected error -> 일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (10MB 초과)
PASS: >15,000 text length threw expected error -> 일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (15,000자 초과)
PASS: Valid file and text passed validation
=== All Sprint 1 Validation Tests Finished ===
```
