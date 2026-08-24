/**
 * Safely updates input values on React/Vue/Angular controlled elements,
 * bypassing state validation traps by calling native setters and firing synthetic events.
 * Wraps descriptor overrides in try-catch to guarantee direct assignment fallback on failure.
 */
export function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  try {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  } catch (err) {
    console.warn('Native value descriptor override failed, falling back to direct assignment:', err);
    element.value = value;
  }

  // Dispatch standard events for framework validation handlers to pick up the change
  try {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  } catch (err) {
    console.warn('Failed to dispatch input/change validation events:', err);
  }
}
