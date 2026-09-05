import { vi } from "vitest";

/**
 * Radix Select relies on pointer-capture APIs jsdom does not implement, so any test that opens a
 * Select needs these installed first. Import for the side effect:
 *
 *   import "@/test/pointer-events";
 *
 * Kept separate from `@/test/render` on purpose — that helper is shared by every component test, and
 * this is only needed by the few that drive a Select.
 */
class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(
    type: string,
    props: PointerEventInit & { pointerType?: string } = {}
  ) {
    super(type, props);
    this.button = props.button ?? 0;
    this.ctrlKey = props.ctrlKey ?? false;
    this.pointerType = props.pointerType ?? "mouse";
  }
}

window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
