export interface User {
  _id?: string
  id?: string
  name: string
  email: string
  role?: "student" | "teacher" | "admin"
  attendance?: number
  scores?: number[]
  quizAttempts?: {
    quizId: string
    score: number
    completedAt: string
  }[]
  createdAt?: string
}

export interface ChatMessage {
  _id?: string
  role: "user" | "assistant"
  content: string
  sources?: {
    text: string
    score: number
    pageNumber?: number
    section?: string
  }[]
  createdAt?: string
}

export interface DocumentTopic {
  name: string
  explanation: string
  subtopics?: string[]
  relatedKeywords?: string[]
  importanceScore?: number
  pageNumber?: number
  pageReferences?: number[]
  section?: string
}

export interface DocumentAnalysis {
  overview?: string
  executiveSummary?: string
  keyPoints?: string[]
  importantFacts?: string[]
  definitions?: {
    term: string
    definition: string
    pageNumber?: number
  }[]
  importantConcepts?: string[]
}

export interface DocumentSummary {
  overview?: string
  executiveSummary?: string
  keyPoints?: string[]
  importantConcepts?: string[]
  chapterSummaries?: {
    title: string
    summary: string
    pageNumber?: number
  }[]
  definitions?: {
    term: string
    definition: string
  }[]
  keyTakeaways?: string[]
  shortSummary?: string
  detailedSummary?: string
  sectionWiseSummary?: string
  documentOverview?: string
  mainObjective?: string
  importantDefinitions?: {
    term: string
    definition: string
    pageNumber?: number
  }[]
  keyFindings?: string[]
  finalTakeaways?: string[]
  lastGeneratedAt?: string
}

export interface Document {
  _id: string
  id?: string
  userId: string
  lectureId?: string
  lectureTitle?: string
  title: string
  fileName: string
  fileSize: number
  fileType: string
  status: "uploaded" | "uploading" | "processing" | "analyzing" | "completed" | "ready" | "failed"
  errorMessage?: string
  chunkCount: number
  pageCount: number
  totalWords: number
  rawText?: string
  pages?: {
    pageNumber: number
    text: string
  }[]
  keywords?: string[]
  topics?: DocumentTopic[]
  analysis?: DocumentAnalysis
  summary?: DocumentSummary
  chatHistory?: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ChatResponse {
  answer: string
  sources: {
    text: string
    score: number
    pageNumber?: number
    section?: string
  }[]
}

export interface QuizQuestion {
  id: string
  type: "mcq" | "descriptive"
  question: string
  options?: string[]
  correctAnswer?: number
  expectedAnswer?: string
  keyPoints?: string[]
  explanation?: string
  pageNumber?: number
  pageReferences?: number[]
  section?: string
  topic?: string
  difficulty?: string
  subtype?: "mcq" | "shortAnswer" | "longAnswer" | "conceptual" | "analytical" | "mixed"
  estimatedAnswerLength?: string
}

export interface Quiz {
  _id?: string
  id: string
  userId?: string
  documentId?: string
  lectureId?: string
  documentTitle?: string
  title: string
  topic: string
  difficulty: "easy" | "medium" | "hard" | "mixed"
  questionType: "mcq" | "descriptive" | "mixed"
  questionSubtype?: "mcq" | "shortAnswer" | "longAnswer" | "conceptual" | "analytical" | "mixed"
  requestedCount?: number
  selectedTopics?: string[]
  questions: QuizQuestion[]
  createdAt?: string
}

export interface AnswerEvaluation {
  score: number
  accuracy?: number
  feedback: string
  coveredPoints?: string[]
  missingKeyPoints?: string[]
  incorrectStatements?: string[]
  suggestions?: string
  pageReferences?: number[]
  suggestedImprovements?: string
}

export interface QuizAttemptAnswer {
  questionIndex: number
  question: string
  type?: "mcq" | "descriptive"
  selected?: string
  selectedOption?: number
  userAnswer?: string
  correct: boolean
  score?: number
  feedback?: string
  coveredPoints?: string[]
  missingKeyPoints?: string[]
  incorrectStatements?: string[]
  suggestions?: string
  pageReferences?: number[]
  suggestedImprovements?: string
  explanation?: string
  pageNumber?: number
  topic?: string
  difficulty?: string
}

export interface QuizAttempt {
  _id?: string
  id?: string
  quizId?: string
  student?: string
  quiz?: string | Quiz
  document?: string | Document
  documentTitle?: string
  topic?: string
  difficulty?: string
  score: number
  accuracy: number
  total: number
  correct: number
  timeSpent?: number
  answers: QuizAttemptAnswer[]
  completedAt?: string
  createdAt: string
}

export interface Flashcard {
  front: string
  back: string
  category?: string
}

export interface LectureSummary {
  local?: string
  ai?: string
  merged?: string
}

export interface Lecture {
  _id?: string
  id?: string
  title: string
  description?: string
  teacher?: string | { _id?: string; name?: string; email?: string }
  youtubeUrl?: string | null
  videoUrl?: string | null
  audioUrl?: string | null
  pptUrl?: string | null
  status: "uploaded" | "queued" | "processing" | "completed" | "failed"
  errorMessage?: string
  transcript?: { start?: number; end?: number; text: string }[]
  frames?: { time?: number; text?: string; imageUrl?: string }[]
  summary?: LectureSummary
  quiz?: { local?: string[]; ai?: string[]; merged?: string[] }
  quizStructured?: { question: string; options: string[]; correctAnswer: number }[]
  bookDocumentIds?: string[]
  flashcards?: Flashcard[]
  createdAt?: string
  updatedAt?: string
}

export interface LectureSummaryResponse {
  summary: LectureSummary
  status: string
  errorMessage?: string
}

export interface AnalyticsOverview {
  totalDocuments: number
  completedDocuments: number
  totalQuizzesAttempted: number
  totalQuestionsAttempted: number
  totalCorrectAnswers: number
  totalIncorrectAnswers: number
  averageScore: number
  overallAccuracy: number
  difficultyBreakdown: {
    easy: { attempts: number; avgScore: number; accuracy: number }
    medium: { attempts: number; avgScore: number; accuracy: number }
    hard: { attempts: number; avgScore: number; accuracy: number }
  }
  topicBreakdown: {
    topic: string
    attempts: number
    avgScore: number
    accuracy: number
    correct: number
    total: number
    needsImprovement: boolean
  }[]
  weakTopics: string[]
  strongTopics: string[]
  recommendations: string[]
  scoreHistory: {
    attemptNumber?: number
    date: string
    score: number
    accuracy: number
    title: string
    topic: string
    difficulty: string
  }[]
  recentActivity: {
    id: string
    documentTitle: string
    score: number
    accuracy: number
    difficulty: string
    topic: string
    completedAt: string
  }[]
}
