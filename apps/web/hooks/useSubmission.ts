"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth";
import type { ApiResponse, SubmissionResult } from "@repo/types";
import { useProblemStore } from "@/stores/problemStore";

export function useSubmission(problemId: string, contestId?: string | null) {
  const { user } = useAuthStore();
  const {
    setSubmitting,
    setSubmissionResult,
    setActiveSubmissionId,
    activeSubmissionId,
  } = useProblemStore();
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit("user:join", { userId: user.id });

    const handleSubmission = (payload: SubmissionResult) => {
      if (!activeSubmissionId || payload.submissionId !== activeSubmissionId) return;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setSubmitting(false);
      setSubmissionResult(payload);
    };

    socket.on("submission:result", handleSubmission);
    return () => {
      socket.off("submission:result", handleSubmission);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeSubmissionId, setSubmissionResult, setSubmitting, user]);

  async function submitCode(source_code: string, language: string) {
    setSubmitting(true);
    setSubmissionResult(null);
    const response = contestId
      ? await api.post<ApiResponse<{ submissionId: string }>>(`/api/contests/${contestId}/submit`, {
          problemId,
          code: source_code,
          language,
        })
      : await api.post<ApiResponse<{ submissionId: string }>>(`/api/problems/${problemId}/submit`, {
          source_code,
          language,
        });

    const submissionId = response.data?.submissionId ?? null;
    setActiveSubmissionId(submissionId);

    if (!submissionId) {
      setSubmitting(false);
      return null;
    }

    pollTimeoutRef.current = setTimeout(() => {
      let attempts = 0;
      pollIntervalRef.current = setInterval(async () => {
        attempts += 1;
        if (attempts > 5) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setSubmitting(false);
          return;
        }

        const poll = await api.get<ApiResponse<SubmissionResult>>(`/api/submissions/${submissionId}`);
        if (poll.data && poll.data.verdict !== "PENDING" && poll.data.verdict !== "JUDGING") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setSubmitting(false);
          setSubmissionResult(poll.data);
        }
      }, 2000);
    }, 15000);

    return submissionId;
  }

  return { submitCode };
}
