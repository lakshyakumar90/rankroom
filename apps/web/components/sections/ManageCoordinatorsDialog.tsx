"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, X } from "lucide-react";
import type { ApiResponse, Role } from "@repo/types";

interface Coordinator {
  id: string;
  user: { id: string; name: string; email: string };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function ManageCoordinatorsDialog({
  sectionId,
  sectionName,
}: {
  sectionId: string;
  sectionName: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const queryClient = useQueryClient();

  const { data: coordData } = useQuery({
    queryKey: ["section", sectionId, "coordinators"],
    queryFn: () => api.get<ApiResponse<Coordinator[]>>(`/api/sections/${sectionId}/coordinators`),
    enabled: open,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "class-coordinators"],
    queryFn: () => api.get<ApiResponse<UserOption[]>>("/api/admin/users?role=CLASS_COORDINATOR&limit=100"),
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: () => api.post(`/api/sections/${sectionId}/coordinators`, { userId: selectedUserId }),
    onSuccess: () => {
      toast.success("Coordinator assigned");
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["section", sectionId, "coordinators"] });
      queryClient.invalidateQueries({ queryKey: ["section", sectionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/api/sections/${sectionId}/coordinators/${userId}`),
    onSuccess: () => {
      toast.success("Coordinator removed");
      queryClient.invalidateQueries({ queryKey: ["section", sectionId, "coordinators"] });
      queryClient.invalidateQueries({ queryKey: ["section", sectionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const coordinators = coordData?.data ?? [];
  const users = usersData?.data ?? [];
  const unassigned = users.filter((u) => !coordinators.some((c) => c.user.id === u.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="mr-2 size-4" />
          Manage coordinators
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coordinators — {sectionName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current coordinators */}
          {coordinators.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Current coordinators</p>
              <div className="flex flex-wrap gap-2">
                {coordinators.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                    {c.user.name}
                    <button
                      className="ml-1 rounded hover:text-destructive"
                      onClick={() => removeMutation.mutate(c.user.id)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No coordinators assigned.</p>
          )}

          {/* Add coordinator */}
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select coordinator to assign..." />
              </SelectTrigger>
              <SelectContent>
                {unassigned.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} — {u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={!selectedUserId || assignMutation.isPending}
            >
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
