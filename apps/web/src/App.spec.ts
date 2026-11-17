import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "./App.vue";

describe("App task board", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      }),
    );
  });

  it("renders the app title and empty state", async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find("h1").exists()).toBe(true);
    expect(wrapper.text()).toContain("No tasks yet");
  });

  it("adds a task through the API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 1, title: "Buy milk", completed: false, createdAt: new Date().toISOString() },
        }),
      } as Response);

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find("input[type=text]").setValue("Buy milk");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Buy milk");
  });
});
