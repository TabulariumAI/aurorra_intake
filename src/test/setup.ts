import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

HTMLElement.prototype.scrollIntoView = () => undefined;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
