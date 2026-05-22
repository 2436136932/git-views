import { app, BrowserWindow, dialog, ipcMain } from 'electron'
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
      preload: path.join(__dirname, 'preload.js'),
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

  const git = createGitService()
  ipcMain.handle('git:isRepo', (_event, repoPath) => git.isRepo(repoPath))
  ipcMain.handle('git:status', (_event, repoPath) => git.status(repoPath))
  ipcMain.handle('git:diff', (_event, repoPath, filePath, staged) => git.diff(repoPath, filePath, staged))
  ipcMain.handle('git:stage', (_event, repoPath, filePath) => git.stage(repoPath, filePath))
  ipcMain.handle('git:unstage', (_event, repoPath, filePath) => git.unstage(repoPath, filePath))
  ipcMain.handle('git:commit', (_event, repoPath, message) => git.commit(repoPath, message))
  ipcMain.handle('git:pull', (_event, repoPath) => git.pull(repoPath))
  ipcMain.handle('git:push', (_event, repoPath) => git.push(repoPath))
  ipcMain.handle('git:log', (_event, repoPath) => git.log(repoPath))
}
