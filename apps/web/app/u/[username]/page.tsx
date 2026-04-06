"use client";

import { use } from "react";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { ProfilePageHeader } from "@/components/profile/profile-page-header";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  return (
    <>
      <ProfilePageHeader username={username} />
      <PublicProfileView username={username} />
    </>
  );
}
