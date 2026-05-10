import { Channel, invoke } from "@tauri-apps/api/core";
import type { LogLevel } from "tauri-plugin-mihomo-api";

type MessageKind<T extends string, D> = {
  type: T;
  data: D;
};

type CloseFrame = {
  code: number;
  reason: string;
};

export type ManagedMihomoWebSocketMessage =
  | MessageKind<"Text", string>
  | MessageKind<"Binary", number[]>
  | MessageKind<"Ping", number[]>
  | MessageKind<"Pong", number[]>
  | MessageKind<"Close", CloseFrame | null>;

type Listener = (message: ManagedMihomoWebSocketMessage) => void;

type TextSubscriptionOptions = {
  connect: () => Promise<ManagedMihomoWebSocket>;
  onText: (text: string) => void;
  onError?: (error: unknown) => void;
};

export const subscribeManagedMihomoWebSocketText = ({
  connect,
  onText,
  onError,
}: TextSubscriptionOptions): (() => void) => {
  let disposed = false;
  let socket: ManagedMihomoWebSocket | null = null;

  connect()
    .then((instance) => {
      if (disposed) {
        void instance.close();
        return;
      }

      socket = instance;
      instance.addListener((message) => {
        if (
          disposed ||
          message.type !== "Text" ||
          /^(?:[Ww]ebsocket error)/.test(message.data)
        ) {
          return;
        }

        try {
          onText(message.data);
        } catch (error) {
          onError?.(error);
        }
      });
    })
    .catch((error) => {
      if (!disposed) onError?.(error);
    });

  return () => {
    disposed = true;
    void socket?.close();
  };
};

export class ManagedMihomoWebSocket {
  id: number;
  private closed = false;
  private readonly listeners: Set<Listener>;
  private static instances = new Set<ManagedMihomoWebSocket>();

  private constructor(id: number, listeners: Set<Listener>) {
    this.id = id;
    this.listeners = listeners;
  }

  private static async connect(
    command: "ws_traffic" | "ws_memory" | "ws_connections" | "ws_logs",
    args: Record<string, unknown> = {},
  ): Promise<ManagedMihomoWebSocket> {
    const listeners: Set<Listener> = new Set();
    const onMessage = new Channel<ManagedMihomoWebSocketMessage>();
    onMessage.onmessage = (message) => {
      listeners.forEach((listener) => listener(message));
    };

    const id = await invoke<number>(command, { ...args, onMessage });
    const instance = new ManagedMihomoWebSocket(id, listeners);
    ManagedMihomoWebSocket.instances.add(instance);
    return instance;
  }

  static async connectTraffic(): Promise<ManagedMihomoWebSocket> {
    return ManagedMihomoWebSocket.connect("ws_traffic");
  }

  static async connectMemory(): Promise<ManagedMihomoWebSocket> {
    return ManagedMihomoWebSocket.connect("ws_memory");
  }

  static async connectConnections(): Promise<ManagedMihomoWebSocket> {
    return ManagedMihomoWebSocket.connect("ws_connections");
  }

  static async connectLogs(level: LogLevel): Promise<ManagedMihomoWebSocket> {
    return ManagedMihomoWebSocket.connect("ws_logs", { level });
  }

  addListener(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    try {
      await invoke("ws_disconnect", {
        id: this.id,
        forceTimeout: 0,
      });
    } catch {
      // ignore close failures; backend may have already cleaned up the socket.
    } finally {
      this.listeners.clear();
      ManagedMihomoWebSocket.instances.delete(this);
    }
  }

  static async cleanupAll(): Promise<void> {
    await Promise.all(
      Array.from(ManagedMihomoWebSocket.instances).map((instance) =>
        instance.close(),
      ),
    );
    ManagedMihomoWebSocket.instances.clear();
    await invoke("clear_all_ws_connections");
  }
}
