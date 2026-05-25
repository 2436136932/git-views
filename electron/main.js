import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import pkg from 'electron-updater'
import { createGitService } from './services/gitService.js'

const { autoUpdater } = pkg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow

function parseGitHubRemote(remoteUrl) {
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, (response) => {
      let body = ''

      response.on('data', (chunk) => {
        body += chunk
      })

      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(body))
          } catch {
            reject(new Error('API 返回了无法解析的 JSON。'))
          }
          return
        }

        if (response.statusCode === 403) {
          reject(new Error('GitHub API 返回 403，可能触发了频率限制。'))
          return
        }

        reject(new Error(`GitHub API 返回 ${response.statusCode}`))
      })
    })

    request.on('error', (error) => {
      if (error.code === 'ENOTFOUND') {
        reject(new Error('无法解析 api.github.com，请检查网络连接。'))
        return
      }

      if (error.code === 'ECONNREFUSED') {
        reject(new Error('连接 GitHub 被拒绝，请检查网络或代理设置。'))
        return
      }

      const isSslError = error.code === 'CERT_HAS_EXPIRED' ||
        error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        error.message.includes('unable to verify the first certificate')

      if (isSslError) {
        reject(new Error('GitHub SSL 证书校验失败，请检查系统证书或网络代理。'))
        return
      }

      reject(new Error(error.message))
    })
  })
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded')
  })

  autoUpdater.on('error', (error) => {
    mainWindow?.webContents.send('update:error', error.message)
  })

  ipcMain.handle('update:startDownload', () => autoUpdater.downloadUpdate())
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall(false, true))
  ipcMain.handle('update:checkNow', () => autoUpdater.checkForUpdates())
}

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
  setupAutoUpdater()
  createWindow()

  if (!isDev) {
    autoUpdater.checkForUpdates()
  }

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
  ipcMain.handle('git:init', (_event, repoPath) => git.init(repoPath))
  ipcMain.handle('git:addRemote', (_event, repoPath, name, url) => git.addRemote(repoPath, name, url))
  ipcMain.handle('git:setRemoteUrl', (_event, repoPath, name, url) => git.setRemoteUrl(repoPath, name, url))
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
  ipcMain.handle('git:readFile', (_event, repoPath, filePath) => git.readFileContent(repoPath, filePath))

  ipcMain.handle('github:info', async (_event, remoteUrl) => {
    if (!remoteUrl) return { ok: false, message: '没有远程仓库 URL。' }

    const parsed = parseGitHubRemote(remoteUrl)
    if (!parsed) return { ok: false, message: '当前远程仓库不是 GitHub 仓库。' }

    try {
      const data = await requestJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
        'User-Agent': 'git-views/0.1.1'
      })

      return {
        ok: true,
        data: {
          fullName: data.full_name,
          description: data.description || '',
          stars: data.stargazers_count ?? 0,
          forks: data.forks_count ?? 0,
          language: data.language || '',
          openIssues: data.open_issues_count ?? 0
        }
      }
    } catch (error) {
      return { ok: false, message: `无法连接 GitHub: ${error.message}` }
    }
  })
}
