export class Disposable {
  private callOnDispose: () => void;
  constructor(callOnDispose: () => void) { this.callOnDispose = callOnDispose; }
  dispose(): void { this.callOnDispose(); }
  static from(...disposables: { dispose(): void }[]): Disposable {
    return new Disposable(() => disposables.forEach(d => d.dispose()));
  }
}

export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;

  private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
    this.scheme = scheme; this.authority = authority; this.path = path; this.query = query; this.fragment = fragment;
  }

  get fsPath(): string { return this.path; }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}${this.query ? '?' + this.query : ''}${this.fragment ? '#' + this.fragment : ''}`;
  }

  static file(path: string): Uri { return new Uri('file', '', path, '', ''); }
  static parse(value: string): Uri {
    try {
      const url = new URL(value);
      return new Uri(url.protocol.replace(':', ''), url.hostname, url.pathname, url.search.replace('?', ''), url.hash.replace('#', ''));
    } catch { return new Uri('file', '', value, '', ''); }
  }

  with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
    return new Uri(change.scheme ?? this.scheme, change.authority ?? this.authority, change.path ?? this.path, change.query ?? this.query, change.fragment ?? this.fragment);
  }
}

export class Position {
  readonly line: number;
  readonly character: number;
  constructor(line: number, character: number) { this.line = line; this.character = character; }
  isEqual(other: Position): boolean { return this.line === other.line && this.character === other.character; }
  isBefore(other: Position): boolean { return this.line < other.line || (this.line === other.line && this.character < other.character); }
  isAfter(other: Position): boolean { return !this.isEqual(other) && !this.isBefore(other); }
  translate(lineDelta?: number, characterDelta?: number): Position { return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0)); }
}

export class Range {
  readonly start: Position;
  readonly end: Position;
  constructor(start: Position, end: Position);
  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(startOrLine: Position | number, endOrChar: Position | number, endLine?: number, endChar?: number) {
    if (typeof startOrLine === 'number') {
      this.start = new Position(startOrLine, endOrChar as number);
      this.end = new Position(endLine!, endChar!);
    } else {
      this.start = startOrLine;
      this.end = endOrChar as Position;
    }
  }
  get isEmpty(): boolean { return this.start.isEqual(this.end); }
  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Position) {
      return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
    }
    return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
  }
}

export class Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;
  constructor(anchor: Position, active: Position) {
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
  }
  get isReversed(): boolean { return this.anchor.isAfter(this.active); }
}

export enum StatusBarAlignment { Left = 1, Right = 2 }
export enum ViewColumn { One = 1, Two = 2, Three = 3, Active = -1, Beside = -2 }
export enum DiagnosticSeverity { Error = 0, Warning = 1, Information = 2, Hint = 3 }
export enum ConfigurationTarget { Global = 1, Workspace = 2, WorkspaceFolder = 3 }
export enum ExtensionKind { UI = 1, Workspace = 2 }
export enum OverviewRulerLane { Left = 1, Center = 2, Right = 4, Full = 7 }
export enum TextEditorRevealType { Default = 0, InCenter = 1, InCenterIfOutsideViewport = 2, AtTop = 3 }

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  get event(): (listener: (e: T) => void) => Disposable {
    return (listener) => {
      this.listeners.push(listener);
      return new Disposable(() => {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) this.listeners.splice(idx, 1);
      });
    };
  }
  fire(data: T): void { for (const l of this.listeners) { try { l(data); } catch {} } }
  dispose(): void { this.listeners = []; }
}

export class CancellationTokenSource {
  private _token: { isCancellationRequested: boolean; onCancellationRequested: (listener: () => void) => Disposable };
  private emitter = new EventEmitter<void>();
  constructor() {
    this._token = { isCancellationRequested: false, onCancellationRequested: this.emitter.event };
  }
  get token() { return this._token; }
  cancel(): void { this._token.isCancellationRequested = true; this.emitter.fire(); }
  dispose(): void { this.emitter.dispose(); }
}
