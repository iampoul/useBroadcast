export interface TabInfo {
    id: string;
    isLeader: boolean;
    lastSeen: number;
}
export interface BroadcastOptions {
    channelName: string;
    heartbeatInterval?: number;
    staleThreshold?: number;
}
export interface BroadcastHook {
    tabId: string;
    isLeader: boolean;
    connectedTabs: TabInfo[];
    serverConnected: boolean;
    setServerConnected: (isConnected: boolean) => void;
    broadcast: (type: string, payload?: any) => void;
    sendToLeader: (type: string, payload: any) => void;
    registerMessageHandler: (type: string, handler: (payload: any) => void) => () => void;
}
export declare function useBroadcast(options: BroadcastOptions): BroadcastHook;
