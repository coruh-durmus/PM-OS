import type { Extension, ExtensionContext } from '@pm-os/types';
import { TranscriptionEngine } from './transcription-engine.js';
import { DiarizationEngine } from './diarization.js';
import { TranscriptWriter } from './transcript-writer.js';
import type { TranscriptSegment, MeetingMetadata } from './types.js';
import * as path from 'path';

const meetingTranscriptionExtension: Extension = {
  activate(context: ExtensionContext) {
    const extensionPath = context.extensionPath;
    const depsPath = path.join(extensionPath, 'deps');

    // Configure paths (will exist after store installs deps)
    const modelPath = path.join(depsPath, 'models', 'ggml-base.bin');
    const pythonPath = path.join(depsPath, 'python', 'bin', 'python3');

    const transcriptionEngine = new TranscriptionEngine(modelPath);
    const diarizationEngine = new DiarizationEngine(pythonPath, extensionPath);
    const transcriptWriter = new TranscriptWriter();

    // Store engines in global state for IPC access
    context.globalState.set('meeting-transcription:engines', {
      transcribe: async (systemAudioPath: string, micAudioPath: string, metadata: MeetingMetadata, projectPath: string) => {
        try {
          // 1. Transcribe both audio files
          const [systemSegments, micSegments] = await Promise.all([
            transcriptionEngine.transcribe(systemAudioPath),
            transcriptionEngine.transcribe(micAudioPath),
          ]);

          // 2. Diarize system audio (others' voices)
          const speakerSegments = await diarizationEngine.diarize(systemAudioPath);

          // 3. Merge: label mic segments as "You", merge with diarized system segments
          const allSegments: TranscriptSegment[] = [
            ...micSegments.map(s => ({ ...s, speaker: 'You' })),
            ...mergeWithSpeakers(systemSegments, speakerSegments),
          ].sort((a, b) => a.start - b.start);

          // 4. Extract unique participants
          const participants = [...new Set(allSegments.map(s => s.speaker || 'Unknown'))];
          metadata.participants = participants;

          // 5. Write transcript
          const filePath = await transcriptWriter.write(projectPath, metadata, allSegments);
          return filePath;
        } catch (err) {
          console.error('[MeetingTranscription] Pipeline error:', err);
          throw err;
        }
      },
    });

    console.log('[MeetingTranscription] Extension activated');
  },

  deactivate() {
    console.log('[MeetingTranscription] Extension deactivated');
  },
};

function mergeWithSpeakers(segments: TranscriptSegment[], speakers: { speaker: string; start: number; end: number }[]): TranscriptSegment[] {
  return segments.map(seg => {
    // Find the speaker segment that overlaps most with this transcript segment
    const midpoint = (seg.start + seg.end) / 2;
    const match = speakers.find(sp => sp.start <= midpoint && sp.end >= midpoint);
    return { ...seg, speaker: match?.speaker || 'Speaker Unknown' };
  });
}

export default meetingTranscriptionExtension;
export { meetingTranscriptionExtension };
