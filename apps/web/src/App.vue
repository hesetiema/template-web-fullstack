<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useTasks } from "./composables/useTasks";

const title = __APP_TITLE__;
const { tasks, loading, error, load, create, toggle, remove } = useTasks();
const draft = ref("");

onMounted(load);

async function addTask() {
  const value = draft.value.trim();
  if (!value) return;
  await create(value);
  draft.value = "";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}
</script>

<template>
  <main class="board">
    <header class="board__header">
      <div>
        <h1>{{ title }}</h1>
        <p class="board__subtitle">A real full-stack task board — every change is persisted in PostgreSQL.</p>
      </div>
      <span class="board__count">{{ tasks.filter((t) => !t.completed).length }} open</span>
    </header>

    <form class="board__form" @submit.prevent="addTask">
      <input
        v-model="draft"
        type="text"
        maxlength="200"
        placeholder="What needs to be done?"
        aria-label="New task title"
      />
      <button type="submit" :disabled="!draft.trim()">Add task</button>
    </form>

    <p v-if="error" class="board__error" role="alert">{{ error }}</p>
    <p v-if="loading && !tasks.length" class="board__hint">Loading tasks…</p>
    <p v-else-if="!tasks.length" class="board__hint">No tasks yet. Add your first one above.</p>

    <ul v-else class="board__list">
      <li v-for="task in tasks" :key="task.id" class="task" :class="{ 'task--done': task.completed }">
        <label class="task__label">
          <input type="checkbox" :checked="task.completed" @change="toggle(task)" />
          <span class="task__title">{{ task.title }}</span>
        </label>
        <span class="task__meta">{{ formatDate(task.createdAt) }}</span>
        <button class="task__delete" type="button" aria-label="Delete task" @click="remove(task.id)">Delete</button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.board {
  max-width: 720px;
  margin: 48px auto;
  padding: 0 20px;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}
.board__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.board__header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}
.board__subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}
.board__count {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 13px;
}
.board__form {
  display: flex;
  gap: 8px;
  margin: 24px 0 16px;
}
.board__form input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}
.board__form button,
.task__delete {
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.board__form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.board__error {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 14px;
}
.board__hint {
  padding: 32px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}
.board__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}
.task--done .task__title {
  text-decoration: line-through;
  color: #9ca3af;
}
.task__label {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  cursor: pointer;
}
.task__title {
  font-size: 15px;
}
.task__meta {
  color: #9ca3af;
  font-size: 12px;
  white-space: nowrap;
}
.task__delete {
  padding: 6px 12px;
  background: #f3f4f6;
  color: #dc2626;
  font-size: 12px;
}
</style>
