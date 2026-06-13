-- CreateTable: project_memories（项目长期记忆）
CREATE TABLE "project_memories" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "portrait" JSONB NOT NULL DEFAULT '{"industry":"","targetUsers":"","businessModel":"","keyInsights":[],"summary":""}',
    "lastExtractedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: projectId 唯一
CREATE UNIQUE INDEX "project_memories_projectId_key" ON "project_memories"("projectId");

-- AddForeignKey: project_memories -> projects
ALTER TABLE "project_memories" ADD CONSTRAINT "project_memories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
