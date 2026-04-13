import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GridConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Template {
  id: string;
  name: string;
  questionCount: number;
  optionsPerQuestion: number;
  correctAnswers: string[];
  gridConfig?: GridConfig;
  createdAt: number;
}

export interface GradingResult {
  id: string;
  templateId: string;
  studentName: string;
  answers: string[];
  score: number;
  totalQuestions: number;
  detectedAnswers: {
    question: number;
    answer: string;
    confidence: number;
  }[];
  gradedAt: number;
}

interface StoreState {
  templates: Template[];
  results: GradingResult[];
  addTemplate: (template: Template) => void;
  updateTemplate: (id: string, patch: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;
  addResult: (result: GradingResult) => void;
  deleteResult: (id: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      templates: [],
      results: [],
      addTemplate: (template) =>
        set((state) => ({ templates: [...state.templates, template] })),
      updateTemplate: (id, patch) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),
      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),
      addResult: (result) =>
        set((state) => ({ results: [...state.results, result] })),
      deleteResult: (id) =>
        set((state) => ({
          results: state.results.filter((r) => r.id !== id),
        })),
    }),
    {
      name: "gradesnap-storage",
    }
  )
);
