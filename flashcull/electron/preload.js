const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Custom APIs can go here later
});