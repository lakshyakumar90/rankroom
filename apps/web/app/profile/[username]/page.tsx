"use client";

import { use } from "react";
import { PublicProfileView } from "@/components/profile/public-profile-view";

export default function LegacyPublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  return <PublicProfileView username={username} />;
}
