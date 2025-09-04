# useBroadcast Hook

A React hook for cross-tab communication and leader election using the Broadcast Channel API.

## Installation

```bash
npm install use-broadcast
```

## Usage

```javascript
import { useBroadcast } from 'use-broadcast';

function App() {
  const {
    tabId,
    isLeader,
    connectedTabs,
    serverConnected,
    broadcast,
    sendToLeader,
  } = useBroadcast({ channelName: 'my-app-channel' });

  // ...
}
```
