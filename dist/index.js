"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useState, useEffect, useRef, useCallback } from "react";
import { BroadcastChannel, createLeaderElection } from "broadcast-channel";
export function useBroadcast(options) {
    var channelName = options.channelName, _a = options.heartbeatInterval, heartbeatInterval = _a === void 0 ? 1000 : _a, _b = options.staleThreshold, staleThreshold = _b === void 0 ? 3000 : _b;
    var tabId = useState(function () { return Math.random().toString(36).substr(2, 9); })[0];
    var _c = useState(false), isLeader = _c[0], setIsLeader = _c[1];
    var _d = useState([]), connectedTabs = _d[0], setConnectedTabs = _d[1];
    var _e = useState(false), serverConnected = _e[0], setServerConnected = _e[1];
    var channelRef = useRef(null);
    var electorRef = useRef(null);
    var heartbeatRef = useRef(null);
    var messageHandlersRef = useRef(new Map());
    var broadcast = useCallback(function (type, payload) {
        var _a;
        (_a = channelRef.current) === null || _a === void 0 ? void 0 : _a.postMessage({
            type: type,
            senderId: tabId,
            ts: Date.now(),
            payload: payload,
        });
    }, [tabId]);
    var sendToLeader = useCallback(function (type, payload) {
        broadcast("message_to_leader", { messageType: type, payload: payload });
    }, [broadcast]);
    var registerMessageHandler = useCallback(function (type, handler) {
        messageHandlersRef.current.set(type, handler);
        return function () { return messageHandlersRef.current.delete(type); };
    }, []);
    useEffect(function () {
        var _a;
        try {
            channelRef.current = new BroadcastChannel(channelName);
            electorRef.current = createLeaderElection(channelRef.current);
        }
        catch (e) {
            console.error("BroadcastChannel is not supported in this environment.");
            // Provide a fallback to localStorage
            // This is a simplified implementation and doesn't support all features
            var listeners_1 = new Map();
            channelRef.current = {
                postMessage: function (data) {
                    localStorage.setItem(channelName, JSON.stringify(data));
                },
                addEventListener: function (type, listener) {
                    var storageListener = function (event) {
                        if (event.key === channelName && event.newValue) {
                            listener({ data: JSON.parse(event.newValue) });
                        }
                    };
                    window.addEventListener("storage", storageListener);
                    listeners_1.set(type, storageListener);
                },
                removeEventListener: function (type) {
                    var storageListener = listeners_1.get(type);
                    if (storageListener) {
                        window.removeEventListener("storage", storageListener);
                    }
                },
                close: function () {
                    listeners_1.forEach(function (listener) {
                        window.removeEventListener("storage", listener);
                    });
                },
            };
        }
        setConnectedTabs([{ id: tabId, isLeader: false, lastSeen: Date.now() }]);
        var handleMessage = function (event) {
            var _a = event.data, type = _a.type, senderId = _a.senderId, ts = _a.ts, payload = _a.payload;
            if (senderId === tabId)
                return; // Ignore messages from self
            // Update last seen time for the sender
            setConnectedTabs(function (prev) {
                var now = Date.now();
                var cleanedTabs = prev.filter(function (t) { return now - t.lastSeen < staleThreshold; });
                var existing = cleanedTabs.find(function (t) { return t.id === senderId; });
                if (existing) {
                    return cleanedTabs.map(function (t) { return t.id === senderId ? __assign(__assign({}, t), { lastSeen: ts }) : t; });
                }
                else {
                    return __spreadArray(__spreadArray([], cleanedTabs, true), [{ id: senderId, isLeader: false, lastSeen: ts }], false);
                }
            });
            switch (type) {
                case "leader_elected":
                    setIsLeader(false); // Another tab became leader
                    setConnectedTabs(function (prev) { return prev.map(function (t) { return (__assign(__assign({}, t), { isLeader: t.id === payload.leaderId })); }); });
                    break;
                case "message_to_leader":
                    if (isLeader) {
                        var handler_1 = messageHandlersRef.current.get(payload.messageType);
                        if (handler_1) {
                            handler_1(payload.payload);
                        }
                    }
                    break;
                case "heartbeat":
                    // Already handled above
                    break;
                case "tab_left":
                    setConnectedTabs(function (prev) { return prev.filter(function (t) { return t.id !== senderId; }); });
                    break;
                default:
                    var handler = messageHandlersRef.current.get(type);
                    if (handler) {
                        handler(payload);
                    }
                    break;
            }
        };
        (_a = channelRef.current) === null || _a === void 0 ? void 0 : _a.addEventListener("message", handleMessage);
        var elector = electorRef.current;
        if (elector) {
            elector.awaitLeadership().then(function () {
                setIsLeader(true);
                broadcast("leader_elected", { leaderId: tabId });
                setConnectedTabs(function (prev) { return prev.map(function (t) { return (__assign(__assign({}, t), { isLeader: t.id === tabId })); }); });
            });
        }
        var handleBeforeUnload = function () {
            broadcast("tab_left");
            elector === null || elector === void 0 ? void 0 : elector.die();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        // Set up heartbeat
        heartbeatRef.current = setInterval(function () {
            broadcast("heartbeat");
        }, heartbeatInterval);
        return function () {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (channelRef.current) {
                channelRef.current.removeEventListener("message", handleMessage);
                channelRef.current.close();
            }
            elector === null || elector === void 0 ? void 0 : elector.die();
            if (heartbeatRef.current)
                clearInterval(heartbeatRef.current);
        };
    }, [channelName, tabId, heartbeatInterval, staleThreshold, broadcast, isLeader]);
    return {
        tabId: tabId,
        isLeader: isLeader,
        connectedTabs: connectedTabs,
        serverConnected: serverConnected,
        setServerConnected: setServerConnected,
        broadcast: broadcast,
        sendToLeader: sendToLeader,
        registerMessageHandler: registerMessageHandler,
    };
}
