/**
 * Safely updates input values on React/Vue/Angular controlled elements,
 * bypassing state validation traps by calling native setters and firing synthetic events.
 * Wraps descriptor overrides in try-catch to guarantee direct assignment fallback on failure.
 */
export function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  console.log("[AutoResume Injector] setNativeValue invoked:", {
    elementId: element.id,
    elementName: element.name,
    tag: element.tagName,
    valueToFill: value,
    valueLength: (value || '').length
  });

  try {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      console.log("[AutoResume Injector] Applying prototype setter override.");
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      console.log("[AutoResume Injector] Applying local instance setter override.");
      valueSetter.call(element, value);
    } else {
      console.log("[AutoResume Injector] Applying direct value assignment.");
      element.value = value;
    }
  } catch (err) {
    console.warn('[AutoResume Injector] Native value descriptor override failed, falling back to direct assignment:', err);
    element.value = value;
  }

  // Dispatch standard events for framework validation handlers to pick up the change
  try {
    console.log("[AutoResume Injector] Dispatching synthetic input, change, and blur events.");
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  } catch (err) {
    console.warn('[AutoResume Injector] Failed to dispatch input/change validation events:', err);
  }
}
