import type { MasterResumeProfile } from '../types';

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    personalInfo: {
      type: 'OBJECT',
      properties: {
        fullName: { type: 'STRING' },
        firstName: { type: 'STRING' },
        lastName: { type: 'STRING' },
        email: { type: 'STRING' },
        phone: { type: 'STRING' },
        location: {
          type: 'OBJECT',
          properties: {
            city: { type: 'STRING' },
            state: { type: 'STRING' },
            country: { type: 'STRING' },
            postalCode: { type: 'STRING' },
            rawAddress: { type: 'STRING' }
          },
          required: ['city', 'state', 'country']
        },
        urls: {
          type: 'OBJECT',
          properties: {
            linkedin: { type: 'STRING' },
            github: { type: 'STRING' },
            portfolio: { type: 'STRING' },
            twitter: { type: 'STRING' },
            other: { type: 'ARRAY', items: { type: 'STRING' } }
          },
          required: ['linkedin', 'github', 'portfolio']
        },
        summaryStatement: { type: 'STRING' }
      },
      required: ['fullName', 'firstName', 'lastName', 'email', 'phone', 'location', 'urls', 'summaryStatement']
    },
    education: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          institution: { type: 'STRING' },
          degree: { type: 'STRING' },
          fieldOfStudy: { type: 'STRING' },
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          gpa: { type: 'STRING' },
          coursework: { type: 'ARRAY', items: { type: 'STRING' } },
          honors: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['institution', 'degree', 'fieldOfStudy', 'startDate', 'endDate', 'gpa']
      }
    },
    workExperience: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          company: { type: 'STRING' },
          role: { type: 'STRING' },
          location: { type: 'STRING' },
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          isCurrent: { type: 'BOOLEAN' },
          responsibilities: { type: 'ARRAY', items: { type: 'STRING' } },
          shortSummary: { type: 'STRING' },
          techStack: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['id', 'company', 'role', 'location', 'startDate', 'endDate', 'isCurrent', 'responsibilities', 'shortSummary']
      }
    },
    projects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          name: { type: 'STRING' },
          role: { type: 'STRING' },
          link: { type: 'STRING' },
          githubLink: { type: 'STRING' },
          techStack: { type: 'ARRAY', items: { type: 'STRING' } },
          description: { type: 'STRING' },
          highlights: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['id', 'name', 'techStack', 'description', 'highlights']
      }
    },
    skills: {
      type: 'OBJECT',
      properties: {
        languages: { type: 'ARRAY', items: { type: 'STRING' } },
        frameworks: { type: 'ARRAY', items: { type: 'STRING' } },
        toolsAndPlatforms: { type: 'ARRAY', items: { type: 'STRING' } },
        coreCompetencies: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['languages', 'frameworks', 'toolsAndPlatforms', 'coreCompetencies']
    },
    customSnippets: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          content: { type: 'STRING' }
        },
        required: ['label', 'content']
      }
    }
  },
  required: ['personalInfo', 'education', 'workExperience', 'projects', 'skills', 'customSnippets']
};

/**
 * Invokes Gemini 1.5 Flash to extract structured resume details from raw text.
 */
export async function parseResumeWithAI(rawText: string, apiKey: string): Promise<MasterResumeProfile> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  
  const systemInstruction = 
    `You are an expert system that extracts structured resume data from unstructured text. 
    Analyze the text provided and map it into the requested JSON schema.
    If some properties are missing, make a best-effort inference or leave them empty.
    Generate a unique id string for projects and workExperience objects (e.g. 'work-1', 'proj-1').
    Output strictly conforming to the requested JSON layout.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `Resume raw text:\n${rawText}` }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemInstruction }
        ]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const jsonResult = await response.json();
  const rawJson = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawJson) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

  return JSON.parse(rawJson.trim()) as MasterResumeProfile;
}

/**
 * Invokes Gemini to expand or condense a description to fit a word limit.
 */
export async function tailorTextWithAI(
  originalText: string,
  limitWords: number,
  contextPrompt: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const systemInstruction = 
    `You are a professional CV editor.
    Your task is to rewrite, condense, or expand the user's project/work description to fit within a strict word limit of ${limitWords} words.
    Maintain professional formatting, use action verbs, and preserve technical stacks.
    Do not add meta-text, introductions, or pleasantries. Output only the rewritten content.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { 
              text: `Original description:\n"${originalText}"\n\nWord limit limit: ${limitWords} words.\nAdditional context/role: ${contextPrompt}` 
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemInstruction }
        ]
      },
      generationConfig: {
        maxOutputTokens: Math.max(limitWords * 2, 200),
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.statusText}`);
  }

  const jsonResult = await response.json();
  const resultText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
  return resultText ? resultText.trim() : originalText;
}
