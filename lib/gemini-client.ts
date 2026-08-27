import { GoogleGenerativeAI, type Part } from "@google/generative-ai"

/**
 * [기술적 제약 사항 4: 용량 차단 로직]
 * 업로드된 파일 합계 50MB 또는 텍스트 100,000자 초과 여부를 사전 검사
 */
export const MAX_TOTAL_UPLOAD_BYTES = 50 * 1024 * 1024 // 50MB (기존 10MB에서 확장)
export const MAX_TEXT_LENGTH = 100000 // 100,000자 (기존 15,000자에서 확장)

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
export const GEMINI_MODEL_NAME = DEFAULT_GEMINI_MODEL

// Google AI Studio 최신 모델 버전 지원 및 자동 폴백 후보 목록
export const CANDIDATE_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-3.6-pro",
  "gemini-1.5-pro",
]

export interface QuizQuestion {
  id: number
  question: string
  options: string[]
  answer: number // 1-based index or 0-based index matching options
  explanation: string
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

/**
 * [기술적 제약 사항 4] 업로드 파일 및 텍스트 용량 사전 검증
 */
export function validateUpload(files: File[], textContent?: string): void {
  if (!files || files.length === 0) {
    throw new ValidationError("최소 하나 이상의 PDF 파일을 업로드해주세요.")
  }

  const totalBytes = files.reduce((acc, file) => acc + file.size, 0)
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    throw new ValidationError(
      "일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (50MB 초과)"
    )
  }

  if (textContent && textContent.length > MAX_TEXT_LENGTH) {
    throw new ValidationError(
      "일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (100,000자 초과)"
    )
  }
}

/**
 * 브라우저 File 객체를 Base64 인코딩된 Gemini Part 객체로 변환
 */
export async function fileToGenerativePart(file: File): Promise<Part> {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const base64Data = reader.result.split(",")[1]
        resolve(base64Data)
      } else {
        reject(new Error("파일 변환에 실패했습니다."))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type || "application/pdf",
    },
  }
}

/**
 * Gemini API Key 확인 헬퍼
 */
function getApiKey(customApiKey?: string): string {
  const apiKey =
    customApiKey ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    throw new Error(
      "Gemini API 키가 설정되지 않았습니다. 상단 [Gemini API 키 설정] 버튼을 눌러 API 키를 입력해주세요."
    )
  }
  return apiKey.trim()
}

/**
 * 모델 미지원(404), 과부하(503), 할당량(429) 에러 시 다음 모델로 자동 폴백하는 판별 헬퍼
 */
function isFallbackableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("is not supported") ||
    msg.includes("ModelService.ListModels") ||
    msg.includes("is no longer available") ||
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("429") ||
    msg.includes("quota")
  )
}

function formatKoreanErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes("404") || msg.includes("not found") || msg.includes("is no longer available")) {
    return "API Key에서 지원하는 Gemini 모델을 찾을 수 없습니다. 상단 설정에서 다른 모델을 선택하거나 Google AI Studio 키를 확인해주세요."
  }
  if (msg.includes("API 키") || msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
    return "유효하지 않은 Gemini API 키입니다. 상단 [Gemini API 키 설정]에서 올바른 키를 입력해주세요."
  }
  if (msg.includes("503") || msg.includes("overloaded")) {
    return "Gemini API 서버에 일시적 과부하가 발생했습니다. 잠시 후 다시 시도해 주세요."
  }
  return msg
}

/**
 * [기술적 제약 사항 1: 백엔드/서버리스 금지]
 * 브라우저 클라이언트에서 직접 Gemini API 호출하여 통합 정리 노트 생성 (gemini-3.6-flash 및 자동 폴백 지원)
 */
export async function generateSummaryClient(
  files: File[],
  customApiKey?: string,
  preferredModel: string = DEFAULT_GEMINI_MODEL,
  userRequirements?: string
): Promise<string> {
  validateUpload(files)

  const apiKey = getApiKey(customApiKey)
  const genAI = new GoogleGenerativeAI(apiKey)
  const fileParts = await Promise.all(files.map(fileToGenerativePart))

  const userReqSection = userRequirements && userRequirements.trim()
    ? `\n\n[사용자 요구사항 (최우선 반영)]\n사용자가 다음 요구사항을 직접 입력했습니다. 반드시 아래 내용을 우선적으로 반영하여 정리 노트를 작성하세요:\n${userRequirements.trim()}`
    : ""

  const prompt = `당신은 대학 강의 및 학술 자료를 종합 정리하는 최고 수준의 AI 학습 도우미입니다.
사용자가 업로드한 여러 개의 PDF 문서 내용을 바탕으로, 가독성과 학습 효과가 뛰어난 통합 정리 노트를 한국어 Markdown 형식으로 작성하세요.${userReqSection}

[시각 자료 및 표/도표 활용 필수 지침 (매우 중요)]
1. 핵심 비교 & 데이터 정리: 문서에 등장하는 핵심 개념, 수치, 비교 대상, 비교 항목은 적극적으로 Markdown 표(| 항목 | 설명 | 비고 |)로 정리하세요. 최소 2개 이상의 비교/정리 표를 포함하세요.
2. 프로세스 & 구조 시나리오: 개념의 흐름, 단계별 프로세스, 체계적 구조가 있을 경우 Mermaid 다이어그램(\`\`\`mermaid\ngraph TD\nA[단계1] --> B[단계2]\n\`\`\`)이나 아스키 구조도(ASCII Diagram)를 적극 활용하여 인포그래픽처럼 시각화하세요.
3. 주요 포인트 박스 강조: 핵심 정의, 중요 공식, 시험 출제 포인트는 💡 [주요 포인트] 및 📌 [시험 대비 팁] 블록콜아웃과 함께 가독성 높게 강조하세요.

작성 규칙 및 문서 구조:
- 반드시 순수 Markdown 으로만 작성합니다. (노트 전체를 코드펜스 \`\`\` 로 감싸지 마세요)
- 여러 문서에 걸친 내용을 하나의 체계적인 흐름으로 통합하고 누락 없이 중복은 제거합니다.
- 아래 구조를 준수하세요:
  # 📚 다중 PDF 통합 정리 노트
  ## 1. 📌 문서 전체 개요 & 핵심 요약
  ## 2. 💡 주요 주제별 상세 정리 (시각 자료, Markdown 표, Mermaid/도표 활용)
  ## 3. 📊 핵심 개념 비교 & 데이터 요약 표
  ## 4. 🔑 필수 용어 및 개념 정리
  ## 5. 🎯 종합 결론 & 시험 대비 핵심 리마인드
- 문서에 실제로 존재하는 내용에 근거하여 작성하고, 총 ${files.length}개의 PDF 문서 내용을 빠짐없이 통합 반영하세요.`

  const modelsToTry = [
    preferredModel,
    ...CANDIDATE_GEMINI_MODELS.filter((m) => m !== preferredModel),
  ]

  let lastError: unknown = null
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const response = await model.generateContent([prompt, ...fileParts])
      return response.response.text()
    } catch (err) {
      lastError = err
      if (isFallbackableError(err)) {
        console.warn(`[Gemini Model Fallback] '${modelName}' 오류 감지 -> 다음 모델(${modelsToTry[modelsToTry.indexOf(modelName) + 1] || 'done'}) 시도 중...`)
        continue
      }
      throw new Error(formatKoreanErrorMessage(err))
    }
  }

  throw new Error(formatKoreanErrorMessage(lastError))
}

