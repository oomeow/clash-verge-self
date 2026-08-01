import { json } from "@codemirror/lang-json";
import { invoke } from "@tauri-apps/api/core";
import CodeMirror from "@uiw/react-codemirror";
import { useRef, useState } from "react";
import { getGroups, MihomoWebSocket } from "tauri-plugin-mihomo-api";

import "./App.css";

function App() {
  const [response, setResponse] = useState("");
  const wsRef = useRef<MihomoWebSocket[]>([]);

  async function format_json(text: string) {
    return await invoke<string>("cmd_format_json", { text });
  }

  async function check() {
    try {
      // await upgradeCore();
      const data = await getGroups();
      const formattedJson = await format_json(JSON.stringify(data));
      setResponse(formattedJson);
    } catch (err: any) {
      setResponse(err.toString());
    }
  }

  async function connectMihomoConnectionsWs() {
    try {
      const ws = await MihomoWebSocket.connect_connections();
      ws.addListener((msg) => console.log(msg));
      wsRef.current.push(ws);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function closeMihomoConnectionsWs() {
    wsRef.current.pop()?.close();
  }

  return (
    <main style={{ backgroundColor: "white" }}>
      <div className="row">
        <button type="button" onClick={() => check()}>
          Check
        </button>
        <button type="button" onClick={() => connectMihomoConnectionsWs()}>
          Connect WebSocket
        </button>
        <button type="button" onClick={() => closeMihomoConnectionsWs()}>
          Close WebSocket
        </button>
      </div>
      <CodeMirror
        style={{ marginTop: "10px", textAlign: "left" }}
        width="100%"
        height="85dvh"
        minHeight="480px"
        value={response}
        theme={"dark"}
        extensions={[json()]}
      />
    </main>
  );
}

export default App;
