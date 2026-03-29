import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.tasks.findMany({
    where: {
      title: { contains: 'Новый тест' }
    }
  });

  console.log(`Found ${tasks.length} tasks matching 'Новый тест'`);
  
  for (const task of tasks) {
    await prisma.tasks.delete({ where: { id: task.id }});
    console.log(`Deleted task ${task.id}: ${task.title}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  });
