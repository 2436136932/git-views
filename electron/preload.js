import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktopApi', {
  selectRepo: () => ipcRenderer.invoke('repo:select'),
  git: {
    isRepo: (repoPath) => ipcRenderer.invoke('git:isRepo', repoPath),
    status: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
    diff: (repoPath, filePath, staged = false) => ipcRenderer.invoke('git:diff', repoPath, filePath, staged),
    stage: (repoPath, filePath) => ipcRenderer.invoke('git:stage', repoPath, filePath),
    unstage: (repoPath, filePath) => ipcRenderer.invoke('git:unstage', repoPath, filePath),
    commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
    pull: (repoPath) => ipcRenderer.invoke('git:pull', repoPath),
    push: (repoPath) => ipcRenderer.invoke('git:push', repoPath),
    log: (repoPath) => ipcRenderer.invoke('git:log', repoPath)
  }
})