/**
 * [기술적 제약 사항 1: 백엔드/서버리스 금지 & 응답 제약 JSON]
 * 브라우저 클라이언트에서 직접 Gemini API 호출하여 10문항 객관식 퀴즈 생성 (gemini-3.6-flash 및 자동 폴백 지원)
 */
export async function generateQuizClient(
  files: File[],
  customApiKey?: string,
  preferredModel: string = DEFAULT_GEMINI_MODEL,
  userRequirements?: string
): Promise<QuizQuestion[]> {
  validateUpload(files)

  const apiKey = getApiKey(customApiKey)
  const genAI = new GoogleGenerativeAI(apiKey)
  const fileParts = await Promise.all(files.map(fileToGenerativePart))

  const userReqSection = userRequirements && userRequirements.trim()
    ? `\n\n[사용자 요구사항 (최우선 반영)]\n사용자가 다음 요구사항을 직접 입력했습니다. 반드시 아래 내용을 우선적으로 반영하여 퀴즈를 출제하세요:\n${userRequirements.trim()}`
    : ""

  const prompt = `당신은 대학 강의 자료로 시험 문제를 출제하는 전문 출제자입니다.
사용자가 업로드한 여러 개의 PDF 문서 내용을 바탕으로, 실전 대비용 객관식 문제 10개를 한국어로 출제하세요.${userReqSection}

[응답 제약]
퀴즈 생성 시 프론트엔드 채점 로직이 깨지지 않도록, 반드시 아래 JSON 배열 포맷만 출력해야 합니다:
[
  {
    "id": 1,
    "question": "문제 내용",
    "options": ["1번 보기", "2번 보기", "3번 보기", "4번 보기"],
    "answer": 1,
    "explanation": "해설 내용"
  }
]

출제 규칙:
1. 정확히 10문항(id는 1부터 10까지 고유 숫자)을 생성하세요.
2. 각 문항은 정확히 4개의 보기(options)를 가져야 합니다.
3. answer 필드는 1-based index (1, 2, 3, 4 중 정답 번호)로 지정하세요.
4. explanation 에는 왜 그 보기가 정답인지 상세한 해설을 담으세요.
5. 문서의 핵심 개념, 정의, 수치, 응용 사례를 골고루 다루어 난이도를 다양하게 구성하세요.
6. JSON 이외의 설명이나 마크다운 백틱 문장을 일체 포함하지 마세요.`

  const modelsToTry = [
    preferredModel,
    ...CANDIDATE_GEMINI_MODELS.filter((m) => m !== preferredModel),
  ]

  let lastError: unknown = null
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        },
      })

      const response = await model.generateContent([prompt, ...fileParts])
      let rawJson = response.response.text().trim()

      if (rawJson.startsWith("```json")) {
        rawJson = rawJson.replace(/^```json\s*/, "").replace(/\s*```$/, "")
      } else if (rawJson.startsWith("```")) {
        rawJson = rawJson.replace(/^```\s*/, "").replace(/\s*```$/, "")
      }

      const parsed = JSON.parse(rawJson)
      if (!Array.isArray(parsed)) {
        throw new Error("AI 응답이 배열 형식이 아닙니다.")
      }

      return parsed.map((item, idx) => ({
        id: typeof item.id === "number" ? item.id : idx + 1,
        question: String(item.question || ""),
        options: Array.isArray(item.options)
          ? item.options.map(String)
          : ["보기 1", "보기 2", "보기 3", "보기 4"],
        answer: typeof item.answer === "number" ? item.answer : 1,
        explanation: String(item.explanation || ""),
      }))
    } catch (err) {
      lastError = err
      if (isFallbackableError(err)) {
        console.warn(`[Gemini Model Fallback] '${modelName}' 오류 감지 -> 다음 모델 시도 중...`)
        continue
      }
      throw new Error(formatKoreanErrorMessage(err))
    }
  }

  throw new Error(formatKoreanErrorMessage(lastError))
}
