type MessageHandler = (data: Record<string, unknown>) => void;

class GameSocket {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private gameCode: string = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting: boolean = false;

  connect(gameCode: string) {
    this.gameCode = gameCode;
    this.reconnecting = false;
    this._connect();
  }

  private _connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    const url = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/api/games/${this.gameCode}/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.forEach((h) => h(data));
      } catch {
        console.error("WS parse error", e.data);
      }
    };

    this.ws.onclose = () => {
      if (!this.reconnecting) {
        this.reconnecting = true;
        this.reconnectTimer = setTimeout(() => this._connect(), 2000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this._connect();
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(data));
        }
      }, 1000);
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  disconnect() {
    this.reconnecting = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const gameSocket = new GameSocket();