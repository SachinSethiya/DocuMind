export interface User {
  _id?: string
  id?: string
  name: string
  email: string
  role?: "student" | "teacher" | "admin"
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
  pageNumber?: number
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
  lastGeneratedAt?: string
}

export interface Document {
  _id: string
  id?: string
  userId: string
  title: string
  fileName: string
  fileSize: number
  fileType: string
  status: "uploaded" | "processing" | "analyzing" | "completed" | "ready" | "failed"
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
  topic?: string
  difficulty?: string
}

export interface Quiz {
  _id?: string
  id: string
  userId?: string
  documentId: string
  documentTitle?: string
  title: string
  topic: string
  difficulty: "easy" | "medium" | "hard" | "mixed"
  questionType: "mcq" | "descriptive" | "mixed"
  questions: QuizQuestion[]
  createdAt?: string
}

export interface AnswerEvaluation {
  score: number
  feedback: string
  missingKeyPoints?: string[]
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
  missingKeyPoints?: string[]
  suggestedImprovements?: string
  explanation?: string
  pageNumber?: number
  topic?: string
  difficulty?: string
}

export interface QuizAttempt {
  _id?: string
  id?: string
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
