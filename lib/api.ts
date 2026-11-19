import axios from "axios"
import type {
  User,
  Document as DocType,
  ChatResponse,
  Quiz,
  QuizAttempt,
  AnalyticsOverview,
  AnswerEvaluation,
  Flashcard,
  Lecture,
  LectureSummaryResponse,
} from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

function getToken() {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("token") || ""
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const apiService = {
  // ── Authentication ──────────────────────────────────────────
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password })
    return response.data
  },

  async signup(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await axios.post(`${API_URL}/auth/register`, { name, email, password })
    return response.data
  },

  async getProfile(): Promise<User> {
    const response = await axios.get(`${API_URL}/auth/profile`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async updateProfile(data: { name?: string; email?: string }): Promise<{ user: User }> {
    const response = await axios.patch(`${API_URL}/auth/profile`, data, {
      headers: authHeaders(),
    })
    return response.data
  },

  // ── Document Intelligence (PDF & DOCX) ───────────────────────
  async uploadDocument(
    file: File,
    title: string,
    onProgress?: (pct: number) => void
  ): Promise<{ message: string; document: DocType }> {
    const form = new FormData()
    form.append("file", file)
    form.append("title", title)

    const response = await axios.post(`${API_URL}/documents/upload`, form, {
      headers: {
        ...authHeaders(),
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      },
    })
    return response.data
  },

  async listDocuments(search?: string, status?: string): Promise<{ documents: DocType[] }> {
    const params = new URLSearchParams()
    if (search) params.append("search", search)
    if (status) params.append("status", status)

    const response = await axios.get(`${API_URL}/documents?${params.toString()}`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getDocument(id: string): Promise<{ document: DocType }> {
    const response = await axios.get(`${API_URL}/documents/${id}`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getDocumentStatus(id: string): Promise<{
    status: DocType["status"]
    errorMessage?: string
    pageCount: number
    chunkCount: number
    totalWords: number
  }> {
    const response = await axios.get(`${API_URL}/documents/${id}/status`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async deleteDocument(id: string): Promise<{ message: string }> {
    const response = await axios.delete(`${API_URL}/documents/${id}`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async chatWithDocument(id: string, message: string): Promise<ChatResponse> {
    const response = await axios.post(
      `${API_URL}/documents/${id}/chat`,
      { message },
      { headers: authHeaders() }
    )
    return response.data
  },

  async clearDocumentChat(id: string): Promise<{ message: string }> {
    const response = await axios.delete(`${API_URL}/documents/${id}/chat`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async regenerateSummary(id: string): Promise<{ message: string; summary: DocType["summary"] }> {
    const response = await axios.post(
      `${API_URL}/documents/${id}/regenerate-summary`,
      {},
      { headers: authHeaders() }
    )
    return response.data
  },

  // ── Quiz Generation & Assessment ─────────────────────────────
  async generateQuiz(payload: {
    documentId: string
    topic?: string
    selectedTopics?: string[]
    difficulty?: "easy" | "medium" | "hard" | "mixed"
    questionType?: "mcq" | "descriptive" | "mixed"
    questionSubtype?: "shortAnswer" | "longAnswer" | "conceptual" | "analytical" | "mixed"
    numQuestions?: number
  }): Promise<{ success: boolean; quiz: Quiz; requestedCount?: number; generatedCount?: number; warning?: string }> {
    const response = await axios.post(`${API_URL}/quizzes/generate`, payload, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getQuizzes(documentId?: string): Promise<{ quizzes: Quiz[] }> {
    const url = documentId ? `${API_URL}/quizzes?documentId=${documentId}` : `${API_URL}/quizzes`
    const response = await axios.get(url, { headers: authHeaders() })
    return response.data
  },

  async getQuiz(id: string): Promise<{ quiz: Quiz }> {
    const response = await axios.get(`${API_URL}/quizzes/${id}`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async submitQuiz(
    quizId: string,
    answers: any[],
    timeSpent = 0
  ): Promise<{
    success: boolean
    score: number
    accuracy: number
    correct: number
    total: number
    attempt: QuizAttempt
  }> {
    const response = await axios.post(
      `${API_URL}/quizzes/${quizId}/attempt`,
      { quizId, answers, timeSpent },
      { headers: authHeaders() }
    )
    return response.data
  },

  async evaluateAnswer(payload: {
    question: string
    expectedAnswer: string
    keyPoints?: string[]
    userAnswer: string
    contextText?: string
    pageNumber?: number
  }): Promise<AnswerEvaluation> {
    const response = await axios.post(`${API_URL}/quizzes/evaluate-answer`, payload, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getQuizHistory(documentId?: string): Promise<{ attempts: QuizAttempt[] }> {
    const url = documentId ? `${API_URL}/quizzes/history?documentId=${documentId}` : `${API_URL}/quizzes/history`
    const response = await axios.get(url, { headers: authHeaders() })
    return response.data
  },

  // ── Lectures ────────────────────────────────────────────────
  async uploadLecture(payload: {
    title: string
    description?: string
    youtubeUrl?: string
    audioUrl?: string
    videoFile?: File | null
    audioFile?: File | null
    pptFile?: File | null
    bookFiles?: File[]
  }): Promise<{
    lecture: Lecture
    processingMode?: "queue" | "inline"
    processingFailed?: boolean
    message?: string
  }> {
    const form = new FormData()
    form.append("title", payload.title)
    if (payload.description) form.append("description", payload.description)
    if (payload.youtubeUrl) form.append("youtubeUrl", payload.youtubeUrl)
    if (payload.audioUrl) form.append("audioUrl", payload.audioUrl)
    if (payload.videoFile) form.append("video", payload.videoFile)
    if (payload.audioFile) form.append("audio", payload.audioFile)
    if (payload.pptFile) form.append("ppt", payload.pptFile)
    payload.bookFiles?.forEach((file) => form.append("book", file))

    const response = await axios.post(`${API_URL}/lectures/upload`, form, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getLectures(): Promise<{ lectures: Lecture[] }> {
    const response = await axios.get(`${API_URL}/lectures`, { headers: authHeaders() })
    return response.data
  },

  async getLecture(id: string): Promise<Lecture> {
    const response = await axios.get(`${API_URL}/lectures/${id}`, { headers: authHeaders() })
    return response.data
  },

  async getLectureSummary(id: string): Promise<LectureSummaryResponse> {
    const response = await axios.get(`${API_URL}/lectures/${id}/summary`, { headers: authHeaders() })
    return response.data
  },

  async processLecture(id: string): Promise<{
    lecture: Lecture
    processingMode?: "queue" | "inline"
    processingFailed?: boolean
    message?: string
  }> {
    const response = await axios.post(`${API_URL}/lectures/${id}/process`, {}, { headers: authHeaders() })
    return response.data
  },

  async deleteLecture(id: string): Promise<{ ok: boolean }> {
    const response = await axios.delete(`${API_URL}/lectures/${id}`, { headers: authHeaders() })
    return response.data
  },

  async chatWithLecture(id: string, message: string): Promise<ChatResponse> {
    const response = await axios.post(
      `${API_URL}/lectures/${id}/chat`,
      { message },
      { headers: authHeaders() }
    )
    return response.data
  },

  async getFlashcards(id: string): Promise<{ flashcards: Flashcard[] }> {
    const response = await axios.get(`${API_URL}/lectures/${id}/flashcards`, { headers: authHeaders() })
    return response.data
  },

  async generateFlashcards(id: string, count = 10): Promise<{ flashcards: Flashcard[] }> {
    const response = await axios.post(
      `${API_URL}/lectures/${id}/flashcards`,
      { count },
      { headers: authHeaders() }
    )
    return response.data
  },

  async getLectureBooks(id: string): Promise<{ documents: DocType[] }> {
    const response = await axios.get(`${API_URL}/lectures/${id}/books`, { headers: authHeaders() })
    return response.data
  },

  async uploadBookToLecture(id: string, files: File[]): Promise<{ books: DocType[] }> {
    const form = new FormData()
    files.forEach((file) => form.append("book", file))

    const response = await axios.post(`${API_URL}/lectures/${id}/books`, form, {
      headers: authHeaders(),
    })
    return response.data
  },

  // ── Performance Analytics ────────────────────────────────────
  async getUserAnalytics(): Promise<AnalyticsOverview> {
    const response = await axios.get(`${API_URL}/analytics/overview`, {
      headers: authHeaders(),
    })
    return response.data
  },

  // Backward compatibility alias
  async getStudentAnalytics(): Promise<AnalyticsOverview> {
    return this.getUserAnalytics()
  },
}
