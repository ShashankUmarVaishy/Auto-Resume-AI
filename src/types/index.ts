export interface MasterResumeProfile {
  personalInfo: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: {
      city: string;
      state: string;
      country: string;
      postalCode?: string;
      rawAddress?: string;
    };
    urls: {
      linkedin: string;
      github: string;
      portfolio: string;
      twitter?: string;
      other?: string[];
    };
    summaryStatement: string;
  };
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa: string;
    coursework: string[];
    honors: string[];
  }>;
  workExperience: Array<{
    id: string;
    company: string;
    role: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    responsibilities: string[];
    shortSummary: string;
    techStack: string[];
  }>;
  projects: Array<{
    id: string;
    name: string;
    role?: string;
    link?: string;
    githubLink?: string;
    techStack: string[];
    description: string;
    highlights: string[];
  }>;
  skills: {
    languages: string[];
    frameworks: string[];
    toolsAndPlatforms: string[];
    coreCompetencies: string[];
  };
  customSnippets: Array<{
    label: string;
    content: string;
  }>;
}

export interface DocumentFile {
  id: string;
  name: string;
  type: 'resume' | 'cover_letter' | 'other';
  content: string; // Raw text extracted
  size: number; // in bytes
  uploadedAt: string;
}

