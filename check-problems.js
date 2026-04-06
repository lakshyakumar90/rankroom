import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      difficulty: true,
      tags: true,
      points: true,
      starterCode: true,
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Found ${problems.length} problems:\n`);
  problems.forEach((p, index) => {
    console.log(`${index + 1}. ${p.title} (${p.slug})`);
    console.log(`   Difficulty: ${p.difficulty} | Points: ${p.points}`);
    console.log(`   Tags: ${p.tags.join(', ')}`);
    console.log(`   Languages: ${Object.keys(p.starterCode || {}).join(', ')}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
