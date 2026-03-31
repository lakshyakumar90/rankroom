"use client";

import { use } from "react";
import { PublicProfileView } from "@/components/profile/public-profile-view";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  return <PublicProfileView username={username} />;
}
