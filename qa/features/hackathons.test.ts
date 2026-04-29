import { dataOf, expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runHackathonTests(ctx: TestContext, results: TestResult[]) {
  const created = await request("/api/hackathons", {
    method: "POST",
    token: ctx.tokens.ADMIN,
    body: JSON.stringify({
      title: `QA Hackathon ${ctx.now}`,
      description: "Feature-suite hackathon registration and team flow check.",
      departmentId: ctx.engineering.id,
      minSkills: [],
      minProjects: 0,
      minLeetcode: 0,
      minCgpa: null,
      startDate: new Date(ctx.now + 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(ctx.now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      registrationDeadline: new Date(ctx.now + 24 * 60 * 60 * 1000).toISOString(),
      maxTeamSize: 3,
      minTeamSize: 1,
      status: "REGISTRATION_OPEN",
    }),
  });
  expectStatus(results, "hackathon create", created.status, [200, 201], created.body, created.durationMs);
  const hackathon = dataOf<{ id: string }>(created.body);
  if (!hackathon?.id) return;

  const registered = await request(`/api/hackathons/${hackathon.id}/register`, { method: "POST", token: ctx.tokens.STUDENT1 });
  expectStatus(results, "hackathon register", registered.status, [200, 201], registered.body, registered.durationMs);

  const team = await request(`/api/hackathons/${hackathon.id}/teams`, {
    method: "POST",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({ name: `QA Team ${ctx.now}`, memberUserIds: [ctx.users.student2.id] }),
  });
  expectStatus(results, "hackathon team create", team.status, 201, team.body, team.durationMs);
  const teamData = dataOf<{ id: string; members?: Array<{ studentId: string }> }>(team.body);
  if (!teamData?.id) return;
  const createdMemberIds = new Set(teamData.members?.map((member) => member.studentId) ?? []);
  results.push({
    status: createdMemberIds.has(ctx.users.student2.id) ? "PASS" : "FAIL",
    name: "hackathon team create includes requested members",
    note: createdMemberIds.has(ctx.users.student2.id)
      ? "Requested member was registered with the team"
      : `created team members=${JSON.stringify([...createdMemberIds])}`,
  });

  const invite = await request(`/api/hackathons/${hackathon.id}/teams/${teamData.id}/invites`, {
    method: "POST",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({ invitedId: ctx.users.student3.id }),
  });
  expectStatus(results, "hackathon team invite", invite.status, 201, invite.body, invite.durationMs);
  const inviteData = dataOf<{ id: string }>(invite.body);
  if (inviteData?.id) {
    const accept = await request(`/api/hackathons/${hackathon.id}/teams/invites/${inviteData.id}/accept`, {
      method: "POST",
      token: ctx.tokens.STUDENT3,
    });
    expectStatus(results, "hackathon team invite accept", accept.status, 200, accept.body, accept.durationMs);
  }
}
