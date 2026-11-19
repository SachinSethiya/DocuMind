import { create } from "zustand"
import { persist } from "zustand/middleware"
import { apiService } from "@/lib/api"
import type {
  Document as DocType,
  Lecture,
  Quiz,
  QuizAttempt,
  User,
  AnalyticsOverview,
} from "@/lib/types"

interface AppStoreState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  documents: DocType[]
  activeDocument: DocType | null
  quizzes: Quiz[]
  analytics: AnalyticsOverview | null

  // Auth actions
  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string) => Promise<boolean>
  fetchProfile: () => Promise<void>
  updateProfile: (data: { name?: string; email?: string }) => Promise<boolean>
  logout: () => void

  // Document actions
  fetchDocuments: (search?: string, status?: string) => Promise<void>
  fetchDocument: (id: string) => Promise<DocType | null>
  deleteDocument: (id: string) => Promise<void>
  setActiveDocument: (doc: DocType | null) => void

  // Quiz actions
  fetchQuizzes: (documentId?: string) => Promise<void>
  submitQuizAttempt: (quizId: string, answers: any[], timeSpent?: number) => Promise<any>
  getUserQuizAttempts: () => QuizAttempt[]

  // Analytics actions
  fetchAnalytics: () => Promise<void>

  // Lecture actions
  lectures: Lecture[]
  fetchLectures: () => Promise<void>
  uploadLecture: (payload: {
    title: string
    description?: string
    youtubeUrl?: string
    audioUrl?: string
    videoFile?: File | null
    audioFile?: File | null
    pptFile?: File | null
    bookFiles?: File[]
  }) => Promise<{
    lecture: Lecture
    processingMode?: "queue" | "inline"
    processingFailed?: boolean
    message?: string
  }>
  deleteLecture: (id: string) => Promise<void>
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      documents: [],
      activeDocument: null,
      quizzes: [],
      analytics: null,
      lectures: [],

      async login(email, password) {
        try {
          const data = await apiService.login(email, password)
          if (data.token) {
            localStorage.setItem("token", data.token)
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch (error) {
          console.error("Login failed:", error)
          return false
        }
      },

      async signup(name, email, password) {
        try {
          const data = await apiService.signup(name, email, password)
          if (data.token) {
            localStorage.setItem("token", data.token)
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch (error) {
          console.error("Signup failed:", error)
          return false
        }
      },

      async fetchProfile() {
        try {
          const token = localStorage.getItem("token")
          if (!token) {
            set({ isLoading: false, isAuthenticated: false, user: null })
            return
          }

          const user = await apiService.getProfile()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          console.error("Profile fetch failed:", error)
          localStorage.removeItem("token")
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      async updateProfile(data) {
        try {
          const response = await apiService.updateProfile(data)
          set({ user: response.user })
          return true
        } catch (error) {
          console.error("Update profile failed:", error)
          return false
        }
      },

      logout() {
        localStorage.removeItem("token")
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          documents: [],
          activeDocument: null,
          quizzes: [],
          analytics: null,
          lectures: [],
        })
      },

      async fetchDocuments(search, status) {
        try {
          const data = await apiService.listDocuments(search, status)
          set({ documents: data.documents || [] })
        } catch (error) {
          console.error("Fetch documents failed:", error)
        }
      },

      async fetchDocument(id) {
        try {
          const data = await apiService.getDocument(id)
          set({ activeDocument: data.document })
          return data.document
        } catch (error) {
          console.error("Fetch document failed:", error)
          return null
        }
      },

      async deleteDocument(id) {
        await apiService.deleteDocument(id)
        set((state) => ({
          documents: state.documents.filter((d) => d._id !== id),
          activeDocument: state.activeDocument?._id === id ? null : state.activeDocument,
        }))
      },

      setActiveDocument(doc) {
        set({ activeDocument: doc })
      },

      async fetchQuizzes(documentId) {
        try {
          const data = await apiService.getQuizzes(documentId)
          set({ quizzes: data.quizzes || [] })
        } catch (error) {
          console.error("Fetch quizzes failed:", error)
        }
      },

      async submitQuizAttempt(quizId, answers, timeSpent = 0) {
        try {
          const result = await apiService.submitQuiz(quizId, answers, timeSpent)
          await get().fetchProfile()
          return result
        } catch (error) {
          console.error("Submit quiz failed:", error)
          throw error
        }
      },

      getUserQuizAttempts() {
        return (get().user?.quizAttempts as any) || []
      },

      async fetchAnalytics() {
        try {
          const data = await apiService.getUserAnalytics()
          set({ analytics: data })
        } catch (error) {
          console.error("Fetch analytics failed:", error)
        }
      },

      async fetchLectures() {
        try {
          const data = await apiService.getLectures()
          set({ lectures: data.lectures || [] })
        } catch (error) {
          console.error("Fetch lectures failed:", error)
        }
      },

      async uploadLecture(payload) {
        const result = await apiService.uploadLecture(payload)
        await get().fetchLectures()
        return result
      },

      async deleteLecture(id) {
        await apiService.deleteLecture(id)
        set((state) => ({
          lectures: state.lectures.filter((lecture) => (lecture._id || lecture.id) !== id),
        }))
      },
    }),
    {
      name: "documind-store",
      version: 2,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
