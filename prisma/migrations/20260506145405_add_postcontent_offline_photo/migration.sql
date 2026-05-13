-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'OFFLINE';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "postContent" TEXT;
