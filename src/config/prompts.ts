import type { PromptTemplate } from '../types';

export const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'summary',
    name: 'Резюме',
    isBuiltIn: true,
    isDefault: true,
    template: `Проанализируй транскрипт YouTube видео "{video_title}" ({video_url}):

---
{transcript}
---

Задачи:
1. Краткое резюме (2-3 предложения)
2. Ключевые тезисы (bullet points)
3. Основные выводы и рекомендации
4. Временные метки важных моментов (если доступны)`
  },
  {
    id: 'key-points',
    name: 'Ключевые моменты',
    isBuiltIn: true,
    template: `Выдели ключевые моменты из видео "{video_title}":

{transcript}

Представь в виде:
- Главные тезисы (максимум 10)
- Важные цитаты
- Actionable takeaways`
  },
  {
    id: 'qa',
    name: 'Q&A режим',
    isBuiltIn: true,
    template: `Ты - эксперт по содержимому видео "{video_title}".

Транскрипт:
{transcript}

Теперь я буду задавать вопросы по содержимому этого видео. Отвечай на основе информации из транскрипта.`
  },
  {
    id: 'translate',
    name: 'Перевод',
    isBuiltIn: true,
    template: `Переведи транскрипт видео "{video_title}" на русский язык, сохраняя смысл и стиль оригинала:

{transcript}`
  },
  {
    id: 'notes',
    name: 'Конспект',
    isBuiltIn: true,
    template: `Создай структурированный конспект для обучения по видео "{video_title}" ({video_url}):

{transcript}

Формат конспекта:
## Основная тема
## Ключевые концепции
## Примеры и кейсы
## Вопросы для самопроверки
## Дополнительные ресурсы (если упоминаются)`
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
