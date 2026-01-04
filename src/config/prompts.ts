import type { PromptTemplate } from '../types';

export const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'summary',
    name: 'Summary',
    isBuiltIn: true,
    isDefault: true,
    template: `Analyze the transcript of the YouTube video "{video_title}" ({video_url}):

---
{transcript}
---

Tasks (respond in {output_language}):
1. Brief summary (2-3 sentences)
2. Key points (bullet points)
3. Main conclusions and recommendations
4. Timestamps of important moments (if available)`
  },
  {
    id: 'key-points',
    name: 'Key Points',
    isBuiltIn: true,
    template: `Extract key points from the video "{video_title}":

{transcript}

Present in {output_language}:
- Main points (maximum 10)
- Important quotes
- Actionable takeaways`
  },
  {
    id: 'qa',
    name: 'Q&A Mode',
    isBuiltIn: true,
    template: `You are an expert on the content of the video "{video_title}".

Transcript:
{transcript}

Now I will ask questions about the content of this video. Answer based on the information from the transcript. Respond in {output_language}.`
  },
  {
    id: 'translate',
    name: 'Translate',
    isBuiltIn: true,
    template: `Translate the transcript of the video "{video_title}" to {output_language}, preserving the meaning and style of the original:

{transcript}`
  },
  {
    id: 'notes',
    name: 'Study Notes',
    isBuiltIn: true,
    template: `Create structured study notes for the video "{video_title}" ({video_url}):

{transcript}

Format the notes in {output_language}:
## Main Topic
## Key Concepts
## Examples and Cases
## Self-Check Questions
## Additional Resources (if mentioned)`
  }
];

export function fillPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
