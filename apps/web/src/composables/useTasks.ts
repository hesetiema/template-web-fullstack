import { ref } from "vue";

export interface Task {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function useTasks() {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response;
  }

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const response = await request("/tasks");
      const body = (await response.json()) as { data: Task[] };
      tasks.value = body.data;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  async function create(title: string) {
    error.value = null;
    try {
      const response = await request("/tasks", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      const body = (await response.json()) as { data: Task };
      tasks.value.unshift(body.data);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unknown error";
    }
  }

  async function toggle(task: Task) {
    error.value = null;
    const previous = task.completed;
    task.completed = !previous;
    try {
      const response = await request(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: task.completed }),
      });
      const body = (await response.json()) as { data: Task };
      Object.assign(task, body.data);
    } catch (cause) {
      task.completed = previous;
      error.value = cause instanceof Error ? cause.message : "Unknown error";
    }
  }

  async function remove(id: number) {
    error.value = null;
    try {
      await request(`/tasks/${id}`, { method: "DELETE" });
      tasks.value = tasks.value.filter((task) => task.id !== id);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unknown error";
    }
  }

  return { tasks, loading, error, load, create, toggle, remove };
}
