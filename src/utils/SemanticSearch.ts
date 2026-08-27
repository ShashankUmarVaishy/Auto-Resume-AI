import { getSemanticScore } from './vectorMath';

export interface FieldMatch {
  fieldKey: string;     // e.g. 'personalInfo.email'
  label: string;        // Human-readable field label
  value: string;        // Suggested text value
  type: 'text' | 'textarea' | 'select' | 'project_selector' | 'experience_selector';
}

// Resolve value from profile by dotted path string
export function getProfileValueByKey(profile: any, path: string): string {
  if (!profile || !path) return '';
  const parts = path.split('.');
  let current = profile;
  for (const part of parts) {
    if (!current) return '';
    const idx = parseInt(part, 10);
    if (!isNaN(idx) && Array.isArray(current)) {
      current = current[idx];
    } else {
      current = current[part];
    }
  }
  if (Array.isArray(current)) {
    return current.join(', ');
  }
  return typeof current === 'string' ? current : (current?.toString() || '');
}

/**
 * Local offline semantic search based on Jaro-Winkler + Token similarity mapping.
 * Evaluates target labels and returns the top 3 best matching suggestions.
 */
export function runSemanticSearch(
  labelText: string, 
  profile: any, 
  learnedMappings: Record<string, string> = {}
): Array<{ fieldKey: string; score: number }> {
  if (!labelText || !profile) return [];
  
  const cleanLabel = labelText.toLowerCase().trim();
  
  const candidates: Array<{ fieldKey: string; synonyms: string[] }> = [
    { fieldKey: 'personalInfo.firstName', synonyms: ['first name', 'given name', 'fname', 'first_name'] },
    { fieldKey: 'personalInfo.lastName', synonyms: ['last name', 'family name', 'last_name', 'lname'] },
    { fieldKey: 'personalInfo.fullName', synonyms: ['full name', 'name', 'full_name', 'candidate', 'applicant', 'your name'] },
    { fieldKey: 'personalInfo.email', synonyms: ['email', 'e-mail', 'mail', 'email_address', 'electronic mail', 'contact email'] },
    { fieldKey: 'personalInfo.phone', synonyms: ['phone', 'telephone', 'mobile', 'cell', 'phone_number', 'contact number', 'cellular', 'cellular contact number'] },
    { fieldKey: 'personalInfo.summaryStatement', synonyms: ['summary', 'bio', 'background', 'objective', 'overview', 'about me'] },
    { fieldKey: 'personalInfo.urls.linkedin', synonyms: ['linkedin', 'linkedin profile', 'linkedin url', 'url_linkedin', 'url linkedin'] },
    { fieldKey: 'personalInfo.urls.github', synonyms: ['github', 'github profile', 'github url', 'git', 'github link', 'url github'] },
    { fieldKey: 'personalInfo.urls.portfolio', synonyms: ['portfolio', 'website', 'personal site', 'url_portfolio', 'web page', 'personal website', 'portfolio url'] },
    
    { fieldKey: 'skills.languages', synonyms: ['languages', 'languages spoken', 'programming languages', 'coding languages'] },
    { fieldKey: 'skills.frameworks', synonyms: ['frameworks', 'libraries', 'technologies', 'tech stack'] },
    { fieldKey: 'skills.toolsAndPlatforms', synonyms: ['tools', 'platforms', 'databases', 'software', 'environment'] },
    { fieldKey: 'skills.coreCompetencies', synonyms: ['skills', 'core competencies', 'capabilities', 'expertise', 'competencies'] }
  ];

  // Dynamic Custom QA snippets - map directly to CONTENT string paths (resolves [object Object] bug)
  if (profile.customSnippets) {
    profile.customSnippets.forEach((snip: any, idx: number) => {
      candidates.push({ 
        fieldKey: `customSnippets.${idx}.content`, 
        synonyms: [snip.label, `${snip.label} snippet`, `${snip.label} answer`, `${snip.label} QA`, 'question answer', snip.label.toLowerCase()] 
      });
    });
  }

  if (profile.education) {
    profile.education.forEach((edu: any, idx: number) => {
      candidates.push({ fieldKey: `education.${idx}.institution`, synonyms: [`school ${idx}`, `university ${idx}`, `college ${idx}`, 'institution', 'education history', 'university', 'school'] });
      candidates.push({ fieldKey: `education.${idx}.degree`, synonyms: [`degree ${idx}`, `qualification ${idx}`, `diploma ${idx}`, 'academic title', 'degree', 'qualification'] });
      candidates.push({ fieldKey: `education.${idx}.fieldOfStudy`, synonyms: [`field of study ${idx}`, `major ${idx}`, `study ${idx}`, 'specialization', 'subject', 'field of study'] });
      candidates.push({ fieldKey: `education.${idx}.gpa`, synonyms: [`gpa ${idx}`, `grade point average ${idx}`, 'marks', 'school result', 'gpa', 'grade'] });
    });
  }

  if (profile.workExperience) {
    profile.workExperience.forEach((work: any, idx: number) => {
      candidates.push({ fieldKey: `workExperience.${idx}.company`, synonyms: [`company ${idx}`, `employer ${idx}`, 'organization', 'company name', 'previous employer', 'employer'] });
      candidates.push({ fieldKey: `workExperience.${idx}.role`, synonyms: [`job title ${idx}`, `role ${idx}`, 'position', 'designation', 'job role', 'role'] });
      candidates.push({ fieldKey: `workExperience.${idx}.location`, synonyms: [`job location ${idx}`, 'company location', 'city', 'location'] });
      candidates.push({ fieldKey: `workExperience.${idx}.shortSummary`, synonyms: [`responsibilities ${idx}`, `duties ${idx}`, 'work description', 'job description', 'experience details', 'accomplishments', 'duties'] });
    });
  }

  if (profile.projects) {
    profile.projects.forEach((proj: any, idx: number) => {
      candidates.push({ fieldKey: `projects.${idx}.name`, synonyms: [`project name ${idx}`, `project title ${idx}`, 'project name', 'project title'] });
      candidates.push({ fieldKey: `projects.${idx}.description`, synonyms: [`project description ${idx}`, `project details ${idx}`, 'project accomplishments', 'project description', 'highlights'] });
    });
  }

  // Calculate similarity scores
  const scored = candidates.map(candidate => {
    // Exact mapping matches from user feedback learn settings
    if (learnedMappings && learnedMappings[cleanLabel] === candidate.fieldKey) {
      return { fieldKey: candidate.fieldKey, score: 1.0 };
    }
    const score = getSemanticScore(labelText, candidate.synonyms);
    return { fieldKey: candidate.fieldKey, score };
  });

  // Filter candidates above similarity index score threshold, sort descending
  const filtered = scored
    .filter(c => c.score > 0.50)
    .sort((a, b) => b.score - a.score);

  // Return top 3 unique suggestions
  const uniqueKeys = new Set<string>();
  const topMatches: Array<{ fieldKey: string; score: number }> = [];
  for (const c of filtered) {
    if (!uniqueKeys.has(c.fieldKey)) {
      uniqueKeys.add(c.fieldKey);
      topMatches.push(c);
      if (topMatches.length >= 3) break;
    }
  }

  return topMatches;
}
