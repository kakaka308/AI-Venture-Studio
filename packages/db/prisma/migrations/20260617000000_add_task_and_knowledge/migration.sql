-- CreateTable: tasks（项目任务管理）
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" TIMESTAMP(3),
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: tasks 按项目查询
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex: tasks 按状态查询
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex: tasks 按优先级查询
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- AddForeignKey: tasks -> projects
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable: knowledge_entries（项目知识库）
CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: knowledge_entries 按项目查询
CREATE INDEX "knowledge_entries_projectId_idx" ON "knowledge_entries"("projectId");

-- CreateIndex: knowledge_entries 按分类查询
CREATE INDEX "knowledge_entries_category_idx" ON "knowledge_entries"("category");

-- 创建 GIN 全文搜索索引（支持 to_tsvector 快速匹配）
CREATE INDEX "knowledge_entries_fts_idx" ON "knowledge_entries" USING GIN (
    to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("content", ''))
);

-- AddForeignKey: knowledge_entries -> projects（可选关联，删除项目时置空）
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
