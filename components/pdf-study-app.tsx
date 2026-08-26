"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import {
  BookOpen,
  FileText,
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

const MAX_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024

type Mode = "summary" | "quiz"

type QuizQuestion = {
  question: string
  options: string[]
  answerIndex: number
  explanation: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function PdfStudyApp() {
  const [mode, setMode] = useState<Mode>("summary")
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 정리 모드 결과
  const [summaryText, setSummaryText] = useState("")

  // 퀴즈 모드 결과
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({})
  const [isGraded, setIsGraded] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const totalSize = useMemo(
    () => files.reduce((acc, file) => acc + file.size, 0),
    [files],
  )
  const overLimit = totalSize > MAX_TOTAL_UPLOAD_BYTES

  const score = useMemo(
    () =>
      questions.reduce(
        (acc, q, i) => (userAnswers[i] === q.answerIndex ? acc + 1 : acc),
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

  const buildFormData = () => {
    const fd = new FormData()
    for (const file of files) fd.append("files", file)
    return fd
  }

  const runSummary = async () => {
    setIsLoading(true)
    setSummaryText("")
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        body: buildFormData(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "오류가 발생했습니다.")
      setSummaryText(data.summary)
      toast.success("통합 정리 노트가 생성되었습니다.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const runQuiz = async () => {
    setIsLoading(true)
    setQuestions([])
    setUserAnswers({})
    setIsGraded(false)
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        body: buildFormData(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "오류가 발생했습니다.")
      setQuestions(data.questions)
      toast.success("10개의 문제가 생성되었습니다.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcess = () => {
    if (files.length === 0) {
      toast.error("최소 하나 이상의 PDF 파일을 업로드해주세요.")
      return
    }
    if (overLimit) {
      toast.error(
        "일회당 처리 가능한 분량을 초과했습니다. 분석을 차단합니다. (10MB 초과)",
      )
      return
    }
    if (mode === "summary") runSummary()
    else runQuiz()
  }

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    if (isGraded) return
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))
  }

  const gradeQuiz = () => {
    setIsGraded(true)
    setConfirmOpen(false)
    // 결과로 스크롤 상단 정렬은 생략, 점수 배지로 피드백
  }

  const handleSubmitQuiz = () => {
    const answeredCount = Object.keys(userAnswers).length
    if (answeredCount < questions.length) {
      setConfirmOpen(true)
      return
    }
    gradeQuiz()
  }

  const handleShuffleRetake = () => {
    setQuestions((prev) => [...prev].sort(() => Math.random() - 0.5))
    setUserAnswers({})
    setIsGraded(false)
  }

  const processLabel =
    mode === "summary"
      ? "통합 노트 생성하기"
      : questions.length > 0
        ? "새로운 문제 생성"
        : "퀴즈 생성하기"

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* 인쇄 시 숨겨지는 헤더/입력 영역 */}
      <div className="print:hidden">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              다중 PDF AI 학습 도우미
            </h1>
          </div>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            강의 자료 PDF 를 업로드하면 AI 가 통합 정리 노트를 만들거나 실전 퀴즈를
            출제하고 채점해 드립니다.
          </p>
        </header>

        {/* 모드 선택 */}
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
              통합 정리 모드
            </TabsTrigger>
            <TabsTrigger value="quiz" disabled={isLoading}>
              <ListChecks className="mr-1.5 h-4 w-4" />
              랜덤 퀴즈 & 채점
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 업로드 카드 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">PDF 업로드</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label
              htmlFor="pdf-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:bg-muted"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">
                클릭하여 PDF 파일 선택 (여러 개 가능)
              </span>
              <span className="text-xs text-muted-foreground">
                일회 처리 한도: 총 10MB
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
                      <span className="truncate text-sm">{file.name}</span>
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
                    총 {files.length}개 파일
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

            <Button
              onClick={handleProcess}
              disabled={isLoading || files.length === 0 || overLimit}
              size="lg"
              className="w-full"
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

      {/* 로딩 스켈레톤 */}
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

      {/* 결과: 통합 정리 모드 */}
      {!isLoading && mode === "summary" && summaryText && (
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="py-6">
            <article className="markdown-note max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryText}
              </ReactMarkdown>
            </article>
            <Separator className="my-6 print:hidden" />
            <div className="flex justify-end print:hidden">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                PDF로 저장하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과: 퀴즈 모드 */}
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
            const selected = userAnswers[index]
            return (
              <Card key={index}>
                <CardContent className="py-5">
                  <p className="mb-4 font-semibold leading-relaxed text-pretty">
                    <span className="mr-1 text-primary">{index + 1}.</span>
                    {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, optIndex) => {
                      const isSelected = selected === optIndex
                      const isCorrect = q.answerIndex === optIndex

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
                          ? "border-primary bg-primary/10 cursor-pointer"
                          : "border-border hover:bg-muted cursor-pointer"
                      }

                      return (
                        <button
                          type="button"
                          key={optIndex}
                          onClick={() => handleOptionSelect(index, optIndex)}
                          disabled={isGraded}
                          className={cls + " text-left"}
                        >
                          <span className="shrink-0 font-semibold">
                            {optIndex + 1})
                          </span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {isGraded && (
                    <div className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-3 text-sm leading-relaxed">
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
              <Button size="lg" className="flex-1" onClick={handleSubmitQuiz}>
                답안 제출 및 채점하기
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleShuffleRetake}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  문제 섞어 다시 풀기
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={runQuiz}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  새로운 문제 생성
                </Button>
              </>
            )}
          </div>
        </div>
      )}

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
