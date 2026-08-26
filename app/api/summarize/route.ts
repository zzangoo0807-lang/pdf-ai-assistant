import { generateText } from "ai"
import {
  MODEL_ID,
  extractPdfFiles,
  filesToFileParts,
  UploadError,
} from "@/lib/pdf-ai"

export const maxDuration = 60

const SYSTEM_PROMPT = `당신은 대학 강의 자료를 정리해주는 전문 학습 도우미입니다.
사용자가 업로드한 여러 개의 PDF 문서를 종합하여, 시험 대비에 적합한 하나의 통합 정리 노트를 한국어 Markdown 형식으로 작성하세요.

작성 규칙:
- 반드시 순수 Markdown 으로만 작성합니다. (코드펜스 \`\`\` 로 전체를 감싸지 마세요)
- 여러 문서에 걸친 내용을 하나의 흐름으로 통합하고 중복은 제거합니다.
- 표나 도표의 핵심 수치가 있으면 Markdown 표로 정리합니다.
- 아래 구조를 따르세요:
  # 다중 PDF 통합 정리 노트
  ## 1. 문서 전체 개요
  ## 2. 주요 주제별 핵심 정리  (주제별 소제목 + 세부 불릿)
  ## 3. 핵심 용어 정리
  ## 4. 종합 결론
- 문서에 실제로 존재하는 내용만 사용하고, 근거 없는 내용을 지어내지 마세요.`

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const files = extractPdfFiles(formData)
    const fileParts = await filesToFileParts(files)

    const { text } = await generateText({
      model: MODEL_ID,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `총 ${files.length}개의 PDF 문서를 업로드했습니다. 위 규칙에 따라 통합 정리 노트를 작성해주세요.`,
            },
            ...fileParts,
          ],
        },
      ],
    })

    return Response.json({ summary: text })
  } catch (error) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    console.log("[v0] summarize error:", error)
    return Response.json(
      { error: "문서 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    )
  }
}
