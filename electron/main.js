import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { createGitService } from './services/gitService.js'
import pkg from 'electron-updater'
const { autoUpdater } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow

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

  ipcMain.handle('update:startDownload', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('update:checkNow', () => {
    autoUpdater.checkForUpdates()
  })
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
  ipcMain.handle('git:status', (_event, repoPath) => git.status(repoPath))
  ipcMain.handle('git:state', (_event, repoPath) => git.state(repoPath))
  ipcMain.handle('git:diff', (_event, repoPath, filePath, staged) => git.diff(repoPath, filePath, staged))
  ipcMain.handle('git:stage', (_event, repoPath, filePath) => git.stage(repoPath, filePath))
  ipcMain.handle('git:stageAll', (_event, repoPath) => git.stageAll(repoPath))
  ipcMain.handle('git:unstage', (_event, repoPath, filePath) => git.unstage(repoPath, filePath))
  ipcMain.handle('git:unstageAll', (_event, repoPath) => git.unstageAll(repoPath))
  ipcMain.handle('git:commit', (_event, repoPath, message) => git.commit(repoPath, message))
  ipcMain.handle('git:pull', (_event, repoPath) => git.pull(repoPath))
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

  // ── git init ──
  ipcMain.handle('git:init', (_event, repoPath) => git.init(repoPath))
  ipcMain.handle('git:addRemote', (_event, repoPath, name, url) => git.addRemote(repoPath, name, url))
  ipcMain.handle('git:setRemoteUrl', (_event, repoPath, name, url) => git.setRemoteUrl(repoPath, name, url))

  // ── GitHub 仓库信息 ──
  ipcMain.handle('github:info', async (_event, remoteUrl) => {
    if (!remoteUrl) return { ok: false, message: '没有远程仓库 URL' }

    // 解析 GitHub remote URL → owner/repo
    // 支持格式:
    //   https://github.com/owner/repo.git
    //   https://github.com/owner/repo
    //   git@github.com:owner/repo.git
    let match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/)
    if (!match) return { ok: false, message: '不是 GitHub 远程仓库' }

    const owner = match[1]
    const repo = match[2]

    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
      const data = await new Promise((resolve, reject) => {
        https.get(apiUrl, {
          headers: { 'User-Agent': 'git-views/0.1.0' },
          rejectUnauthorized: false
        }, (res) => {
          let body = ''
          res.on('data', chunk => body += chunk)
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(body)) }
              catch (e) { reject(new Error('API 返回格式异常')) }
            } else {
              const msg = res.statusCode === 403
                ? 'GitHub API 返回 403（可能触发了频率限制）'
                : `GitHub API 返回 ${res.statusCode}`
              reject(new Error(msg))
            }
          })
        }).on('error', (err) => {
          const isSslError = err.code === 'CERT_HAS_EXPIRED' || err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || err.message.includes('unable to verify the first certificate')
          const msg = err.code === 'ENOTFOUND'
            ? '无法解析域名 api.github.com（请检查网络）'
            : err.code === 'ECONNREFUSED'
            ? '连接被拒绝（请检查网络/代理）'
            : isSslError
            ? 'SSL 证书验证失败 — 可尝试设置环境变量 NODE_OPTIONS=--use-system-ca 后重启应用'
            : err.message
          reject(new Error(msg))
        })
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
