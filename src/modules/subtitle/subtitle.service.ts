import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { HuddleCall } from '../huddle/entities/huddle-call.entity';
import { HuddleCallStatus } from '../huddle/entities/huddle.enums';
import {
  CallTranscript,
  CallTranscriptStatus,
  SubtitlePreference,
  TranscriptSegment,
} from './entities';
import {
  SubtitleTranscriptEvent,
  TranscriptSegmentInputDto,
} from './dto/transcript-segment.dto';
import { SubtitlePreferenceResponse } from './dto/subtitle-preference.dto';
import { HuddleGateway } from '../huddle/huddle.gateway';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasClientService } from '../canvas-client/canvas-client.service';

interface ActiveSubtitleState {
  callId: string;
  channelId: string;
  segments: Map<string, SubtitleTranscriptEvent>;
  timers: Map<string, NodeJS.Timeout>;
}

interface TranscriptPersistenceBuffer {
  key: string;
  callId: string;
  transcriptId: string;
  speakerName: string;
  speakerId: string | null;
  sourceParticipantIdentity: string | null;
  text: string;
  startMs: number;
  endMs: number;
  lastSequence: number;
  flushTimer?: NodeJS.Timeout;
}

export interface TranscriptReviewCanvasResponse {
  call_id: string;
  transcript_id: string;
  canvas_id: string;
  created: boolean;
}

export interface TranscriptStatusResponse {
  call_id: string;
  transcript_id: string | null;
  status: CallTranscriptStatus | null;
  recording: boolean;
  segment_count: number;
  review_canvas_id: string | null;
}

@Injectable()
export class SubtitleService {
  private static readonly TRANSCRIPT_FLUSH_SILENCE_MS = 3000;
  private static readonly TRANSCRIPT_MAX_SEGMENT_MS = 45000;
  private static readonly TRANSCRIPT_MAX_CHARS = 1000;
  private static readonly TRANSCRIPT_MAX_APPEND_GAP_MS = 5000;

  private readonly logger = new Logger(SubtitleService.name);
  private readonly activeStates = new Map<string, ActiveSubtitleState>();
  private readonly activeTranscriptBuffers = new Map<string, TranscriptPersistenceBuffer>();
  private readonly transcriptSequenceCounters = new Map<string, number>();
  private readonly transcriptPersistenceLocks = new Map<string, Promise<void>>();
  private readonly committedTranscriptTextByBufferKey = new Map<string, string>();
  private readonly transcriptRecordingStartMsByCall = new Map<string, number>();

  constructor(
    @InjectRepository(HuddleCall)
    private readonly huddleCallRepo: Repository<HuddleCall>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepo: Repository<ChannelEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepo: Repository<WorkspaceMemberEntity>,
    @InjectRepository(CallTranscript)
    private readonly callTranscriptRepo: Repository<CallTranscript>,
    @InjectRepository(TranscriptSegment)
    private readonly segmentRepo: Repository<TranscriptSegment>,
    @InjectRepository(SubtitlePreference)
    private readonly preferenceRepo: Repository<SubtitlePreference>,
    private readonly canvasService: CanvasService,
    private readonly canvasClient: CanvasClientService,
    @Inject(forwardRef(() => HuddleGateway))
    private readonly huddleGateway: HuddleGateway,
  ) {}

