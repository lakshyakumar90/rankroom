"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type UserPublic, type ProfilePublic } from "@repo/types";
import { formatPoints, formatDate } from "@/lib/utils";
import { Github, Trophy, Code2, BookOpen, ExternalLink } from "lucide-react";

interface UserProfile extends UserPublic {
  profile?: ProfilePublic | null;
  leaderboard?: {
    totalPoints: number;
    problemsSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    contestsParticipated: number;
    rank?: number | null;
  } | null;
}

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);

  // Try to find user by name (encoded)
  const { data, isLoading } = useQuery({
    queryKey: ["user-profile", username],
    queryFn: () =>
      api.get<ApiResponse<UserProfile[]>>(`/api/users/search?q=${encodeURIComponent(decodeURIComponent(username))}&limit=1`).then((res) => {
        if (res.data?.[0]) return api.get<ApiResponse<UserProfile>>(`/api/users/${res.data[0].id}/profile`);
        return Promise.resolve({ success: false, data: null } as ApiResponse<UserProfile | null>);
      }),
  });

  const user = data?.data as UserProfile | null;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center text-muted-foreground">
        <p>User not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <Avatar src={user.avatar} name={user.name} size="lg" className="h-20 w-20 text-xl" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                <Badge variant="outline" className="capitalize text-xs">{user.role.toLowerCase()}</Badge>
                {user.leaderboard?.rank && (
                  <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/20 text-xs">
                    <Trophy className="h-3 w-3 mr-1" />Rank #{user.leaderboard.rank}
                  </Badge>
                )}
              </div>
              {user.profile?.bio && (
                <p className="text-sm text-muted-foreground">{user.profile.bio}</p>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {user.githubUsername && (
                  <a href={`https://github.com/${user.githubUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Github className="h-4 w-4" />
                    {user.githubUsername}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span>Joined {formatDate(user.createdAt)}</span>
                {user.profile?.college && <span>{user.profile.college}</span>}
                {user.profile?.department && <span>{user.profile.department}</span>}
              </div>
              {user.profile?.skills && user.profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {user.profile.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {user.leaderboard && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-primary">{formatPoints(user.leaderboard.totalPoints)}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Points</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold">{user.leaderboard.problemsSolved}</p>
              <p className="text-sm text-muted-foreground mt-1">Problems Solved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold">{user.leaderboard.contestsParticipated}</p>
              <p className="text-sm text-muted-foreground mt-1">Contests</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Difficulty breakdown */}
      {user.leaderboard && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Problems by Difficulty</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {[
                { label: "Easy", value: user.leaderboard.easySolved, color: "text-emerald-500 bg-emerald-500/10" },
                { label: "Medium", value: user.leaderboard.mediumSolved, color: "text-amber-500 bg-amber-500/10" },
                { label: "Hard", value: user.leaderboard.hardSolved, color: "text-red-500 bg-red-500/10" },
              ].map((d) => (
                <div key={d.label} className={`flex-1 rounded-lg p-3 ${d.color.split(" ")[1]} text-center`}>
                  <p className={`text-2xl font-bold ${d.color.split(" ")[0]}`}>{d.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
