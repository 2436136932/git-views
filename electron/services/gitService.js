import fs from 'node:fs'
import path from 'node:path'
import simpleGit from 'simple-git'

function gitAt(repoPath) {
  return simpleGit({ baseDir: repoPath, binary: 'git', maxConcurrentProcesses: 1 })
}

function serializeError(error) {
  return {
    ok: false,
    message: error?.message || 'Git operation failed',
    stack: error?.stack || ''
  }
}

async function run(operation) {
  try {
    const data = await operation()
    return { ok: true, data }
  } catch (error) {
    return serializeError(error)
  }
}

function normalizeStatus(status) {
  return {
    current: status.current,
    tracking: status.tracking,
    ahead: status.ahead,
    behind: status.behind,
    files: status.files.map((file) => ({
      path: file.path,
      index: file.index,
      workingDir: file.working_dir,
      staged: file.index !== ' ' && file.index !== '?',
      unstaged: file.working_dir !== ' ' || file.index === '?'
    }))
  }
}

function normalizeBranches(branchSummary) {
  return {
    current: branchSummary.current,
    all: branchSummary.all
  }
}

function normalizeRemoteBranches(branchSummary) {
  return branchSummary.all.filter((branch) => !branch.endsWith('/HEAD'))
}

function parseWorktreePorcelain(output) {
  const blocks = output.trim().split(/\r?\n\r?\n/).filter(Boolean)
  return blocks.map((block) => {
    const entry = { path: '', branch: '', head: '' }
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) entry.path = line.slice('worktree '.length)
      if (line.startsWith('branch refs/heads/')) entry.branch = line.slice('branch refs/heads/'.length)
      if (line.startsWith('HEAD ')) entry.head = line.slice('HEAD '.length)
    }
    return entry
  })
}

function parseGitState(gitDir, statusOutput) {
  const state = {
    mergeInProgress: false,
    rebaseInProgress: false,
    cherryPickInProgress: false,
    conflicts: [],
    detail: ''
  }

  const has = (name) => fs.existsSync(path.join(gitDir, name))
  state.mergeInProgress = has('MERGE_HEAD')
  state.cherryPickInProgress = has('CHERRY_PICK_HEAD')
  state.rebaseInProgress = has('rebase-apply') || has('rebase-merge')

  const conflictFiles = (statusOutput.files || []).filter((file) => /^(U|AA|DD|AU|UA|DU|UD)/.test(`${file.index}${file.workingDir}`))
  state.conflicts = conflictFiles.map((file) => file.path)

  const hints = []
  if (state.mergeInProgress) hints.push('merge in progress')
  if (state.rebaseInProgress) hints.push('rebase in progress')
  if (state.cherryPickInProgress) hints.push('cherry-pick in progress')
  if (state.conflicts.length > 0) hints.push(`conflicts: ${state.conflicts.length}`)
  state.detail = hints.join(', ')
  return state
}

export function createGitService() {
  return {
    isRepo(repoPath) {
      return run(async () => gitAt(repoPath).checkIsRepo())
    },

    status(repoPath) {
      return run(async () => normalizeStatus(await gitAt(repoPath).status()))
    },

    state(repoPath) {
      return run(async () => {
        const git = gitAt(repoPath)
        const gitDirRaw = await git.revparse(['--git-dir'])
        const gitDir = path.resolve(repoPath, gitDirRaw.trim())
        const status = normalizeStatus(await git.status())
        return parseGitState(gitDir, status)
      })
    },

    diff(repoPath, filePath, staged = false) {
      return run(async () => {
        const args = staged ? ['--cached', '--', filePath] : ['--', filePath]
        return gitAt(repoPath).diff(args)
      })
    },

    stage(repoPath, filePath) {
      return run(async () => gitAt(repoPath).add(filePath))
    },

    stageAll(repoPath) {
      return run(async () => gitAt(repoPath).add('.'))
    },

    unstage(repoPath, filePath) {
      return run(async () => gitAt(repoPath).raw(['restore', '--staged', '--', filePath]))
    },

    unstageAll(repoPath) {
      return run(async () => gitAt(repoPath).raw(['restore', '--staged', '--', '.']))
    },

    commit(repoPath, message) {
      return run(async () => gitAt(repoPath).commit(message))
    },

    pull(repoPath) {
      return run(async () => gitAt(repoPath).pull())
    },

    push(repoPath) {
      return run(async () => gitAt(repoPath).push())
    },

    log(repoPath) {
      return run(async () => gitAt(repoPath).log({ maxCount: 30 }))
    },

    branches(repoPath) {
      return run(async () => normalizeBranches(await gitAt(repoPath).branchLocal()))
    },

    checkoutBranch(repoPath, branchName) {
      return run(async () => gitAt(repoPath).checkout(branchName))
    },

    createBranch(repoPath, branchName) {
      return run(async () => gitAt(repoPath).checkoutLocalBranch(branchName))
    },

    deleteBranch(repoPath, branchName, force = false) {
      return run(async () => gitAt(repoPath).deleteLocalBranch(branchName, force))
    },

    remotes(repoPath) {
      return run(async () => gitAt(repoPath).getRemotes(true))
    },

    remoteBranches(repoPath) {
      return run(async () => normalizeRemoteBranches(await gitAt(repoPath).branch(['-r'])))
    },

    remoteLog(repoPath, refName) {
      return run(async () => gitAt(repoPath).log([refName, '--date=iso', '--max-count=30']))
    },

    pushCurrentBranch(repoPath, remoteName = 'origin') {
      return run(async () => gitAt(repoPath).push(remoteName, 'HEAD', { '--set-upstream': null }))
    },

    deleteRemoteBranch(repoPath, remoteName, branchName) {
      return run(async () => gitAt(repoPath).raw(['push', remoteName, '--delete', branchName]))
    },

    mergeBranch(repoPath, branchName) {
      return run(async () => gitAt(repoPath).merge([branchName]))
    },

    rebaseBranch(repoPath, branchName) {
      return run(async () => gitAt(repoPath).rebase([branchName]))
    },

    continueRebase(repoPath) {
      return run(async () => gitAt(repoPath).raw(['rebase', '--continue']))
    },

    abortRebase(repoPath) {
      return run(async () => gitAt(repoPath).raw(['rebase', '--abort']))
    },

    abortMerge(repoPath) {
      return run(async () => gitAt(repoPath).raw(['merge', '--abort']))
    },

    continueCherryPick(repoPath) {
      return run(async () => gitAt(repoPath).raw(['cherry-pick', '--continue']))
    },

    abortCherryPick(repoPath) {
      return run(async () => gitAt(repoPath).raw(['cherry-pick', '--abort']))
    },

    worktrees(repoPath) {
      return run(async () => parseWorktreePorcelain(await gitAt(repoPath).raw(['worktree', 'list', '--porcelain'])))
    },

    showCommit(repoPath, commitHash) {
      return run(async () => ({
        summary: await gitAt(repoPath).show(['--stat', '--format=fuller', commitHash]),
        diff: await gitAt(repoPath).show([commitHash, '--format='])
      }))
    },

    revertCommit(repoPath, commitHash) {
      return run(async () => gitAt(repoPath).raw(['revert', '--no-edit', commitHash]))
    },

    hardResetToCommit(repoPath, commitHash) {
      return run(async () => gitAt(repoPath).raw(['reset', '--hard', commitHash]))
    }
  }
}
