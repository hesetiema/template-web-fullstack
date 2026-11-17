import { afterEach } from "vitest";
import { cleanup } from "@vue/test-utils";

// Unmount mounted components and clean up the DOM between tests.
afterEach(() => {
  cleanup();
});
