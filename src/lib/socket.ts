type MessageHandler = (data: Record<string, unknown>) => void;

class GameSocket {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private gameCode: string = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting: boolean = false;
  private _visibilityHandler: EventListenerOrEventListenerObject | null = null;

  connect(gameCode: string) {
    this.gameCode = gameCode;
    this.reconnecting = false;
    this._connect();
    // Reconnect when tab becomes visible again
    if (typeof document !== "undefined") {
      if (this._visibilityHandler) document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = this.handleVisibilityChange.bind(this) as EventListenerOrEventListenerObject;
      document.addEventListener("visibilitychange", this._visibilityHandler);
    }
  }

  handleVisibilityChange() {
    if (document.visibilityState === "visible" && this.gameCode) {
      if (!this.isConnected()) {
        this._connect();
      }
    }
  }

  private _connect() {
    // Guard against both OPEN (already connected) AND CONNECTING (handshake
    // in flight). The original `=== OPEN` check missed the CONNECTING case,
    // which meant a rapid second connect() call created a duplicate WebSocket
    // — both handshakes would complete, both onopen handlers would fire, and
    // every server broadcast would arrive twice at the client. The dev-mode
    // double-mount from React Strict Mode reliably triggered this.
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;
    const url = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/api/games/${this.gameCode}/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      // Notify listeners that socket reconnected so they can re-sync state
      this.handlers.forEach((h) => h({ event: "socket_reconnected" }));
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
        // Longer delay to handle tab switching gracefully
        this.reconnectTimer = setTimeout(() => this._connect(), 1000);
      }
    };

    this.ws.onerror = () => {
      // Don't close on error, let onclose handle reconnect
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
    // Defense-in-depth: if the same handler reference is already registered,
    // don't add it again. Strict-Mode double-mounts or mis-managed useEffect
    // cleanup can otherwise accumulate identical handlers and cause events
    // to fire twice per message.
    if (this.handlers.includes(handler)) {
      return () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      };
    }
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  disconnect() {
    this.reconnecting = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (typeof document !== "undefined" && this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
    }
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const gameSocket = new GameSocket();