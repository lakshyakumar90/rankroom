import { redirect } from "next/navigation";

export default async function ContestProblemPage({
  params,
}: {
  params: Promise<{ id: string; problemId: string }>;
}) {
  const { id, problemId } = await params;
  redirect(`/problems/${problemId}?contestId=${id}`);
}
