"use client";

import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApiResponse } from "@repo/types";

interface Subject {
  id: string;
  name: string;
  code: string;
  teacherAssignments: Array<{ teacher: { id: string; name: string } }>;
  resultConfig?: {
    maxMidTerm: number;
    maxEndTerm: number;
    maxAssignment: number;
    maxTC: number;
  } | null;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface EditSubjectDialogProps {
  subject: Subject;
  sectionId: string;
  open: boolean;
  onClose: () => void;
}

export function EditSubjectDialog({ subject, sectionId, open, onClose }: EditSubjectDialogProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: subject.name,
    code: subject.code,
    teacherId: subject.teacherAssignments[0]?.teacher.id ?? "",
    maxMidTerm: subject.resultConfig?.maxMidTerm ?? 25,
    maxEndTerm: subject.resultConfig?.maxEndTerm ?? 50,
    maxAssignment: subject.resultConfig?.maxAssignment ?? 15,
    maxTC: subject.resultConfig?.maxTC ?? 10,
  });

  const { data: teachersData } = useQuery({
    queryKey: ["section", sectionId, "teachers"],
    queryFn: () => api.get<ApiResponse<Teacher[]>>(`/api/sections/${sectionId}/teachers`),
    enabled: open,
  });

  const teachers = teachersData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/subjects/${subject.id}`, {
        name: form.name,
        code: form.code,
        teacherId: form.teacherId || null,
        resultConfig: {
          maxMidTerm: form.maxMidTerm,
          maxEndTerm: form.maxEndTerm,
          maxAssignment: form.maxAssignment,
          maxTC: form.maxTC,
        },
      }),
    onSuccess: () => {
      toast.success("Subject updated");
      queryClient.invalidateQueries({ queryKey: ["section", sectionId, "subjects"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalMax = form.maxMidTerm + form.maxEndTerm + form.maxAssignment + form.maxTC;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit subject</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Subject name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assigned teacher</Label>
            <Select
              value={form.teacherId}
              onValueChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select teacher..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Unassigned —</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Marks configuration</Label>
            <div className="grid gap-2 sm:grid-cols-4">
              {(["maxMidTerm", "maxEndTerm", "maxAssignment", "maxTC"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {field === "maxMidTerm" ? "Mid-term" : field === "maxEndTerm" ? "End-term" : field === "maxAssignment" ? "Assignment" : "TC"}
                  </p>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total max: <strong>{totalMax}</strong></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name || !form.code}
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
