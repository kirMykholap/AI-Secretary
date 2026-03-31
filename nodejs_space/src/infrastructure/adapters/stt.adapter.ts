import { Injectable, Logger } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { ISttAdapter } from '../../core/domain/interfaces/stt-adapter.interface';

@Injectable()
export class SttAdapter implements ISttAdapter {
  private readonly logger = new Logger(SttAdapter.name);
  private groq: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is missing. Voice messages will not be transcribed.');
    } else {
      this.groq = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
  }

  async transcribe(fileBuffer: Buffer, filename: string): Promise<string | null> {
    if (!this.groq) {
      this.logger.warn('STT not available: GROQ_API_KEY not configured');
      return null;
    }

    try {
      const file = await toFile(new Uint8Array(fileBuffer), filename, { type: 'audio/ogg' });

      const transcription = await this.groq.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3-turbo',
        language: 'ru',
      });

      this.logger.log(`Transcribed voice: "${transcription.text.substring(0, 50)}..."`);
      return transcription.text || null;
    } catch (error: any) {
      this.logger.error(`STT transcription failed: ${error.message}`);
      return null;
    }
  }
}
