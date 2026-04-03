type MessageHandler = (data: Record<string, unknown>) => void;

class GameSocket {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private gameCode: string = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(gameCode: string) {
    this.gameCode = gameCode;
    const url = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/api/games/${gameCode}/ws`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.forEach((h) => h(data));
      } catch {
        console.error("WS parse error", e.data);
      }
    };
    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(this.gameCode), 3000);
    };
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }
}

export const gameSocket = new GameSocket();