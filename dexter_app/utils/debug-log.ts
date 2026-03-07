type LogLevel = 'info' | 'warn' | 'error';
type Listener = (entries: LogEntry[]) => void;

export interface LogEntry {
  time: string;
  level: LogLevel;
  tag: string;
  message: string;
}

const MAX_ENTRIES = 100;
let entries: LogEntry[] = [];
let listeners: Listener[] = [];

function emit() {
  listeners.forEach((fn) => fn([...entries]));
}

function timestamp(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function append(level: LogLevel, tag: string, message: string) {
  const entry: LogEntry = { time: timestamp(), level, tag, message };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);

  const prefix = `[${tag}]`;
  if (level === 'error') console.error(prefix, message);
  else if (level === 'warn') console.warn(prefix, message);
  else console.log(prefix, message);

  emit();
}

export const dlog = {
  info: (tag: string, message: string) => append('info', tag, message),
  warn: (tag: string, message: string) => append('warn', tag, message),
  error: (tag: string, message: string) => append('error', tag, message),

  subscribe: (listener: Listener) => {
    listeners.push(listener);
    listener([...entries]);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  clear: () => {
    entries = [];
    emit();
  },

  getEntries: () => [...entries],
};
