const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopApi', {
  selectRepo: () => ipcRenderer.invoke('repo:select'),
  openPath: (targetPath) => ipcRenderer.invoke('path:open', targetPath),
  git: {
    isRepo: (repoPath) => ipcRenderer.invoke('git:isRepo', repoPath),
    init: (repoPath) => ipcRenderer.invoke('git:init', repoPath),
    addRemote: (repoPath, name, url) => ipcRenderer.invoke('git:addRemote', repoPath, name, url),
    setRemoteUrl: (repoPath, name, url) => ipcRenderer.invoke('git:setRemoteUrl', repoPath, name, url),
    status: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
    state: (repoPath) => ipcRenderer.invoke('git:state', repoPath),
    diff: (repoPath, filePath, staged = false) => ipcRenderer.invoke('git:diff', repoPath, filePath, staged),
    stage: (repoPath, filePath) => ipcRenderer.invoke('git:stage', repoPath, filePath),
    stageAll: (repoPath) => ipcRenderer.invoke('git:stageAll', repoPath),
    unstage: (repoPath, filePath) => ipcRenderer.invoke('git:unstage', repoPath, filePath),
    unstageAll: (repoPath) => ipcRenderer.invoke('git:unstageAll', repoPath),
    commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
    pull: (repoPath) => ipcRenderer.invoke('git:pull', repoPath),
    push: (repoPath) => ipcRenderer.invoke('git:push', repoPath),
    log: (repoPath) => ipcRenderer.invoke('git:log', repoPath),
    branches: (repoPath) => ipcRenderer.invoke('git:branches', repoPath),
    remoteBranches: (repoPath) => ipcRenderer.invoke('git:remoteBranches', repoPath),
    remoteLog: (repoPath, refName) => ipcRenderer.invoke('git:remoteLog', repoPath, refName),
    checkoutBranch: (repoPath, branchName) => ipcRenderer.invoke('git:checkoutBranch', repoPath, branchName),
    createBranch: (repoPath, branchName) => ipcRenderer.invoke('git:createBranch', repoPath, branchName),
    deleteBranch: (repoPath, branchName, force = false) => ipcRenderer.invoke('git:deleteBranch', repoPath, branchName, force),
    remotes: (repoPath) => ipcRenderer.invoke('git:remotes', repoPath),
    pushCurrentBranch: (repoPath, remoteName) => ipcRenderer.invoke('git:pushCurrentBranch', repoPath, remoteName),
    deleteRemoteBranch: (repoPath, remoteName, branchName) => ipcRenderer.invoke('git:deleteRemoteBranch', repoPath, remoteName, branchName),
    worktrees: (repoPath) => ipcRenderer.invoke('git:worktrees', repoPath),
    mergeBranch: (repoPath, branchName) => ipcRenderer.invoke('git:mergeBranch', repoPath, branchName),
    rebaseBranch: (repoPath, branchName) => ipcRenderer.invoke('git:rebaseBranch', repoPath, branchName),
    continueRebase: (repoPath) => ipcRenderer.invoke('git:continueRebase', repoPath),
    abortRebase: (repoPath) => ipcRenderer.invoke('git:abortRebase', repoPath),
    abortMerge: (repoPath) => ipcRenderer.invoke('git:abortMerge', repoPath),
    continueCherryPick: (repoPath) => ipcRenderer.invoke('git:continueCherryPick', repoPath),
    abortCherryPick: (repoPath) => ipcRenderer.invoke('git:abortCherryPick', repoPath),
    showCommit: (repoPath, commitHash) => ipcRenderer.invoke('git:showCommit', repoPath, commitHash),
    revertCommit: (repoPath, commitHash) => ipcRenderer.invoke('git:revertCommit', repoPath, commitHash),
    hardResetToCommit: (repoPath, commitHash) => ipcRenderer.invoke('git:hardResetToCommit', repoPath, commitHash),
    readFile: (repoPath, filePath) => ipcRenderer.invoke('git:readFile', repoPath, filePath)
  },

  // ── GitHub 仓库信息 ──
  github: {
    info: (remoteUrl) => ipcRenderer.invoke('github:info', remoteUrl)
  },

  // ── 自动更新 ──
  update: {
    onChecking: (callback) => {
      ipcRenderer.on('update:checking', () => callback())
    },
    onAvailable: (callback) => {
      ipcRenderer.on('update:available', (_event, info) => callback(info))
    },
    onNotAvailable: (callback) => {
      ipcRenderer.on('update:not-available', () => callback())
    },
    onProgress: (callback) => {
      ipcRenderer.on('update:progress', (_event, progress) => callback(progress))
    },
    onDownloaded: (callback) => {
      ipcRenderer.on('update:downloaded', () => callback())
    },
    onError: (callback) => {
      ipcRenderer.on('update:error', (_event, message) => callback(message))
    },
    startDownload: () => ipcRenderer.invoke('update:startDownload'),
    install: () => ipcRenderer.invoke('update:install'),
    checkNow: () => ipcRenderer.invoke('update:checkNow')
  }
})
