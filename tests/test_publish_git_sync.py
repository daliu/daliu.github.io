"""Publisher synchronization against local bare remotes; no external publication."""
import subprocess
from pathlib import Path

import pytest

import publish_daily


def git(root, *args, check=True):
    return subprocess.run(['git', '-C', str(root), *args], check=check,
                          capture_output=True, text=True)


def commit(root, message):
    git(root, 'add', '.')
    git(root, 'commit', '-m', message)
    return git(root, 'rev-parse', 'HEAD').stdout.strip()


@pytest.fixture
def repos(tmp_path, monkeypatch):
    monkeypatch.setenv('GIT_CONFIG_NOSYSTEM', '1')
    monkeypatch.setenv('GIT_CONFIG_GLOBAL', '/dev/null')
    remote, seed, local = (tmp_path / name for name in ('remote.git', 'seed', 'local'))
    git(tmp_path, 'init', '--bare', '--initial-branch=master', str(remote))
    git(tmp_path, 'clone', str(remote), str(seed))
    git(seed, 'config', 'user.name', 'Publisher test')
    git(seed, 'config', 'user.email', 'publisher@example.test')
    (seed / 'autotrader/daily/emails').mkdir(parents=True)
    (seed / 'autotrader/daily/index.html').write_text('Earlier archive\n')
    (seed / 'publish_daily.py').write_text('original publisher\n')
    (seed / 'sitemap.xml').write_text('original sitemap\n')
    (seed / 'unrelated.txt').write_text('original unrelated file\n')
    commit(seed, 'baseline')
    git(seed, 'push', '-u', 'origin', 'master')
    git(tmp_path, 'clone', str(remote), str(local))
    git(local, 'config', 'user.name', 'Publisher test')
    git(local, 'config', 'user.email', 'publisher@example.test')
    monkeypatch.chdir(local)
    monkeypatch.setattr(publish_daily, 'SCRIPT_DIR', str(local))
    monkeypatch.setattr(publish_daily, 'refresh_patterns_program', lambda: False)
    assert git(local, 'remote', 'get-url', 'origin').stdout.strip() == str(remote)
    return remote, seed, local


def release(root, message='scoped research release'):
    (root / 'publish_daily.py').write_text('reviewed research publisher\n')
    (root / 'autotrader/daily/index.html').write_text('Dated research archive\n')
    return commit(root, message)


def publication(root):
    path = root / 'autotrader/daily/emails/2026-09-29.html'
    path.parent.mkdir(exist_ok=True)
    path.write_text('Retained loss and pending monthly results\n')
    (root / 'sitemap.xml').write_text('updated sitemap\n')
    return path.read_bytes()


def upstream(seed, remote):
    (seed / 'health').mkdir(exist_ok=True)
    (seed / 'health/data.json').write_text('{"synthetic": true}\n')
    commit(seed, 'unrelated upstream update')
    git(seed, 'push', 'origin', 'master')
    return git(remote, 'rev-parse', 'master').stdout.strip()


def test_scoped_release_survives_upstream_sync(repos):
    remote, seed, local = repos
    release(local)
    payload = publication(local)
    upstream(seed, remote)
    publish_daily.git_commit_and_push('daily research report')
    assert (local / 'publish_daily.py').read_text() == 'reviewed research publisher\n'
    assert (local / 'health/data.json').read_text() == '{"synthetic": true}\n'
    assert (local / 'autotrader/daily/emails/2026-09-29.html').read_bytes() == payload
    assert git(local, 'rev-parse', 'HEAD').stdout == git(remote, 'rev-parse', 'master').stdout
    assert not git(local, 'status', '--porcelain').stdout
    assert 'scoped research release' in git(local, 'log', '--format=%s').stdout


def test_later_upstream_same_patch_does_not_duplicate_or_lose_release(repos):
    remote, seed, local = repos
    release(local)
    publication(local)
    upstream(seed, remote)
    release(seed, 'merged reviewed archive change')
    git(seed, 'push', 'origin', 'master')
    publish_daily.git_commit_and_push('daily research report')
    history = git(local, 'log', '--format=%s').stdout
    assert 'merged reviewed archive change' in history
    assert 'scoped research release' not in history  # Git drops the equivalent patch.
    assert (local / 'publish_daily.py').read_text() == 'reviewed research publisher\n'
    assert git(local, 'rev-parse', 'HEAD').stdout == git(remote, 'rev-parse', 'master').stdout


