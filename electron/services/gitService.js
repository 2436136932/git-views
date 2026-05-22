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

export function createGitService() {
  return {
    isRepo(repoPath) {
      return run(async () => gitAt(repoPath).checkIsRepo())
    },

    status(repoPath) {
      return run(async () => normalizeStatus(await gitAt(repoPath).status()))
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

    unstage(repoPath, filePath) {
      return run(async () => gitAt(repoPath).raw(['restore', '--staged', '--', filePath]))
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
    }
  }
}
