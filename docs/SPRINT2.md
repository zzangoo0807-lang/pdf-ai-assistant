# Sprint 2: 핵심 모드 기능 구현 및 프롬프트 엔지니어링

> **목표**: 다중 PDF 통합 요약 모드와 10문항 객관식 퀴즈 생성 및 고유 ID 기반 채점/셔플 로직 완성

---

## 1. 개요 및 연관 제약 사항

| 항목 | 내용 |
| :--- | :--- |
| **관련 제약 사항 3** | **고유 ID 기반 채점 및 셔플 리셋**: 문제 배열 인덱스가 아닌 고유 `id` 기준 답안 바인딩 및 셔플 시 리셋 |
| **응답 제약 사항** | **Strict JSON 배열 출력**: 퀴즈 생성 시 `[{ id, question, options, answer, explanation }]` 포맷 준수 |

---

## 2. 세부 태스크 목록

- [x] **2.1. 다중 PDF 통합 정리 모드 파이프라인**
  - "누락 없는 마크다운 통합 노트" 생성을 위한 시스템 프롬프트 작성
  - 마크다운 렌더러(`react-markdown`, `remark-gfm`) 연동 및 가독성 높은 노트 뷰어 구성
- [x] **2.2. 객관식 퀴즈 생성 및 Strict JSON 파싱**
  - PRD [응답 제약] 준수: 10개 객관식 문항의 엄격한 JSON 스키마 프롬프트 작성
    ```json
    [
      {
        "id": 1,
        "question": "문제 내용",
        "options": ["1번 보기", "2번 보기", "3번 보기", "4번 보기"],
        "answer": 2,
        "explanation": "해설 내용"
      }
    ]
    ```
  - JSON 마크다운 코드블록 래핑(` ```json ... ``` `) 제거 및 파싱 안전성 강화 로직
- [x] **2.3. 고유 ID 기반 퀴즈 상태 관리 및 채점 시스템 (제약 3)**
  - 답안 State를 `Record<number, number>` (Key: 문제 `id`, Value: 선택한 보기 1~4)로 설계
  - `[문제 섞어 다시 풀기]` 기능 구현:
    - `id` 기준 답안 상태 완벽 리셋 (`setUserAnswers({})`, `setIsGraded(false)`)
    - 문항 배열 셔플 (Fisher-Yates/랜덤 정렬 적용)
  - `[새로운 문제 생성]` 파이프라인 연동
- [x] **2.4. 미풀이 문항 채점 예외 처리**
  - 미풀이 문항 존재 시 `AlertDialog` 팝업("풀지 않은 문항이 있습니다. 계속 채점하시겠습니까?") 노출

---

## 3. 구현 소스코드 위치

- **시스템 프롬프트 & JSON 파싱**: [lib/gemini-client.ts](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/lib/gemini-client.ts)
- **퀴즈 상태 및 채점/셔플 로직**: [components/pdf-study-app.tsx](file:///c:/Users/zzang/Desktop/%EC%A7%81%EB%AC%B4/pdf-ai-assistant/components/pdf-study-app.tsx)

---

## 4. 완료 기준 (DoD)

- [x] 통합 정리 모드에서 Markdown 문서가 구조적으로 출력됨
- [x] 퀴즈 모드에서 10문제가 정확한 JSON 포맷으로 생성되어 렌더링됨
- [x] 문제를 섞은 후에도 각 문제의 고유 `id`에 맞춰 채점 및 해설이 정확하게 매칭됨
- [x] 미풀이 문항 채점 제출 시 예외 안내 팝업 정상 작동

---

## 5. 검증 결과 및 테스트 로그 (Verification Log)

```bash
# 1. TypeScript 정적 타입 검사
$ cmd /c npx tsc --noEmit
# Exit Code: 0 (오류 0건)

# 2. Strict JSON 파싱, 고유 ID 채점 및 셔플 리셋 단위 검증 (test-sprint2.js)
$ cmd /c node test-sprint2.js
=== Sprint 2 Unit & Integration Verification ===
PASS 1: Cleanly parsed markdown-wrapped JSON -> questions count: 2
PASS 2: Initial score calculated by ID -> 1 / 2 (expected: 1)
PASS 3: Score after shuffling questions by ID -> 1 (expected equal to initialScore: 1)
PASS 3 SUCCESS: Shuffle preserves exact ID-based scoring!
PASS 4: Partial answer check -> hasUnanswered: false
PASS 4: Partial answer check -> hasUnanswered: true
=== All Sprint 2 Verification Tests Completed Successfully ===
```
