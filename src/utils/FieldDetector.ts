export interface FieldMatch {
  fieldKey: string;     // e.g. 'personalInfo.email'
  label: string;        // Human-readable field label
  value: string;        // Suggested text value
  type: 'text' | 'textarea' | 'select' | 'project_selector' | 'experience_selector';
}

export class FieldDetector {
  /**
   * Traverses the DOM to extract a descriptive label text for the target input.
   * Leverages ARIA attributes, linked labels, sibling proximity, placeholders, and name tokens.
   */
  public static getAssociatedLabelText(input: HTMLInputElement | HTMLTextAreaElement): string {
    // 1. Accessibility Check: aria-labelledby (Crucial for Google Forms & modern ATS)
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/);
      const labelText = ids
        .map(id => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean)
        .join(' ');
      if (labelText) return labelText.trim();
    }

    // 2. Accessibility Check: direct aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    // 3. ID-linked label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }

    // 4. Parent/Sibling DOM label traversal
    let parent = input.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === 'label') {
        return parent.textContent?.trim() || '';
      }
      const siblingLabel = parent.querySelector('label');
      if (siblingLabel && siblingLabel.textContent) {
        return siblingLabel.textContent.trim();
      }
      
      const headerSpan = parent.querySelector('.label, .control-label, .field-label');
      if (headerSpan && headerSpan.textContent) {
        return headerSpan.textContent.trim();
      }
      
      parent = parent.parentElement;
    }

    // 5. Attribute fallback: placeholder
    if (input.placeholder) {
      return input.placeholder.trim();
    }

    // 6. Attribute fallback: name (split tokens like first_name -> first name)
    if (input.name) {
      return input.name.replace(/[-_]/g, ' ').trim();
    }

    return '';
  }
}
