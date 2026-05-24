import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGitService } from './services/gitService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f5f2eb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpcHandlers() {
  ipcMain.handle('repo:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('path:open', async (_event, targetPath) => {
    const errorMessage = await shell.openPath(targetPath)
    if (errorMessage) return { ok: false, message: errorMessage }
    return { ok: true }
  })

  const git = createGitService()
  ipcMain.handle('git:isRepo', (_event, repoPath) => git.isRepo(repoPath))
  ipcMain.handle('git:status', (_event, repoPath) => git.status(repoPath))
  ipcMain.handle('git:state', (_event, repoPath) => git.state(repoPath))
  ipcMain.handle('git:diff', (_event, repoPath, filePath, staged) => git.diff(repoPath, filePath, staged))
  ipcMain.handle('git:stage', (_event, repoPath, filePath) => git.stage(repoPath, filePath))
  ipcMain.handle('git:stageAll', (_event, repoPath) => git.stageAll(repoPath))
  ipcMain.handle('git:unstage', (_event, repoPath, filePath) => git.unstage(repoPath, filePath))
  ipcMain.handle('git:unstageAll', (_event, repoPath) => git.unstageAll(repoPath))
  ipcMain.handle('git:commit', (_event, repoPath, message) => git.commit(repoPath, message))
  ipcMain.handle('git:pull', (_event, repoPath) => git.pull(repoPath))
  ipcMain.handle('git:push', (_event, repoPath) => git.push(repoPath))
  ipcMain.handle('git:log', (_event, repoPath) => git.log(repoPath))
  ipcMain.handle('git:branches', (_event, repoPath) => git.branches(repoPath))
  ipcMain.handle('git:remoteBranches', (_event, repoPath) => git.remoteBranches(repoPath))
  ipcMain.handle('git:remoteLog', (_event, repoPath, refName) => git.remoteLog(repoPath, refName))
  ipcMain.handle('git:checkoutBranch', (_event, repoPath, branchName) => git.checkoutBranch(repoPath, branchName))
  ipcMain.handle('git:createBranch', (_event, repoPath, branchName) => git.createBranch(repoPath, branchName))
  ipcMain.handle('git:deleteBranch', (_event, repoPath, branchName, force) => git.deleteBranch(repoPath, branchName, force))
  ipcMain.handle('git:remotes', (_event, repoPath) => git.remotes(repoPath))
  ipcMain.handle('git:pushCurrentBranch', (_event, repoPath, remoteName) => git.pushCurrentBranch(repoPath, remoteName))
  ipcMain.handle('git:deleteRemoteBranch', (_event, repoPath, remoteName, branchName) => git.deleteRemoteBranch(repoPath, remoteName, branchName))
  ipcMain.handle('git:worktrees', (_event, repoPath) => git.worktrees(repoPath))
  ipcMain.handle('git:mergeBranch', (_event, repoPath, branchName) => git.mergeBranch(repoPath, branchName))
  ipcMain.handle('git:rebaseBranch', (_event, repoPath, branchName) => git.rebaseBranch(repoPath, branchName))
  ipcMain.handle('git:continueRebase', (_event, repoPath) => git.continueRebase(repoPath))
  ipcMain.handle('git:abortRebase', (_event, repoPath) => git.abortRebase(repoPath))
  ipcMain.handle('git:abortMerge', (_event, repoPath) => git.abortMerge(repoPath))
  ipcMain.handle('git:continueCherryPick', (_event, repoPath) => git.continueCherryPick(repoPath))
  ipcMain.handle('git:abortCherryPick', (_event, repoPath) => git.abortCherryPick(repoPath))
  ipcMain.handle('git:showCommit', (_event, repoPath, commitHash) => git.showCommit(repoPath, commitHash))
  ipcMain.handle('git:revertCommit', (_event, repoPath, commitHash) => git.revertCommit(repoPath, commitHash))
  ipcMain.handle('git:hardResetToCommit', (_event, repoPath, commitHash) => git.hardResetToCommit(repoPath, commitHash))
}
