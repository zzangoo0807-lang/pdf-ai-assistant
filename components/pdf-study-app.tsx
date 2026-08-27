"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import {
  BookOpen,
  FileText,
  Key,
  ListChecks,
  Loader2,
  Printer,
  RefreshCw,
  Shuffle,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  generateSummaryClient,
  generateQuizClient,
  validateUpload,
  MAX_TOTAL_UPLOAD_BYTES,
  ValidationError,
  DEFAULT_GEMINI_MODEL,
  CANDIDATE_GEMINI_MODELS,
  type QuizQuestion,
} from "@/lib/gemini-client"

type Mode = "summary" | "quiz"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function PdfStudyApp() {
  const [mode, setMode] = useState<Mode>("summary")
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_GEMINI_MODEL)
  const inputRef = useRef<HTMLInputElement>(null)

  // 정리 모드 결과
  const [summaryText, setSummaryText] = useState("")

  // 퀴즈 모드 결과
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  /**
   * [기술적 제약 사항 3: 셔플 및 상태 관리]
   * 배열 인덱스가 아닌 고유 id (q.id)를 키로 사용자 답안 관리 (Key: q.id, Value: 1~4)
   */
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({})
  const [isGraded, setIsGraded] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // 로컬 스토리지에서 API 키 불러오기 (환경변수가 없을 경우 대비)
  useEffect(() => {
    const savedKey = localStorage.getItem("pdf_assistant_gemini_key")
    if (savedKey) setApiKeyInput(savedKey)
  }, [])

  const handleSaveApiKey = (key: string) => {
    setApiKeyInput(key)
    localStorage.setItem("pdf_assistant_gemini_key", key)
  }

  // [기술적 제약 사항 4: 용량 차단 로직] 프론트엔드 파일 합계 실시간 계산
  const totalSize = useMemo(
    () => files.reduce((acc, file) => acc + file.size, 0),
    [files],
  )
  const overLimit = totalSize > MAX_TOTAL_UPLOAD_BYTES

  /**
   * [기술적 제약 사항 3: 셔플 및 상태 관리]
   * 고유 id(q.id) 기준으로 정답 여부 채점
   */
  const score = useMemo(
    () =>
      questions.reduce(
        (acc, q) => (userAnswers[q.id] === q.answer ? acc + 1 : acc),
        0,
      ),
    [questions, userAnswers],
  )

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const incoming = Array.from(fileList).filter(
      (f) => f.type === "application/pdf",
    )
    if (incoming.length === 0) {
      toast.error("PDF 파일만 업로드할 수 있습니다.")
      return
    }
    // 이름+크기 기준 중복 제거
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`))
      const merged = [...prev]
      for (const f of incoming) {
        if (!seen.has(`${f.name}-${f.size}`)) merged.push(f)
      }
      return merged
    })
    if (inputRef.current) inputRef.current.value = ""
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const resetResults = () => {
    setSummaryText("")
    setQuestions([])
    setUserAnswers({})
    setIsGraded(false)
  }

  /**
   * [기술적 제약 사항 1: 백엔드/서버리스 금지]
   * API Route를 통하지 않고 프론트엔드에서 직접 generateSummaryClient 호출
   */
  const runSummary = async () => {
    setIsLoading(true)
    setSummaryText("")
    try {
      // [기술적 제약 사항 4] 10MB / 15,000자 사전 차단 검증
      validateUpload(files)

      const result = await generateSummaryClient(files, apiKeyInput, selectedModel)
      setSummaryText(result)
      toast.success("통합 정리 노트가 생성되었습니다.")
    } catch (err) {
      if (err instanceof ValidationError) {
        toast.error(err.message)
      } else {
        const msg = err instanceof Error ? err.message : "오류가 발생했습니다."
        toast.error(msg)
        if (msg.includes("API 키")) setShowApiKeyInput(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * [기술적 제약 사항 1: 백엔드/서버리스 금지 & 응답 제약]
   * API Route를 통하지 않고 프론트엔드에서 직접 generateQuizClient 호출
   */
  const runQuiz = async () => {
    setIsLoading(true)
    setQuestions([])
    setUserAnswers({})
    setIsGraded(false)
    try {
      // [기술적 제약 사항 4] 10MB / 15,000자 사전 차단 검증
      validateUpload(files)

      const fetchedQuestions = await generateQuizClient(files, apiKeyInput, selectedModel)
      setQuestions(fetchedQuestions)
      toast.success("10개의 문제가 생성되었습니다.")
    } catch (err) {
      if (err instanceof ValidationError) {
        toast.error(err.message)
      } else {
        const msg = err instanceof Error ? err.message : "오류가 발생했습니다."
        toast.error(msg)
        if (msg.includes("API 키")) setShowApiKeyInput(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcess = () => {
    // [예외 처리: 빈 입력]
    if (files.length === 0) {
      toast.error("최소 하나 이상의 PDF 파일을 업로드해주세요.")
      return
    }
    // [기술적 제약 사항 4: 용량 초과 차단]
    if (overLimit) {
      toast.error(
        "일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (10MB 초과)",
      )
      return
    }
    if (mode === "summary") runSummary()
    else runQuiz()
  }

  /**
   * [기술적 제약 사항 3] 문제의 고유 id를 키로 답안 선택 바인딩
   */
  const handleOptionSelect = (questionId: number, optionNumber: number) => {
    if (isGraded) return
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionNumber }))
  }

  const gradeQuiz = () => {
    setIsGraded(true)
    setConfirmOpen(false)
  }

  /**
   * [예외 처리: 미풀이 채점 확인]
   */
  const handleSubmitQuiz = () => {
    const answeredCount = Object.keys(userAnswers).length
    if (answeredCount < questions.length) {
      setConfirmOpen(true)
      return
    }
    gradeQuiz()
  }

  /**
   * [기술적 제약 사항 3: 셔플 및 상태 관리]
   * [문제 섞어 다시 풀기] 시 기존 사용자 답안 State를 완벽히 리셋(빈 객체)하고 문제 배열 셔플
   */
  const handleShuffleRetake = () => {
    setQuestions((prev) => [...prev].sort(() => Math.random() - 0.5))
    setUserAnswers({})
    setIsGraded(false)
    toast.info("문제를 섞고 답안을 초기화했습니다. 다시 풀어보세요!")
  }

  const processLabel =
    mode === "summary"
      ? "통합 노트 생성하기"
      : questions.length > 0
        ? "새로운 문제 생성"
        : "퀴즈 생성하기"

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* 인쇄 시 숨겨지는 헤더/입력 영역 (기술적 제약 사항 2: @media print 대응) */}
      <div className="print:hidden">
        <header className="mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <BookOpen className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                다중 PDF AI 학습 도우미
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="self-start sm:self-auto"
            >
              <Key className="mr-1.5 h-3.5 w-3.5" />
              {apiKeyInput ? "API 키 설정됨" : "Gemini API 키 설정"}
            </Button>
          </div>
          <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
            강의 자료 PDF 를 업로드하면 AI(Gemini 1.5 Flash)가 통합 정리 노트를 만들거나 실전 퀴즈를
            출제하고 즉시 채점해 드립니다.
          </p>

          {/* 클라이언트 API Key 입력 바 및 모델 선택 (선택 사항) */}
          {showApiKeyInput && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="Gemini API Key를 입력하세요 (AI Studio 발급)"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  (키는 브라우저 로컬스토리지에만 저장됩니다)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2 text-xs">
                <span className="font-medium text-muted-foreground">우선 선택 모델:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="rounded border border-input bg-background px-2.5 py-1 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CANDIDATE_GEMINI_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === DEFAULT_GEMINI_MODEL ? "(기본 / 자동 폴백)" : ""}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  (404 에러나 미지원 발생 시 작동 가능한 대체 모델로 자동 전환됩니다)
                </span>
              </div>
            </div>
          )}
        </header>

        {/* 1단계: 모드 선택 */}
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode)
            resetResults()
          }}
          className="mb-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary" disabled={isLoading}>
              <FileText className="mr-1.5 h-4 w-4" />
              다중 PDF 통합 정리 모드
            </TabsTrigger>
            <TabsTrigger value="quiz" disabled={isLoading}>
              <ListChecks className="mr-1.5 h-4 w-4" />
              앱 내 무한 랜덤 퀴즈 & 채점 모드
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 2단계: 다중 파일 업로드 카드 */}
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">PDF 업로드</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label
              htmlFor="pdf-input"
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:bg-muted ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">
                클릭하여 PDF 파일 선택 (여러 개 동시 선택 가능)
              </span>
              <span className="text-xs text-muted-foreground">
                [용량 제한] 파일 합계 최대 10MB / 텍스트 15,000자 이내
              </span>
              <input
                id="pdf-input"
                ref={inputRef}
                type="file"
                multiple
                accept="application/pdf"
                className="sr-only"
                disabled={isLoading}
                onChange={(e) => handleAddFiles(e.target.files)}
              />
            </label>

            {files.length > 0 && (
              <div className="flex flex-col gap-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{file.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={isLoading}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                        aria-label={`${file.name} 삭제`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">
                    선택된 문서: 총 {files.length}개 파일
                  </span>
                  <span
                    className={
                      overLimit
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {formatBytes(totalSize)} / 10 MB
                  </span>
                </div>
              </div>
            )}

            {/* [예외 처리: 상태 표시] Processing 중 모든 버튼 비활성화 */}
            <Button
              onClick={handleProcess}
              disabled={isLoading || files.length === 0 || overLimit}
              size="lg"
              className="w-full font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  문서를 분석 중입니다...
                </>
              ) : (
                processLabel
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 3단계: 로딩 스켈레톤 (인쇄 시 숨김) */}
      {isLoading && (
        <div className="print:hidden">
          {mode === "summary" ? (
            <Card>
              <CardContent className="flex flex-col gap-3 py-6">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="mt-4 h-6 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-10/12" />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex flex-col gap-3 py-5">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3단계: 결과 출력 - 다중 PDF 통합 정리 모드 */}
      {!isLoading && mode === "summary" && summaryText && (
        <Card className="print:border-0 print:shadow-none print:p-0">
          <CardContent className="py-6 print:p-0">
            <article className="markdown-note max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryText}
              </ReactMarkdown>
            </article>
            <Separator className="my-6 print:hidden" />
            <div className="flex justify-end print:hidden">
              {/* [기술적 제약 사항 2: PDF 저장 방식] window.print() 실행 */}
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                PDF로 저장하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3단계: 결과 출력 - 퀴즈 모드 */}
      {!isLoading && mode === "quiz" && questions.length > 0 && (
        <div className="flex flex-col gap-6">
          {isGraded && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="flex items-center justify-between py-5">
                <div>
                  <p className="text-sm text-muted-foreground">채점 결과</p>
                  <p className="text-2xl font-bold">
                    {score} / {questions.length} 정답
                  </p>
                </div>
                <Badge
                  variant={score >= 7 ? "default" : "secondary"}
                  className="text-base"
                >
                  {Math.round((score / questions.length) * 100)}점
                </Badge>
              </CardContent>
            </Card>
          )}

          {questions.map((q, index) => {
            // [기술적 제약 사항 3] q.id 기반 사용자 답안 조회 (1-based: 1, 2, 3, 4)
            const selectedOptNum = userAnswers[q.id]
            return (
              <Card key={q.id || index} className="shadow-sm">
                <CardContent className="py-5">
                  <p className="mb-4 font-semibold leading-relaxed text-pretty">
                    <span className="mr-1.5 text-primary">{index + 1}.</span>
                    {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, optIdx) => {
                      const optNum = optIdx + 1 // 1-based 보기 번호
                      const isSelected = selectedOptNum === optNum
                      const isCorrect = q.answer === optNum

                      let cls =
                        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors "
                      if (isGraded) {
                        if (isCorrect) {
                          cls +=
                            "border-green-500/60 bg-green-500/10 font-medium text-green-800 dark:text-green-300"
                        } else if (isSelected) {
                          cls +=
                            "border-destructive/60 bg-destructive/10 text-destructive"
                        } else {
                          cls += "border-border text-muted-foreground"
                        }
                      } else {
                        cls += isSelected
                          ? "border-primary bg-primary/10 cursor-pointer font-medium"
                          : "border-border hover:bg-muted cursor-pointer"
                      }

                      return (
                        <button
                          type="button"
                          key={optIdx}
                          onClick={() => handleOptionSelect(q.id, optNum)}
                          disabled={isGraded || isLoading}
                          className={cls + " text-left"}
                        >
                          <span className="shrink-0 font-semibold text-muted-foreground">
                            {optNum})
                          </span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {isGraded && (
                    <div className="mt-4 rounded-md border border-border bg-muted/50 px-3.5 py-3 text-sm leading-relaxed">
                      <span className="font-semibold text-primary">해설: </span>
                      {q.explanation}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          <div className="flex flex-col gap-3 sm:flex-row print:hidden">
            {!isGraded ? (
              <Button
                size="lg"
                className="flex-1 font-semibold"
                onClick={handleSubmitQuiz}
                disabled={isLoading}
              >
                답안 제출 및 채점하기
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="secondary"
                  className="flex-1 font-semibold"
                  onClick={handleShuffleRetake}
                  disabled={isLoading}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  문제 섞어 다시 풀기
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 font-semibold"
                  onClick={runQuiz}
                  disabled={isLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  새로운 문제 생성
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* [예외 처리: 미풀이 채점 알림 팝업] */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>풀지 않은 문항이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              아직 답하지 않은 문항이 있습니다. 그래도 채점하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 풀기</AlertDialogCancel>
            <AlertDialogAction onClick={gradeQuiz}>채점하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