  async processTranscript(dto: TranscriptSegmentInputDto): Promise<{ segment_id: string; accepted: true }> {
    const call = await this.huddleCallRepo.findOne({
      where: { id: dto.call_id, channelId: dto.channel_id, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) {
      throw new NotFoundException('Call not found or not active');
    }

    const segmentId = dto.segment_id || randomUUID();
    const event = this.toTranscriptEvent(dto, segmentId);
    this.updateActiveState(event);
    this.huddleGateway.emitToChannel(dto.channel_id, 'subtitle:transcript', event);

    if (dto.is_final) {
      await this.bufferFinalSegment(dto, call);
    }

    return { segment_id: segmentId, accepted: true };
  }

  async getCurrentStateForChannel(channelId: string): Promise<{ call_id: string; channel_id: string; active_segments: SubtitleTranscriptEvent[] } | null> {
    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) return null;

    const state = this.activeStates.get(call.id);
    return {
      call_id: call.id,
      channel_id: channelId,
      active_segments: state ? Array.from(state.segments.values()).sort((a, b) => a.sequence - b.sequence) : [],
    };
  }

  async startTranscript(callId: string, userId: string, language = 'vi'): Promise<CallTranscript> {
    const call = await this.getCallForUser(callId, userId);
    const existing = await this.callTranscriptRepo.findOne({ where: { callId: call.id } });
    if (existing) {
      if (existing.status === CallTranscriptStatus.RECORDING) {
        return existing;
      }
      throw new ConflictException('Transcript already finalized for this call');
    }

    const transcript = this.callTranscriptRepo.create({
      callId: call.id,
      language,
      status: CallTranscriptStatus.RECORDING,
    });
    const saved = await this.callTranscriptRepo.save(transcript);
    this.transcriptRecordingStartMsByCall.set(call.id, this.getCallElapsedMs(call, saved.createdAt || new Date()));
    this.seedCommittedTranscriptTextFromActiveState(call.id);
    this.huddleGateway.emitToChannel(call.channelId, 'subtitle:transcript_recording_started', {
      call_id: call.id,
      transcript_id: saved.id,
      status: saved.status,
      started_at: saved.createdAt?.toISOString?.() || new Date().toISOString(),
    });
    this.logger.log(`Transcript recording started call=${call.id} transcript=${saved.id}`);
    return saved;
  }

  async getTranscriptStatus(callId: string, userId: string): Promise<TranscriptStatusResponse> {
    const call = await this.getCallForUser(callId, userId);
    const transcript = await this.callTranscriptRepo.findOne({ where: { callId: call.id } });

    return {
      call_id: call.id,
      transcript_id: transcript?.id || null,
      status: transcript?.status || null,
      recording: transcript?.status === CallTranscriptStatus.RECORDING,
      segment_count: transcript?.segmentCount || 0,
      review_canvas_id: transcript?.reviewCanvasId || null,
    };
  }

  async stopTranscript(callId: string, userId: string): Promise<CallTranscript> {
    const call = await this.getCallForUser(callId, userId);
    const transcript = await this.callTranscriptRepo.findOne({ where: { callId: call.id } });
    if (!transcript) {
      throw new NotFoundException('Transcript not found for this call');
    }

    await this.flushTranscriptBuffersForCall(call.id, 'call_end');
    return this.finalizeTranscript(call, transcript);
  }

  async completeTranscriptForCall(callId: string): Promise<CallTranscript | null> {
    const call = await this.huddleCallRepo.findOne({ where: { id: callId } });
    if (!call) return null;

    const transcript = await this.callTranscriptRepo.findOne({ where: { callId: call.id } });
    if (!transcript) return null;

    await this.flushTranscriptBuffersForCall(call.id, 'call_end');
    return this.finalizeTranscript(call, transcript);
  }

  async getTranscript(
    callId: string,
    userId: string,
    cursor = 0,
    limit = 100,
  ): Promise<{ call_id: string; segments: TranscriptSegment[]; next_cursor: number | null; total: number }> {
    const call = await this.getCallForUser(callId, userId);
    const transcript = await this.callTranscriptRepo.findOne({ where: { callId: call.id } });
    if (!transcript) {
      throw new NotFoundException('Transcript not found for this call');
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const [segments, total] = await this.segmentRepo
      .createQueryBuilder('segment')
      .where('segment.transcriptId = :transcriptId', { transcriptId: transcript.id })
      .andWhere('segment.sequence >= :cursor', { cursor: Number(cursor) || 0 })
      .orderBy('segment.sequence', 'ASC')
      .take(safeLimit + 1)
      .getManyAndCount();

    const page = segments.slice(0, safeLimit);
    const next = segments.length > safeLimit ? page[page.length - 1]?.sequence + 1 : null;
    return { call_id: call.id, segments: page, next_cursor: next, total };
  }

  async createReviewCanvas(callId: string, userId: string): Promise<TranscriptReviewCanvasResponse> {
    const call = await this.getCallForUser(callId, userId);
    const transcript = await this.callTranscriptRepo.findOne({ where: { callId: call.id } });
    if (!transcript) {
      throw new NotFoundException('Transcript not found for this call');
    }

    if (transcript.status !== CallTranscriptStatus.COMPLETED) {
      throw new ConflictException('Transcript is not ready yet');
    }

    if (transcript.reviewCanvasId) {
      return {
        call_id: call.id,
        transcript_id: transcript.id,
        canvas_id: transcript.reviewCanvasId,
        created: false,
      };
    }

    const channel = await this.channelRepo.findOne({ where: { id: call.channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const segments = await this.segmentRepo.find({
      where: { transcriptId: transcript.id },
      order: { sequence: 'ASC' },
    });

    const title = `Meeting transcript - ${this.formatDateForTitle(call.startedAt)}`;
    const canvas = await this.canvasService.createCanvasForWorkspace(channel.workspaceId, userId, {
      title,
      description: `Transcript for huddle in #${channel.name || 'channel'}`,
    });

    await this.writeTranscriptCanvasContent(canvas.id, call, transcript, segments, channel.name || 'Channel');
    await this.canvasService.shareCanvasWithChannel(canvas.id, userId, {
      channelId: call.channelId,
      role: 'viewer',
    });

    transcript.reviewCanvasId = canvas.id;
    transcript.reviewCanvasCreatedAt = new Date();
    await this.callTranscriptRepo.save(transcript);

    return {
      call_id: call.id,
      transcript_id: transcript.id,
      canvas_id: canvas.id,
      created: true,
    };
  }

  async getPreference(userId: string): Promise<SubtitlePreferenceResponse> {
    const preference = await this.ensurePreference(userId);
    return this.toPreferenceResponse(preference);
  }

  async updatePreference(userId: string, enabled: boolean): Promise<SubtitlePreferenceResponse> {
    const preference = await this.ensurePreference(userId);
    preference.enabled = enabled;
    const saved = await this.preferenceRepo.save(preference);
    this.huddleGateway.emitToUser(userId, 'subtitle:preference_updated', { enabled });
    return this.toPreferenceResponse(saved);
  }

  async canAccessChannel(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) return false;
    const member = await this.workspaceMemberRepo.findOne({
      where: { workspaceId: channel.workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });
    return Boolean(member);
  }

  private async finalizeTranscript(call: HuddleCall, transcript: CallTranscript): Promise<CallTranscript> {
    if (transcript.status !== CallTranscriptStatus.COMPLETED) {
      transcript.status = CallTranscriptStatus.COMPLETED;
      transcript.completedAt = new Date();
    }

    transcript.segmentCount = await this.segmentRepo.count({ where: { transcriptId: transcript.id } });
    const saved = await this.callTranscriptRepo.save(transcript);
    this.transcriptSequenceCounters.delete(saved.id);
    this.transcriptRecordingStartMsByCall.delete(call.id);
    this.clearCommittedTranscriptTextForCall(call.id);
    this.huddleGateway.emitToChannel(call.channelId, 'subtitle:transcript_saved', {
      call_id: call.id,
      transcript_id: saved.id,
      segment_count: saved.segmentCount,
      duration_seconds: call.startedAt ? Math.max(0, Math.round(((call.endedAt || new Date()).getTime() - call.startedAt.getTime()) / 1000)) : 0,
    });
    this.logger.log(`Transcript recording completed call=${call.id} transcript=${saved.id} segments=${saved.segmentCount}`);
    return saved;
  }

  private async writeTranscriptCanvasContent(
    canvasId: string,
    call: HuddleCall,
    transcript: CallTranscript,
    segments: TranscriptSegment[],
    channelName: string,
  ): Promise<void> {
    const lines = segments.map((segment) => this.formatTranscriptLine(segment));
    const blocks = [
      { type: 'heading', content: 'Meeting transcript' },
      {
        type: 'paragraph',
        content: [
          `Channel: #${channelName}`,
          `Started: ${this.formatDateTime(call.startedAt)}`,
          `Ended: ${this.formatDateTime(call.endedAt || transcript.completedAt)}`,
          `Segments: ${segments.length}`,
        ].join('\n'),
      },
      {
        type: 'paragraph',
        content: lines.length
          ? 'Transcript generated from realtime subtitles. Speaker labels and timestamps are preserved below.'
          : 'No transcript segments were saved for this meeting.',
      },
      ...this.chunkLines(lines).map((content) => ({ type: 'paragraph', content })),
    ];

    let afterIndex: number | undefined;
    for (const block of blocks) {
      await this.canvasClient.insertBlock(canvasId, block.content, block.type, afterIndex);
      afterIndex = afterIndex === undefined ? 0 : afterIndex + 1;
    }
  }

  private chunkLines(lines: string[], maxLength = 3500): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const line of lines) {
      const next = current ? `${current}\n${line}` : line;
      if (next.length > maxLength && current) {
        chunks.push(current);
        current = line;
      } else {
        current = next;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  private formatTranscriptLine(segment: TranscriptSegment): string {
    const endMs = segment.endMs ?? segment.startMs;
    return `[${this.formatOffset(segment.startMs)} - ${this.formatOffset(endMs)}] ${segment.speakerName}: ${segment.text}`;
  }

  private formatOffset(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  private formatDateTime(value?: Date): string {
    if (!value) return 'Unknown';
    return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  }

  private formatDateForTitle(value?: Date): string {
    if (!value) return 'Unknown time';
    return value.toISOString().slice(0, 16).replace('T', ' ');
  }

  private async bufferFinalSegment(dto: TranscriptSegmentInputDto, call: HuddleCall): Promise<void> {
    const transcript = await this.callTranscriptRepo.findOne({
      where: { callId: dto.call_id, status: CallTranscriptStatus.RECORDING },
    });
    if (!transcript) return;

    const rawIncomingText = this.normalizeTranscriptText(dto.text);
    if (!rawIncomingText) return;

    const bufferKey = this.getTranscriptBufferKey(dto);
    const incomingEndMs = dto.end_ms ?? dto.start_ms;
    const recordingStartMs = this.getTranscriptRecordingStartMs(call, transcript);
    if (incomingEndMs < recordingStartMs) return;

    await this.flushOtherSpeakerBuffers(dto.call_id, bufferKey);

    const incomingText = this.extractUncommittedTranscriptText(bufferKey, rawIncomingText);
    if (!incomingText) return;

    const existing = this.activeTranscriptBuffers.get(bufferKey);

    if (!existing) {
      const buffer: TranscriptPersistenceBuffer = {
        key: bufferKey,
        callId: dto.call_id,
        transcriptId: transcript.id,
        speakerName: dto.speaker_name,
        speakerId: dto.speaker_id || null,
        sourceParticipantIdentity: dto.source_participant_identity || null,
        text: incomingText,
        startMs: dto.start_ms,
        endMs: incomingEndMs,
        lastSequence: dto.sequence,
      };
      this.activeTranscriptBuffers.set(bufferKey, buffer);
      this.scheduleBufferFlush(buffer);
      return;
    }

    if (dto.sequence <= existing.lastSequence) return;

    const gapMs = Math.max(0, dto.start_ms - existing.endMs);
    const durationMs = Math.max(0, incomingEndMs - existing.startMs);
    const shouldStartNewSegment =
      gapMs > SubtitleService.TRANSCRIPT_MAX_APPEND_GAP_MS ||
      durationMs > SubtitleService.TRANSCRIPT_MAX_SEGMENT_MS ||
      existing.text.length >= SubtitleService.TRANSCRIPT_MAX_CHARS;

    if (shouldStartNewSegment) {
      await this.flushBuffer(existing.key, this.getFlushReason(existing, incomingEndMs, gapMs));
      const nextText = this.extractUncommittedTranscriptText(bufferKey, rawIncomingText);
      if (!nextText) return;

      this.activeTranscriptBuffers.set(bufferKey, {
        key: bufferKey,
        callId: dto.call_id,
        transcriptId: transcript.id,
        speakerName: dto.speaker_name,
        speakerId: dto.speaker_id || null,
        sourceParticipantIdentity: dto.source_participant_identity || null,
        text: nextText,
        startMs: dto.start_ms,
        endMs: incomingEndMs,
        lastSequence: dto.sequence,
      });
      this.scheduleBufferFlush(this.activeTranscriptBuffers.get(bufferKey)!);
      return;
    }

    existing.text = this.mergeTranscriptText(existing.text, incomingText);
    existing.endMs = Math.max(existing.endMs, incomingEndMs);
    existing.lastSequence = dto.sequence;
    this.scheduleBufferFlush(existing);

    if (existing.text.length >= SubtitleService.TRANSCRIPT_MAX_CHARS) {
      await this.flushBuffer(existing.key, 'max_chars');
    }
  }

  private async flushOtherSpeakerBuffers(callId: string, currentBufferKey: string): Promise<void> {
    const buffers = Array.from(this.activeTranscriptBuffers.values()).filter(
      (buffer) => buffer.callId === callId && buffer.key !== currentBufferKey,
    );

    for (const buffer of buffers) {
      await this.flushBuffer(buffer.key, 'speaker_switch');
    }
  }

  private scheduleBufferFlush(buffer: TranscriptPersistenceBuffer): void {
    if (buffer.flushTimer) {
      clearTimeout(buffer.flushTimer);
    }

    buffer.flushTimer = setTimeout(() => {
      void this.flushBuffer(buffer.key, 'silence');
    }, SubtitleService.TRANSCRIPT_FLUSH_SILENCE_MS);
  }

  private async flushTranscriptBuffersForCall(callId: string, reason: string): Promise<void> {
    const buffers = Array.from(this.activeTranscriptBuffers.values()).filter((buffer) => buffer.callId === callId);

    for (const buffer of buffers) {
      await this.flushBuffer(buffer.key, reason);
    }
  }

  private async flushBuffer(bufferKey: string, reason: string): Promise<void> {
    const buffer = this.activeTranscriptBuffers.get(bufferKey);
    if (!buffer) return;

    if (buffer.flushTimer) {
      clearTimeout(buffer.flushTimer);
      buffer.flushTimer = undefined;
    }
    this.activeTranscriptBuffers.delete(bufferKey);

    const text = this.normalizeTranscriptText(buffer.text);
    if (!text) return;

    await this.withTranscriptPersistenceLock(buffer.transcriptId, async () => {
      const sequence = await this.nextPersistedSequence(buffer.transcriptId);
      await this.segmentRepo.save(
        this.segmentRepo.create({
          transcriptId: buffer.transcriptId,
          speakerName: buffer.speakerName,
          speakerId: buffer.speakerId || null,
          sourceParticipantIdentity: buffer.sourceParticipantIdentity || null,
          text,
          isFinal: true,
          startMs: buffer.startMs,
          endMs: Math.max(buffer.endMs, buffer.startMs),
          sequence,
        }),
      );

      await this.callTranscriptRepo.increment({ id: buffer.transcriptId }, 'segmentCount', 1);
      this.recordCommittedTranscriptText(buffer.key, text);
      this.logger.debug(
        `Flushed transcript buffer reason=${reason} call=${buffer.callId} transcript=${buffer.transcriptId} speaker=${buffer.speakerName} sequence=${sequence}`,
      );
    });
  }

  private async withTranscriptPersistenceLock(transcriptId: string, fn: () => Promise<void>): Promise<void> {
    const previous = this.transcriptPersistenceLocks.get(transcriptId) || Promise.resolve();
    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.transcriptPersistenceLocks.set(transcriptId, chained);

    await previous;
    try {
      await fn();
    } finally {
      release!();
      if (this.transcriptPersistenceLocks.get(transcriptId) === chained) {
        this.transcriptPersistenceLocks.delete(transcriptId);
      }
    }
  }

  private async nextPersistedSequence(transcriptId: string): Promise<number> {
    const current = this.transcriptSequenceCounters.get(transcriptId);
    if (current !== undefined) {
      const next = current + 1;
      this.transcriptSequenceCounters.set(transcriptId, next);
      return next;
    }

    const row = await this.segmentRepo
      .createQueryBuilder('segment')
      .select('MAX(segment.sequence)', 'max')
      .where('segment.transcriptId = :transcriptId', { transcriptId })
      .getRawOne<{ max: string | number | null }>();

    const max = row?.max === null || row?.max === undefined ? -1 : Number(row.max);
    const next = Number.isFinite(max) ? max + 1 : 0;
    this.transcriptSequenceCounters.set(transcriptId, next);
    return next;
  }

  private getTranscriptBufferKey(dto: TranscriptSegmentInputDto): string {
    const speakerKey = dto.speaker_id || dto.source_participant_identity || dto.speaker_name;
    return `${dto.call_id}:${speakerKey}`;
  }

  private getTranscriptBufferKeyFromEvent(event: SubtitleTranscriptEvent): string {
    const speakerKey = event.speaker_id || event.source_participant_identity || event.speaker_name;
    return `${event.call_id}:${speakerKey}`;
  }

  private getTranscriptRecordingStartMs(call: HuddleCall, transcript: CallTranscript): number {
    const existing = this.transcriptRecordingStartMsByCall.get(call.id);
    if (existing !== undefined) return existing;

    const startMs = this.getCallElapsedMs(call, transcript.createdAt);
    this.transcriptRecordingStartMsByCall.set(call.id, startMs);
    return startMs;
  }

  private getCallElapsedMs(call: HuddleCall, value: Date = new Date()): number {
    if (!call.startedAt) return 0;
    return Math.max(0, value.getTime() - call.startedAt.getTime());
  }

  private seedCommittedTranscriptTextFromActiveState(callId: string): void {
    const state = this.activeStates.get(callId);
    if (!state) return;

    for (const event of state.segments.values()) {
      const text = this.normalizeTranscriptText(event.text);
      if (!text) continue;
      this.recordCommittedTranscriptText(this.getTranscriptBufferKeyFromEvent(event), text);
    }
  }

  private extractUncommittedTranscriptText(bufferKey: string, incomingText: string): string {
    const committed = this.committedTranscriptTextByBufferKey.get(bufferKey);
    const incoming = this.normalizeTranscriptText(incomingText);
    if (!committed) return incoming;

    const normalizedCommitted = this.normalizeTranscriptText(committed);
    const committedComparable = normalizedCommitted.toLocaleLowerCase();
    const incomingComparable = incoming.toLocaleLowerCase();

    if (incomingComparable.startsWith(committedComparable)) {
      return this.normalizeTranscriptText(incoming.slice(normalizedCommitted.length));
    }

    if (committedComparable.startsWith(incomingComparable)) {
      return '';
    }

    const overlap = this.findLongestSuffixPrefixOverlap(normalizedCommitted, incoming);
    const meaningfulOverlap = Math.min(20, normalizedCommitted.length, incoming.length);
    if (overlap >= meaningfulOverlap) {
      return this.normalizeTranscriptText(incoming.slice(overlap));
    }

    return incoming;
  }

  private recordCommittedTranscriptText(bufferKey: string, text: string): void {
    const committed = this.committedTranscriptTextByBufferKey.get(bufferKey);
    this.committedTranscriptTextByBufferKey.set(
      bufferKey,
      committed ? this.mergeTranscriptText(committed, text) : this.normalizeTranscriptText(text),
    );
  }

  private clearCommittedTranscriptTextForCall(callId: string): void {
    const prefix = `${callId}:`;
    for (const key of Array.from(this.committedTranscriptTextByBufferKey.keys())) {
      if (key.startsWith(prefix)) {
        this.committedTranscriptTextByBufferKey.delete(key);
      }
    }
  }

  private getFlushReason(buffer: TranscriptPersistenceBuffer, incomingEndMs: number, gapMs: number): string {
    if (gapMs > SubtitleService.TRANSCRIPT_MAX_APPEND_GAP_MS) return 'silence_gap';
    if (incomingEndMs - buffer.startMs > SubtitleService.TRANSCRIPT_MAX_SEGMENT_MS) return 'max_duration';
    if (buffer.text.length >= SubtitleService.TRANSCRIPT_MAX_CHARS) return 'max_chars';
    return 'segment_boundary';
  }

  private normalizeTranscriptText(text: string): string {
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  private mergeTranscriptText(existingText: string, incomingText: string): string {
    const existing = this.normalizeTranscriptText(existingText);
    const incoming = this.normalizeTranscriptText(incomingText);

    if (!existing) return incoming;
    if (!incoming) return existing;

    const existingComparable = existing.toLocaleLowerCase();
    const incomingComparable = incoming.toLocaleLowerCase();

    if (incomingComparable.startsWith(existingComparable)) return incoming;
    if (existingComparable.startsWith(incomingComparable)) return existing;

    const overlap = this.findLongestSuffixPrefixOverlap(existing, incoming);
    if (overlap > 0) {
      return this.normalizeTranscriptText(`${existing}${incoming.slice(overlap)}`);
    }

    return this.normalizeTranscriptText(`${existing} ${incoming}`);
  }

  private findLongestSuffixPrefixOverlap(existingText: string, incomingText: string): number {
    const existing = this.normalizeTranscriptText(existingText).toLocaleLowerCase();
    const incoming = this.normalizeTranscriptText(incomingText).toLocaleLowerCase();
    const maxOverlap = Math.min(existing.length, incoming.length);

    for (let length = maxOverlap; length > 0; length -= 1) {
      if (existing.slice(-length) === incoming.slice(0, length)) {
        return length;
      }
    }

    return 0;
  }

  private updateActiveState(event: SubtitleTranscriptEvent): void {
    let state = this.activeStates.get(event.call_id);
    if (!state) {
      state = {
        callId: event.call_id,
        channelId: event.channel_id,
        segments: new Map(),
        timers: new Map(),
      };
      this.activeStates.set(event.call_id, state);
    }

    state.segments.set(event.segment_id, event);
    const existingTimer = state.timers.get(event.segment_id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      state?.segments.delete(event.segment_id);
      state?.timers.delete(event.segment_id);
      if (state && state.segments.size === 0) {
        this.activeStates.delete(event.call_id);
      }
    }, 3000);
    state.timers.set(event.segment_id, timer);
  }

  private toTranscriptEvent(dto: TranscriptSegmentInputDto, segmentId: string): SubtitleTranscriptEvent {
    return {
      call_id: dto.call_id,
      channel_id: dto.channel_id,
      segment_id: segmentId,
      speaker_name: dto.speaker_name,
      speaker_id: dto.speaker_id || null,
      source_participant_identity: dto.source_participant_identity || null,
      text: dto.text,
      is_final: dto.is_final,
      start_ms: dto.start_ms,
      end_ms: dto.end_ms ?? null,
      sequence: dto.sequence,
      timestamp: new Date().toISOString(),
    };
  }

  private async getCallForUser(callId: string, userId: string): Promise<HuddleCall> {
    const call = await this.huddleCallRepo.findOne({ where: { id: callId } });
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    const canAccess = await this.canAccessChannel(call.channelId, userId);
    if (!canAccess) {
      throw new ForbiddenException('You are not allowed to access this transcript');
    }
    return call;
  }

  private async ensurePreference(userId: string): Promise<SubtitlePreference> {
    let preference = await this.preferenceRepo.findOne({ where: { userId } });
    if (!preference) {
      preference = await this.preferenceRepo.save(this.preferenceRepo.create({ userId, enabled: false }));
    }
    return preference;
  }

  private toPreferenceResponse(preference: SubtitlePreference): SubtitlePreferenceResponse {
    return {
      user_id: preference.userId,
      enabled: preference.enabled,
      updated_at: preference.updatedAt,
    };
  }
}
