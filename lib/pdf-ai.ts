import { z } from "zod"
import type { FilePart } from "ai"

/** 일회 처리 가능한 업로드 총 용량 제한 (10MB) */
export const MAX_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024

/** 사용할 모델 — Gemini 는 PDF 를 직접 이해할 수 있어 별도 텍스트 추출이 필요 없습니다. */
export const MODEL_ID = "google/gemini-2.5-flash"

/** 퀴즈 응답 구조 — generateObject 가 항상 올바른 형식을 반환하도록 강제합니다. */
export const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().describe("문항 지문"),
        options: z
          .array(z.string())
          .length(4)
          .describe("4개의 보기. 정확히 하나만 정답이어야 합니다."),
        answerIndex: z
          .number()
          .int()
          .min(0)
          .max(3)
          .describe("정답 보기의 0-based 인덱스"),
        explanation: z.string().describe("정답에 대한 상세 해설"),
      }),
    )
    .length(10)
    .describe("정확히 10개의 객관식 문항"),
})

export type QuizQuestion = z.infer<typeof quizSchema>["questions"][number]

/**
 * FormData 로 전달된 PDF 파일들을 검증하고 AI SDK 의 file 메시지 파트로 변환합니다.
 * 용량 초과 시 사용자에게 보여줄 한국어 메시지를 담은 에러를 던집니다.
 */
export async function filesToFileParts(files: File[]): Promise<FilePart[]> {
  if (!files || files.length === 0) {
    throw new UploadError("최소 하나 이상의 PDF 파일을 업로드해주세요.")
  }

  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  if (totalSize > MAX_TOTAL_UPLOAD_BYTES) {
    throw new UploadError(
      "일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (10MB 초과)",
    )
  }

  const parts: FilePart[] = []
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    parts.push({
      type: "file",
      data: buffer,
      mediaType: "application/pdf",
      filename: file.name,
    })
  }
  return parts
}

/** 잘못된 업로드에 대한 사용자 대상(한국어) 에러 */
export class UploadError extends Error {}

/** multipart FormData 에서 pdf 파일 배열을 추출합니다. */
export function extractPdfFiles(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File)
}
