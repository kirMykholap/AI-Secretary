import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey = process.env.ABACUSAI_API_KEY;
  private readonly apiUrl = 'https://apps.abacus.ai/v1/chat/completions';

  /**
   * Estimate time to complete a task in minutes
   */
  async estimateTaskTime(title: string, description?: string): Promise<number> {
    try {
      const prompt = `Ты помощник по тайм-менеджменту. Оцени время выполнения задачи в минутах.
Верни ТОЛЬКО число (целое, в минутах). Без пояснений.

Задача: ${title}
Описание: ${description || 'не указано'}`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in LLM response');
      }

      // Parse number from response
      const minutes = parseInt(content.trim(), 10);

      if (isNaN(minutes) || minutes <= 0) {
        this.logger.warn(`Invalid time estimate: ${content}, using default 60 minutes`);
        return 60; // Default fallback
      }

      this.logger.log(`Estimated ${minutes} minutes for task: ${title}`);
      return minutes;
    } catch (error) {
      this.logger.error(`Error estimating task time: ${error.message}`);
      return 60; // Default fallback on error
    }
  }

  /**
   * Generate morning planning message
   */
  async generateMorningPlan(
    todayTasks: Array<{ title: string; estimatedMinutes: number; priority: number }>,
    postponedTasks: Array<{ title: string; reason: string }>,
    totalMinutes: number,
    capacityMinutes: number,
  ): Promise<string> {
    try {
      const prompt = `Ты AI-секретарь. Сформируй краткое утреннее сообщение с планом дня.

Задачи на сегодня (${totalMinutes} мин из ${capacityMinutes} мин):
${todayTasks.map(t => `- ${t.title} (~${t.estimatedMinutes} мин, приоритет ${t.priority})`).join('\n')}

Перенесённые задачи:
${postponedTasks.map(t => `- ${t.title}: ${t.reason}`).join('\n')}

Составь мотивирующее сообщение с эмодзи. Используй формат:
📋 План на сегодня
🔴/🟡/🟢 Задачи
📤 Перенесено

Не повторяй полностью список задач, сделай краткую выжимку.`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Доброе утро! Готовимся к продуктивному дню! 🚀';
    } catch (error) {
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
      const prompt = `Ты AI-секретарь. Объясни кратко (1 фраза), почему задача переносится на завтра.

Задача: ${taskTitle}
Приоритет: ${priority}/5
Уже переносилась: ${postponedCount} раз
Емкость дня: ${currentCapacity} мин
Общая загрузка: ${totalLoad} мин

Верни краткую причину переноса (до 50 символов).`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.7,
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || 'недостаточно времени на сегодня';
    } catch (error) {
      this.logger.error(`Error generating postpone reason: ${error.message}`);
      return 'недостаточно времени на сегодня';
    }
  }

  /**
   * Generate evening reminder message for incomplete task
   */
  async generateEveningReminder(taskTitle: string, postponedCount: number): Promise<string> {
    try {
      const prompt = `Ты AI-секретарь. Напомни пользователю о незавершённой задаче в дружелюбном тоне.

Задача: ${taskTitle}
Переносилась: ${postponedCount} раз

Напиши короткое (1-2 предложения) напоминание с эмодзи.`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.8,
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || `Не успели завершить "${taskTitle}"?`;
    } catch (error) {
      this.logger.error(`Error generating evening reminder: ${error.message}`);
      return `Не успели завершить "${taskTitle}"?`;
    }
  }

  /**
   * Generate suggestion for frequently postponed task
   */
  async generatePostponedTaskSuggestion(taskTitle: string, postponedCount: number): Promise<string> {
    try {
      const prompt = `Ты AI-секретарь. Задача переносится уже ${postponedCount} раз.

Задача: ${taskTitle}

Предложи что делать: разбить на подзадачи или закрыть как неактуальную. Ответ должен быть кратким (2-3 предложения) и мотивирующим.`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || 
        `Эта задача переносится уже ${postponedCount} раз. Может, стоит разбить её на более мелкие шаги или закрыть?`;
    } catch (error) {
      this.logger.error(`Error generating postponed task suggestion: ${error.message}`);
      return `Эта задача переносится уже ${postponedCount} раз. Может, стоит разбить её на более мелкие шаги или закрыть?`;
    }
  }
}
