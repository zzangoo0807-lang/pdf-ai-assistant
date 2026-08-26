import { generateObject } from "ai"
import {
  MODEL_ID,
  quizSchema,
  extractPdfFiles,
  filesToFileParts,
  UploadError,
} from "@/lib/pdf-ai"

export const maxDuration = 60

const SYSTEM_PROMPT = `당신은 대학 강의 자료로 시험 문제를 출제하는 전문 출제자입니다.
사용자가 업로드한 여러 개의 PDF 문서 내용을 바탕으로, 실전 대비용 객관식 문제 10개를 한국어로 출제하세요.

출제 규칙:
- 정확히 10문항, 각 문항은 4개의 보기를 가집니다.
- 각 문항에는 반드시 정답이 하나만 존재해야 합니다.
- 문서의 핵심 개념, 정의, 수치, 응용 사례를 골고루 다루어 난이도를 다양하게 구성합니다.
- answerIndex 는 정답 보기의 0-based 인덱스입니다.
- explanation 에는 왜 그 보기가 정답인지 상세히 설명합니다.
- 문서에 실제로 근거가 있는 내용으로만 출제하고, 보기의 정답 위치를 골고루 분산시키세요.`

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const files = extractPdfFiles(formData)
    const fileParts = await filesToFileParts(files)

    const { object } = await generateObject({
      model: MODEL_ID,
      schema: quizSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `총 ${files.length}개의 PDF 문서를 업로드했습니다. 위 규칙에 따라 객관식 문제 10개를 출제해주세요.`,
            },
            ...fileParts,
          ],
        },
      ],
    })

    return Response.json({ questions: object.questions })
  } catch (error) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    console.log("[v0] quiz error:", error)
    return Response.json(
      { error: "문제 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    )
  }
}
