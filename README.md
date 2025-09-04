# useBroadcast Hook

A React hook for cross-tab communication and leader election using the Broadcast Channel API.

## Installation

```bash
npm install @iampoul/usebroadcast
```

## Usage

```jsx
import React, { useEffect } from 'react';
import { useBroadcast } from 'use-broadcast';

function App() {
  const {
    tabId,
    isLeader,
    connectedTabs,
    serverConnected,
    setServerConnected,
    broadcast,
    sendToLeader,
    registerMessageHandler,
  } = useBroadcast({ channelName: 'my-app-channel' });

  useEffect(() => {
    // Example of a custom message handler
    const unregister = registerMessageHandler('my_custom_message', (payload) => {
      console.log(`Received custom message from tab ${payload.senderId}:`, payload.payload);
    });

    // Example of a message handler for messages sent to the leader
    const unregisterLeader = registerMessageHandler('my_leader_message', (payload) => {
      if (isLeader) {
        console.log(`Leader received message:`, payload);
      }
    });

    return () => {
      unregister();
      unregisterLeader();
    };
  }, [registerMessageHandler, isLeader]);

  const handleSendMessage = () => {
    broadcast('my_custom_message', { text: 'Hello from another tab!' });
  };

  const handleSendToLeader = () => {
    sendToLeader('my_leader_message', { task: 'do something important' });
  };

  return (
    <div>
      <h1>useBroadcast Example</h1>
      <p>Tab ID: {tabId}</p>
      <p>Is Leader: {isLeader ? 'Yes' : 'No'}</p>
      <p>Server Connected: {serverConnected ? 'Yes' : 'No'}</p>
      <button onClick={() => setServerConnected(!serverConnected)}>
        Toggle Server Connection
      </button>
      <h2>Connected Tabs:</h2>
      <ul>
        {connectedTabs.map((tab) => (
          <li key={tab.id}>
            {tab.id} {tab.isLeader ? '(Leader)' : ''} - Last Seen: {new Date(tab.lastSeen).toLocaleTimeString()}
          </li>
        ))}
      </ul>
      <button onClick={handleSendMessage}>Send Custom Message to All Tabs</button>
      <button onClick={handleSendToLeader}>Send Message to Leader</button>
    </div>
  );
}

export default App;
```

## Return Values

The `useBroadcast` hook returns an object with the following properties:

*   `tabId`: A unique identifier for the current tab.
*   `isLeader`: A boolean that is `true` if the current tab is the leader, and `false` otherwise.
*   `connectedTabs`: An array of objects, where each object represents a connected tab and has the following properties:
    *   `id`: The unique identifier of the tab.
    *   `isLeader`: A boolean that is `true` if the tab is the leader, and `false` otherwise.
    *   `lastSeen`: The timestamp of the last time the tab was seen.
*   `serverConnected`: A boolean that represents the status of the server connection. This is not managed by the hook, but is provided as a convenience for the user to track the server connection status.
*   `setServerConnected`: A function that takes a boolean and sets the `serverConnected` state.
*   `broadcast`: A function that takes a `type` and a `payload` and sends a message to all connected tabs.
*   `sendToLeader`: A function that takes a `type` and a `payload` and sends a message to the leader tab.
*   `registerMessageHandler`: A function that takes a `type` and a `handler` and registers a handler for a specific message type. It returns a function that can be called to unregister the handler.

## Author

*   **Poul Poulsen** - [https://x.com/iampoul](https://x.com/iampoul)
