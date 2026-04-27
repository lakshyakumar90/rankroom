import { Role } from "@repo/types";

type RouteRule = {
  prefix: string;
  type: "auth" | "protected";
  roles?: Role[];
};

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/login", type: "auth" },
  { prefix: "/register", type: "auth" },
  { prefix: "/forgot-password", type: "auth" },
  {
    prefix: "/admin",
    type: "protected",
    roles: [Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    prefix: "/department/hackathons",
    type: "protected",
    roles: [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.DEPARTMENT_HEAD,
      Role.CLASS_COORDINATOR,
      Role.TEACHER,
    ],
  },
  {
    prefix: "/attendance/mark",
    type: "protected",
    roles: [Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  },
  {
    prefix: "/attendance/take",
    type: "protected",
    roles: [Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  },
  {
    prefix: "/contests/create",
    type: "protected",
    roles: [Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  },
  {
    prefix: "/department",
    type: "protected",
    roles: [Role.DEPARTMENT_HEAD],
  },
  { prefix: "/dashboard", type: "protected" },
  { prefix: "/attendance", type: "protected" },
  { prefix: "/grades", type: "protected" },
  { prefix: "/assignments", type: "protected" },
  { prefix: "/problems", type: "protected" },
  { prefix: "/contests", type: "protected" },
  { prefix: "/leaderboard", type: "protected" },
  { prefix: "/analytics", type: "protected" },
  { prefix: "/settings", type: "protected" },
  { prefix: "/notifications", type: "protected" },
  { prefix: "/hackathons", type: "protected" },
  { prefix: "/profile/edit", type: "protected" },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getRouteRule(pathname: string) {
  return ROUTE_RULES.find((rule) => matchesPrefix(pathname, rule.prefix)) ?? null;
}

export function isProtectedRoute(pathname: string) {
  return getRouteRule(pathname)?.type === "protected";
}

export function isAuthRoute(pathname: string) {
  return getRouteRule(pathname)?.type === "auth";
}

export function isElevatedRole(role: Role | null | undefined) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function getDefaultRouteForRole(role: Role | null | undefined) {
  if (role === Role.DEPARTMENT_HEAD) {
    return "/department/overview";
  }

  return "/dashboard";
}

export function canAccessRoute(pathname: string, role: Role | null | undefined) {
  const rule = getRouteRule(pathname);

  if (!rule || rule.type !== "protected") {
    return true;
  }

  if (!role) {
    return false;
  }

  if (isElevatedRole(role)) {
    return true;
  }

  if (!rule.roles || rule.roles.length === 0) {
    return true;
  }

  return rule.roles.includes(role);
}

export function normalizeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export function buildLoginRedirect(pathname: string, search = "") {
  // Strip any existing redirectedFrom params to prevent nesting
  const searchParams = new URLSearchParams(search);
  searchParams.delete("redirectedFrom");
  
  const cleanSearch = searchParams.toString();
  const fullPath = cleanSearch ? `${pathname}?${cleanSearch}` : pathname;
  
  return `/login?redirectedFrom=${encodeURIComponent(
    normalizeInternalPath(fullPath)
  )}`;
}

export function buildForbiddenRedirect(
  role: Role | null | undefined,
  deniedFrom: string
) {
  // Parse the deniedFrom URL to strip any existing deniedFrom param
  const [path, search] = deniedFrom.split("?");
  const searchParams = new URLSearchParams(search);
  searchParams.delete("deniedFrom");
  
  const cleanPath = searchParams.toString() ? `${path}?${searchParams.toString()}` : path;
  const defaultRoute = getDefaultRouteForRole(role);
  
  // Prevent redirect loops: don't redirect to the same page they're trying to access
  if (cleanPath === defaultRoute || path === defaultRoute) {
    return defaultRoute;
  }
  
  const params = new URLSearchParams({
    deniedFrom: normalizeInternalPath(cleanPath),
  });

  return `${defaultRoute}?${params.toString()}`;
}

export function getRoleFromMetadata(value: unknown) {
  return Object.values(Role).includes(value as Role) ? (value as Role) : null;
}