def test_conflict_retains_release_and_daily_commits_without_reset_or_merge(repos):
    remote, seed, local = repos
    release_sha = release(local)
    publication(local)
    (seed / 'publish_daily.py').write_text('conflicting upstream publisher\n')
    remote_sha = commit(seed, 'conflicting upstream change')
    git(seed, 'push', 'origin', 'master')
    with pytest.raises(RuntimeError, match='local commits retained'):
        publish_daily.git_commit_and_push('daily research report')
    git(local, 'merge-base', '--is-ancestor', release_sha, 'HEAD')
    assert git(local, 'log', '-1', '--format=%s').stdout.strip() == 'daily research report'
    assert (local / 'publish_daily.py').read_text() == 'reviewed research publisher\n'
    assert (local / 'autotrader/daily/emails/2026-09-29.html').exists()
    assert git(remote, 'rev-parse', 'master').stdout.strip() == remote_sha
    assert not (local / '.git/rebase-merge').exists()
    assert not (local / '.git/MERGE_HEAD').exists()
    assert not git(local, 'stash', 'list').stdout


def test_combined_scoped_patch_survives_separate_upstream_commits(repos):
    remote, seed, local = repos
    release(local)
    publication(local)
    upstream(seed, remote)
    (seed / 'publish_daily.py').write_text('reviewed research publisher\n')
    commit(seed, 'upstream publisher part')
    (seed / 'autotrader/daily/index.html').write_text('Dated research archive\n')
    commit(seed, 'upstream archive part')
    git(seed, 'push', 'origin', 'master')
    publish_daily.git_commit_and_push('daily research report')
    assert (local / 'publish_daily.py').read_text() == 'reviewed research publisher\n'
    assert (local / 'autotrader/daily/index.html').read_text() == 'Dated research archive\n'
    assert (local / 'autotrader/daily/emails/2026-09-29.html').exists()
    assert git(local, 'rev-parse', 'HEAD').stdout == git(remote, 'rev-parse', 'master').stdout


def test_rejected_push_can_retry_without_another_content_change(repos):
    remote, _, local = repos
    release(local)
    publication(local)
    hook = remote / 'hooks/pre-receive'
    hook.write_text('#!/bin/sh\nexit 1\n')
    hook.chmod(0o755)
    with pytest.raises(subprocess.CalledProcessError):
        publish_daily.git_commit_and_push('daily research report')
    pending = git(local, 'rev-parse', 'HEAD').stdout
    hook.unlink()
    publish_daily.git_commit_and_push('must not create another report commit')
    assert git(local, 'rev-parse', 'HEAD').stdout == pending
    assert git(remote, 'rev-parse', 'master').stdout == pending


@pytest.mark.parametrize('staged', [False, True])
def test_unrelated_edits_are_neither_stashed_nor_committed(repos, staged):
    _, _, local = repos
    publication(local)
    (local / 'unrelated.txt').write_text('preserve local work\n')
    if staged:
        git(local, 'add', 'unrelated.txt')
    head = git(local, 'rev-parse', 'HEAD').stdout
    index = git(local, 'write-tree').stdout
    with pytest.raises(RuntimeError, match='staged changes|unrelated tracked edits'):
        publish_daily.git_commit_and_push('must not commit')
    assert git(local, 'rev-parse', 'HEAD').stdout == head
    assert git(local, 'write-tree').stdout == index
    assert (local / 'unrelated.txt').read_text() == 'preserve local work\n'
    assert not git(local, 'stash', 'list').stdout


def test_wrong_branch_refused(repos):
    _, _, local = repos
    git(local, 'checkout', '-b', 'another-task')
    publication(local)
    with pytest.raises(RuntimeError, match='master branch'):
        publish_daily.git_commit_and_push('must not publish')
    assert not git(local, 'diff', '--cached', '--name-only').stdout


def test_untracked_upstream_collision_is_preserved(repos):
    remote, seed, local = repos
    publication(local)
    (local / 'health').mkdir()
    (local / 'health/data.json').write_text('untracked local data\n')
    upstream(seed, remote)
    with pytest.raises(RuntimeError, match='local commits retained'):
        publish_daily.git_commit_and_push('daily research report')
    assert (local / 'health/data.json').read_text() == 'untracked local data\n'
    assert (local / 'autotrader/daily/emails/2026-09-29.html').exists()


def test_no_new_report_still_syncs_upstream(repos):
    remote, seed, local = repos
    expected = upstream(seed, remote)
    publish_daily.git_commit_and_push('no new report')
    assert git(local, 'rev-parse', 'HEAD').stdout.strip() == expected
    assert git(remote, 'rev-parse', 'master').stdout.strip() == expected
