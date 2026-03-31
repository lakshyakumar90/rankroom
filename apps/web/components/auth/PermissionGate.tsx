"use client";

import type { ReactNode } from "react";
import type { PermissionKey } from "@repo/types";
import { useAuthStore } from "@/store/auth";
import { hasPermission } from "@/lib/permissions";

export function PermissionGate({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}) {
  const role = useAuthStore((state) => state.user?.role);

  if (!hasPermission(role, permission)) {
    return null;
  }

  return <>{children}</>;
}
