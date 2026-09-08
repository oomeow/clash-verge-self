import type { ConnectionInfo } from "./ConnectionInfo";
/**
 * connections
 */
export type Connections = {
    downloadTotal: number;
    uploadTotal: number;
    connections: Array<ConnectionInfo> | null;
    memory: number;
};
