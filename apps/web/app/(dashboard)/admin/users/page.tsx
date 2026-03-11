"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse } from "@repo/types";
import { Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface User { id: string; name: string; email: string; role: string; avatar?: string | null; createdAt: string; isVerified: boolean }

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      return api.get<ApiResponse<User[]>>(`/api/admin/users?${params}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const users = data?.data ?? [];

  const roleBadgeColor = (role: string) => {
    if (role === "ADMIN") return "bg-red-500/15 text-red-500";
    if (role === "TEACHER") return "bg-blue-500/15 text-blue-500";
    return "bg-zinc-500/15 text-zinc-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage all platform users</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add User</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["", "STUDENT", "TEACHER", "ADMIN"].map((r) => (
            <Button key={r} variant={roleFilter === r ? "default" : "outline"} size="sm" onClick={() => setRoleFilter(r)}>
              {r || "All"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Status</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-3 w-32" /></div></div></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-8 ml-auto" /></td>
                </tr>
              ))
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${roleBadgeColor(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant={u.isVerified ? "outline" : "secondary"} className="text-xs">{u.isVerified ? "Verified" : "Unverified"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
