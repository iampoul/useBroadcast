# useBroadcast Hook

A React hook for cross-tab communication and leader election using the Broadcast Channel API.

## Installation

```bash
npm install use-broadcast
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
