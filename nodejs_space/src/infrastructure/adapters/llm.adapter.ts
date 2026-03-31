import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { IIntelligenceAdapter, ParsedVoiceTask } from '../../core/domain/interfaces/intelligence-adapter.interface';

@Injectable()
export class LlmAdapter implements IIntelligenceAdapter {
  private readonly logger = new Logger(LlmAdapter.name);
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL; // Optional support for Abacus.ai RouteLLM or others

    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY is missing. LLM features will use mock responses or fail.',
      );
      // Dummy initialization to prevent crash on startup if key is missing
      this.openai = new OpenAI({ apiKey: 'dummy', baseURL });
    } else {
      this.openai = new OpenAI({ apiKey, baseURL });
    }
  }

  private getModel(): string {
    return process.env.LLM_MODEL || 'gpt-4o-mini';
  }

  /**
   * Estimate time to complete a task in minutes
   */
  async estimateTaskTime(title: string, description?: string): Promise<number> {
    try {
      if (process.env.OPENAI_API_KEY === undefined) return 60; // Mock fallback

      const prompt = `Ты помощник по тайм-менеджменту. Оцени время выполнения задачи в минутах.
Верни ТОЛЬКО число (целое, в минутах). Без пояснений.

Задача: ${title}
Описание: ${description || 'не указано'}`;

      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in LLM response');
      }

      const minutes = parseInt(content.trim(), 10);

      if (isNaN(minutes) || minutes <= 0) {
        this.logger.warn(
          `Invalid time estimate: ${content}, using default 60 minutes`,
        );
        return 60;
      }

      this.logger.log(`Estimated ${minutes} minutes for task: ${title}`);
      return minutes;
    } catch (error: any) {
      this.logger.error(`Error estimating task time: ${error.message}`);
      return 60;
    }
  }

  /**
   * Generate morning planning message
   */
  async generateMorningPlan(
    todayTasks: Array<{
      title: string;
      estimatedMinutes: number;
      priority: number;
    }>,
    postponedTasks: Array<{ title: string; reason: string }>,
    totalMinutes: number,
    capacityMinutes: number,
  ): Promise<string> {
    try {
      if (process.env.OPENAI_API_KEY === undefined)
        return 'Доброе утро! Готовимся к продуктивному дню! 🚀';

      const prompt = `Ты AI-секретарь. Сформируй краткое утреннее сообщение с планом дня.

Задачи на сегодня (${totalMinutes} мин из ${capacityMinutes} мин):
${todayTasks.map((t) => `- ${t.title} (~${t.estimatedMinutes} мин, приоритет ${t.priority})`).join('\n')}

Перенесённые задачи:
${postponedTasks.map((t) => `- ${t.title}: ${t.reason}`).join('\n')}

Составь мотивирующее сообщение с эмодзи. Используй формат:
📋 План на сегодня
🔴/🟡/🟢 Задачи
📤 Перенесено

Не повторяй полностью список задач, сделай краткую выжимку.`;

      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      return (
        response.choices?.[0]?.message?.content ||
        'Доброе утро! Готовимся к продуктивному дню! 🚀'
      );
    } catch (error: any) {
      this.logger.error(`Error generating morning plan: ${error.message}`);
      return 'Доброе утро! Готовимся к продуктивному дню! 🚀';
    }
  }

  /**
   * Generate postpone reason for a task
   */
  async generatePostponeReason(
    taskTitle: string,
    priority: number,
    postponedCount: number,
    currentCapacity: number,
    totalLoad: number,
  ): Promise<string> {
    try {
      if (process.env.OPENAI_API_KEY === undefined)
        return 'недостаточно времени на сегодня';

      const prompt = `Ты AI-секретарь. Объясни кратко (1 фраза), почему задача переносится на завтра.

Задача: ${taskTitle}
Приоритет: ${priority}/5
Уже переносилась: ${postponedCount} раз
Емкость дня: ${currentCapacity} мин
Общая загрузка: ${totalLoad} мин

Верни краткую причину переноса (до 50 символов).`;

      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 50,
      });

      return (
        response.choices?.[0]?.message?.content?.trim() ||
        'недостаточно времени на сегодня'
      );
    } catch (error: any) {
      this.logger.error(`Error generating postpone reason: ${error.message}`);
      return 'недостаточно времени на сегодня';
    }
  }

  /**
   * Generate evening reminder message for incomplete task
   */
  async generateEveningReminder(
    taskTitle: string,
    postponedCount: number,
  ): Promise<string> {
    try {
      if (process.env.OPENAI_API_KEY === undefined)
        return `Не успели завершить "${taskTitle}"?`;

      const prompt = `Ты AI-секретарь. Напомни пользователю о незавершённой задаче в дружелюбном тоне.

Задача: ${taskTitle}
Переносилась: ${postponedCount} раз

Напиши короткое (1-2 предложения) напоминание с эмодзи.`;

      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 100,
      });

      return (
        response.choices?.[0]?.message?.content?.trim() ||
        `Не успели завершить "${taskTitle}"?`
      );
    } catch (error: any) {
      this.logger.error(`Error generating evening reminder: ${error.message}`);
      return `Не успели завершить "${taskTitle}"?`;
    }
  }

  /**
   * Generate suggestion for frequently postponed task
   */
  async generatePostponedTaskSuggestion(
    taskTitle: string,
    postponedCount: number,
  ): Promise<string> {
    try {
      if (process.env.OPENAI_API_KEY === undefined)
        return `Эта задача переносится уже ${postponedCount} раз. Может, стоит разбить её на более мелкие шаги или закрыть?`;

      const prompt = `Ты AI-секретарь. Задача переносится уже ${postponedCount} раз.

Задача: ${taskTitle}

Предложи что делать: разбить на подзадачи или закрыть как неактуальную. Ответ должен быть кратким (2-3 предложения) и мотивирующим.`;

      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 150,
      });

      return (
        response.choices?.[0]?.message?.content?.trim() ||
        `Эта задача переносится уже ${postponedCount} раз. Может, стоит разбить её на более мелкие шаги или закрыть?`
      );
    } catch (error: any) {
      this.logger.error(
        `Error generating postponed task suggestion: ${error.message}`,
      );
      return `Эта задача переносится уже ${postponedCount} раз. Может, стоит разбить её на более мелкие шаги или закрыть?`;
    }
  }

  /**
   * Parse transcribed voice message into a structured task
   */
  async parseVoiceTask(transcript: string): Promise<ParsedVoiceTask | null> {
    try {
      if (process.env.OPENAI_API_KEY === undefined) return null;

      const today = new Date().toISOString().split('T')[0];

      const prompt = `Ты AI-секретарь. Пользователь надиктовал голосовое сообщение. Извлеки из него задачу.

Сегодняшняя дата: ${today}

Текст: "${transcript}"

Верни JSON (и ТОЛЬКО JSON, без markdown):
{
  "title": "краткое название задачи (до 60 символов)",
  "due_date": "YYYY-MM-DD или null если дата не указана (тогда будет сегодня)",
  "priority": число от 0 до 5 (0=нет, 1=низкий, 3=средний, 5=высокий). Определи по контексту: срочно/важно = 5, обычная задача = 1, если не ясно = 0,
  "description": "дополнительные детали из сообщения или null"
}

Если в тексте НЕТ задачи (просто болтовня, вопрос, приветствие) — верни null.`;

      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const content = response.choices?.[0]?.message?.content?.trim();
      if (!content || content === 'null') return null;

      const parsed = JSON.parse(content);
      if (!parsed || !parsed.title) return null;

      return {
        title: parsed.title,
        due_date: parsed.due_date || null,
        priority: typeof parsed.priority === 'number' ? parsed.priority : 0,
        description: parsed.description || null,
      };
    } catch (error: any) {
      this.logger.error(`Error parsing voice task: ${error.message}`);
      return null;
    }
  }
}
