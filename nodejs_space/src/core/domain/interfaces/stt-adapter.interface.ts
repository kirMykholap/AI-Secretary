export const STT_ADAPTER = 'STT_ADAPTER';

export interface ISttAdapter {
  transcribe(fileBuffer: Buffer, filename: string): Promise<string | null>;
}
