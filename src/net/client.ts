import type {
  ClientMessage,
  EmoteKind,
  FishEntity,
  FishSync,
  ServerMessage,
} from '../../shared/protocol';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

type MessageHandler = (message: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

function resolveUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

class NetworkClient {
  private socket: WebSocket | null = null;
  private ownerId = '';
  private reconnectTimer: number | null = null;
  private attempts = 0;
  private intentionalClose = false;
  private status: ConnectionStatus = 'offline';
  private onMessage: MessageHandler = () => {};
  private onStatus: StatusHandler = () => {};
  private pingTimer: number | null = null;
  private hasConnected = false;

  configure(handlers: { onMessage: MessageHandler; onStatus: StatusHandler }) {
    this.onMessage = handlers.onMessage;
    this.onStatus = handlers.onStatus;
  }

  connect(ownerId: string) {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN && this.ownerId === ownerId) return;
    this.ownerId = ownerId;
    this.intentionalClose = false;
    this.open();
  }

  private open() {
    this.clearReconnect();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
    }
    this.setStatus(this.hasConnected ? 'offline' : 'connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(resolveUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.hasConnected = true;
      this.setStatus('online');
      this.send({ type: 'HELLO', ownerId: this.ownerId });
      this.startPing();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      if (parsed && typeof parsed.type === 'string') this.onMessage(parsed);
    };

    socket.onclose = () => {
      this.stopPing();
      if (this.socket === socket) this.socket = null;
      if (!this.intentionalClose) {
        this.setStatus('offline');
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // onclose drives reconnect
    };
  }

  private scheduleReconnect() {
    if (this.intentionalClose || this.reconnectTimer !== null || !this.ownerId) return;
    const delay = Math.min(15_000, 900 * Math.pow(1.7, Math.min(6, this.attempts))) + Math.random() * 600;
    this.attempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.ownerId) this.open();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => this.send({ type: 'PING' }), 25_000);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  get connectionStatus() {
    return this.status;
  }

  get isOnline() {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  spawnFish(fish: FishEntity) {
    this.send({ type: 'FISH_SPAWN', fish });
  }

  despawnFish(fishId: string) {
    this.send({ type: 'FISH_DESPAWN', fishId });
  }

  sendSync(updates: FishSync[]) {
    if (updates.length === 0) return;
    this.send({ type: 'FISH_SYNC_BATCH', updates });
  }

  dropFeed(pelletId: string, x: number, y: number) {
    this.send({ type: 'FEED_DROP', pelletId, x, y });
  }

  consumeFeed(pelletId: string, fishId: string) {
    this.send({ type: 'FEED_CONSUMED', pelletId, fishId });
  }

  tapGlass(x: number, y: number) {
    this.send({ type: 'GLASS_TAP', x, y });
  }

  sendEmote(targetFishId: string, emote: EmoteKind) {
    this.send({ type: 'EMOTE_SEND', targetFishId, emote });
  }

  createPrivateRoom() {
    this.send({ type: 'CREATE_PRIVATE' });
  }

  joinPrivateRoom(code: string[]) {
    this.send({ type: 'JOIN_PRIVATE', code });
  }

  leavePrivateRoom() {
    this.send({ type: 'LEAVE_PRIVATE' });
  }

  disconnect() {
    this.intentionalClose = true;
    this.clearReconnect();
    this.stopPing();
    this.ownerId = '';
    this.hasConnected = false;
    this.setStatus('offline');
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }
}

export const network = new NetworkClient();
