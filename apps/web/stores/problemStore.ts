"use client";

import { create } from "zustand";
import type { SubmissionResult, TestResult } from "@repo/types";

interface ProblemStore {
  code: Record<string, string>;
  language: string;
  fontSize: number;
  isRunning: boolean;
  isSubmitting: boolean;
  runResults: TestResult[] | null;
  submissionResult: SubmissionResult | null;
  activeSubmissionId: string | null;
  activeLeftTab: "description" | "solutions" | "submissions" | "hints";
  activeBottomTab: "testcase" | "result";
  activeTestCase: number;
  setCode: (problemId: string, language: string, code: string) => void;
  setLanguage: (language: string) => void;
  setFontSize: (fontSize: number) => void;
  setRunResults: (results: TestResult[] | null) => void;
  setSubmissionResult: (result: SubmissionResult | null) => void;
  setRunning: (isRunning: boolean) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setActiveLeftTab: (tab: ProblemStore["activeLeftTab"]) => void;
  setActiveBottomTab: (tab: ProblemStore["activeBottomTab"]) => void;
  setActiveTestCase: (index: number) => void;
  setActiveSubmissionId: (submissionId: string | null) => void;
  resetCode: (problemId: string, defaultCode: string) => void;
}

export const useProblemStore = create<ProblemStore>((set) => ({
  code: {},
  language: "python",
  fontSize: 14,
  isRunning: false,
  isSubmitting: false,
  runResults: null,
  submissionResult: null,
  activeSubmissionId: null,
  activeLeftTab: "description",
  activeBottomTab: "testcase",
  activeTestCase: 0,
  setCode: (problemId, language, code) =>
    set((state) => ({
      code: { ...state.code, [`${problemId}:${language}`]: code },
    })),
  setLanguage: (language) => set({ language }),
  setFontSize: (fontSize) => set({ fontSize }),
  setRunResults: (runResults) => set({ runResults }),
  setSubmissionResult: (submissionResult) => set({ submissionResult }),
  setRunning: (isRunning) => set({ isRunning }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setActiveLeftTab: (activeLeftTab) => set({ activeLeftTab }),
  setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
  setActiveTestCase: (activeTestCase) => set({ activeTestCase }),
  setActiveSubmissionId: (activeSubmissionId) => set({ activeSubmissionId }),
  resetCode: (problemId, defaultCode) =>
    set((state) => ({
      code: { ...state.code, [`${problemId}:${state.language}`]: defaultCode },
    })),
}));
