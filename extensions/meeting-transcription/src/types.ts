export interface TranscriptSegment {
  start: number;    // seconds from meeting start
  end: number;
  text: string;
  speaker?: string;
}

export interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
}

export interface MeetingMetadata {
  meetingId: string;
  date: string;       // ISO 8601
  duration: number;    // seconds
  platform: string;
  meetingUrl: string;
  participants: string[];
}

export interface TranscriptionConfig {
  modelSize: 'tiny' | 'base' | 'small' | 'medium';
  modelPath: string;
  pythonPath: string;
  pyannoteModelPath: string;
}
