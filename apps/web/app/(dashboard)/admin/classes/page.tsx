import { redirect } from "next/navigation";

// /admin/classes is deprecated — sections is the canonical page
export default function ClassesRedirectPage() {
  redirect("/admin/sections");
}
