import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import App from "./App.vue";

// Example test proving the Vue + Vitest + jsdom pipeline works.
describe("App", () => {
  it("renders the app title", () => {
    const wrapper = mount(App);
    expect(wrapper.find("h1").exists()).toBe(true);
  });
});
