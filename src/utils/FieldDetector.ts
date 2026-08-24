import type { MasterResumeProfile } from '../types';

export interface FieldMatch {
  fieldKey: string;     // e.g. 'personalInfo.email', 'projects', 'skills'
  label: string;        // Human-readable field label
  value: string;        // Suggested text value (or fallback string)
  type: 'text' | 'textarea' | 'select' | 'project_selector';
}

export class FieldDetector {
  /**
   * Evaluates an HTML input or textarea element and returns the best matching profile fields.
   */
  static detect(element: HTMLElement, profile: MasterResumeProfile | null): FieldMatch | null {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const id = (input.id || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const dataAutomationId = (input.getAttribute('data-automation-id') || '').toLowerCase();

    // Gather text elements surrounding the input (Tiers 2 & 3)
    const labelText = this.getAssociatedLabelText(input).toLowerCase();
    const isTextArea = input.tagName.toLowerCase() === 'textarea';

    // Combine all heuristic signals for token matching
    const searchString = `${id} ${name} ${placeholder} ${ariaLabel} ${dataAutomationId} ${labelText}`.trim();

    console.log("[AutoResume FieldDetector] Evaluating element:", {
      tag: input.tagName,
      id,
      name,
      placeholder,
      labelText,
      searchString
    });

    if (!profile) {
      console.log("[AutoResume FieldDetector] Profile is empty. Returning setup prompt fallback.");
      return {
        fieldKey: 'setup_prompt',
        label: 'Setup Profile',
        value: 'Your Master Resume Profile is empty. Please open the extension Options page, upload your resume, and configure your details.',
        type: 'text'
      };
    }

    const match = this.runRules(searchString, isTextArea, profile);
    if (match) {
      console.log("[AutoResume FieldDetector] MATCH FOUND:", match);
      return match;
    }

    console.log("[AutoResume FieldDetector] No heuristic match. Returning generic fallback.");
    return {
      fieldKey: 'generic',
      label: 'Autofill Field',
      value: '',
      type: isTextArea ? 'textarea' : 'text'
    };
  }

  private static runRules(searchString: string, isTextArea: boolean, profile: MasterResumeProfile): FieldMatch | null {
    // 1. PROJECT CAROUSEL DETECT (for textareas relating to projects, descriptions, or accomplishments)
    if (isTextArea && (
      searchString.includes('project') || 
      searchString.includes('describe') || 
      searchString.includes('accomplish') || 
      searchString.includes('bullet') || 
      searchString.includes('experience') || 
      searchString.includes('portfolio') ||
      searchString.includes('work')
    )) {
      return {
        fieldKey: 'projects',
        label: 'Select Project Description',
        value: '', // Let the carousel handle the values
        type: 'project_selector'
      };
    }

    // 2. TIER 1 & 2: MATCH PERSONAL DETAILS
    if (this.matchesKeywords(searchString, ['firstname', 'first name', 'fname', 'givenname'])) {
      const defaultFirstName = (profile.personalInfo?.fullName || '').split(' ')[0] || '';
      return {
        fieldKey: 'personalInfo.firstName',
        label: 'First Name',
        value: profile.personalInfo?.firstName || defaultFirstName,
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['lastname', 'last name', 'lname', 'surname', 'familyname'])) {
      const defaultLastName = (profile.personalInfo?.fullName || '').split(' ').slice(1).join(' ') || '';
      return {
        fieldKey: 'personalInfo.lastName',
        label: 'Last Name',
        value: profile.personalInfo?.lastName || defaultLastName,
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['fullname', 'full name', 'candidate name'])) {
      return {
        fieldKey: 'personalInfo.fullName',
        label: 'Full Name',
        value: profile.personalInfo?.fullName || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['email', 'e-mail', 'mailaddress'])) {
      return {
        fieldKey: 'personalInfo.email',
        label: 'Email Address',
        value: profile.personalInfo?.email || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['phone', 'telephone', 'mobile', 'cell'])) {
      return {
        fieldKey: 'personalInfo.phone',
        label: 'Phone Number',
        value: profile.personalInfo?.phone || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['linkedin'])) {
      return {
        fieldKey: 'personalInfo.urls.linkedin',
        label: 'LinkedIn Profile',
        value: profile.personalInfo?.urls?.linkedin || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['github'])) {
      return {
        fieldKey: 'personalInfo.urls.github',
        label: 'GitHub URL',
        value: profile.personalInfo?.urls?.github || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['portfolio', 'website', 'personal site', 'homepage'])) {
      return {
        fieldKey: 'personalInfo.urls.portfolio',
        label: 'Portfolio Link',
        value: profile.personalInfo?.urls?.portfolio || '',
        type: 'text'
      };
    }

    // 3. ADDRESS MATCHES
    if (this.matchesKeywords(searchString, ['city', 'location_city'])) {
      return {
        fieldKey: 'personalInfo.location.city',
        label: 'City',
        value: profile.personalInfo?.location?.city || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['state', 'province', 'region'])) {
      return {
        fieldKey: 'personalInfo.location.state',
        label: 'State / Province',
        value: profile.personalInfo?.location?.state || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['country', 'nation'])) {
      return {
        fieldKey: 'personalInfo.location.country',
        label: 'Country',
        value: profile.personalInfo?.location?.country || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['zip', 'postal', 'postcode'])) {
      return {
        fieldKey: 'personalInfo.location.postalCode',
        label: 'Postal Code',
        value: profile.personalInfo?.location?.postalCode || '',
        type: 'text'
      };
    }

    if (this.matchesKeywords(searchString, ['address', 'street', 'addressline'])) {
      const loc = profile.personalInfo?.location;
      const computedAddress = loc ? `${loc.city || ''}, ${loc.state || ''}, ${loc.country || ''}` : '';
      return {
        fieldKey: 'personalInfo.location.rawAddress',
        label: 'Street Address',
        value: loc?.rawAddress || computedAddress,
        type: 'text'
      };
    }

    // 4. EDUCATION MATCHES (Latest)
    if (profile.education && profile.education.length > 0) {
      const edu = profile.education[0];
      if (edu) {
        if (this.matchesKeywords(searchString, ['school', 'university', 'college', 'institution'])) {
          return {
            fieldKey: 'education.institution',
            label: 'Institution',
            value: edu.institution || '',
            type: 'text'
          };
        }
        if (this.matchesKeywords(searchString, ['degree', 'qualification'])) {
          return {
            fieldKey: 'education.degree',
            label: 'Degree',
            value: edu.degree || '',
            type: 'text'
          };
        }
        if (this.matchesKeywords(searchString, ['major', 'fieldofstudy', 'discipline', 'subject'])) {
          return {
            fieldKey: 'education.fieldOfStudy',
            label: 'Field of Study',
            value: edu.fieldOfStudy || '',
            type: 'text'
          };
        }
        if (this.matchesKeywords(searchString, ['gpa', 'grades', 'cumulative gpa'])) {
          return {
            fieldKey: 'education.gpa',
            label: 'GPA',
            value: edu.gpa || '',
            type: 'text'
          };
        }
      }
    }

    // 5. WORK EXPERIENCE MATCHES (Latest Role Details)
    if (profile.workExperience && profile.workExperience.length > 0) {
      const work = profile.workExperience[0];
      if (work) {
        if (this.matchesKeywords(searchString, ['company', 'employer'])) {
          return {
            fieldKey: 'workExperience.company',
            label: 'Company',
            value: work.company || '',
            type: 'text'
          };
        }
        if (this.matchesKeywords(searchString, ['jobtitle', 'job title', 'role', 'position'])) {
          return {
            fieldKey: 'workExperience.role',
            label: 'Job Title',
            value: work.role || '',
            type: 'text'
          };
        }
      }
    }

    // 6. SKILLS
    if (this.matchesKeywords(searchString, ['skills', 'technologies', 'corecompetencies'])) {
      const languages = profile.skills?.languages || [];
      const frameworks = profile.skills?.frameworks || [];
      const tools = profile.skills?.toolsAndPlatforms || [];
      const allSkills = [...languages, ...frameworks, ...tools].join(', ');
      
      return {
        fieldKey: 'skills',
        label: 'Skills',
        value: allSkills,
        type: isTextArea ? 'textarea' : 'text'
      };
    }

    // 7. CUSTOM QA SNIPPETS (Tier 4 Fallback)
    if (profile.customSnippets) {
      for (const snip of profile.customSnippets) {
        const token = snip.label.toLowerCase();
        if (searchString.includes(token)) {
          return {
            fieldKey: `customSnippets.${snip.label}`,
            label: `QA: ${snip.label}`,
            value: snip.content || '',
            type: (snip.content || '').length > 100 ? 'textarea' : 'text'
          };
        }
      }
    }

    return null;
  }

  private static matchesKeywords(search: string, keywords: string[]): boolean {
    return keywords.some(kw => search.includes(kw));
  }

  /**
   * Tier 2 Helper: Traverse DOM to extract label text corresponding to target input.
   */
  private static getAssociatedLabelText(input: HTMLInputElement | HTMLTextAreaElement): string {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }

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

    return '';
  }
}
