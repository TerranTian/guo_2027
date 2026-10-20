"""Exercise build/upload control flow without contacting S3 or using real credentials."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='guo build test ') as folder:
    work = Path(folder)
    shutil.copy2(root / 'run.sh', work / 'run.sh')
    (work / 'dist').mkdir()
    bin_dir = work / 'bin'
    bin_dir.mkdir()
    for name in ['npm', 'aws']:
        stub = bin_dir / name
        stub.write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$0" "$PWD" "$@" >> "$BUILD_TEST_LOG"\n'
                        f'[ "${{BUILD_TEST_FAIL:-}}" != "{name}" ]\n')
        stub.chmod(0o755)
    log = work / 'calls'
    env = {k: v for k, v in os.environ.items() if k not in ['FB_APP_ID', 'FB_APP_SECRET']}
    env.update(PATH=f'{bin_dir}:{env["PATH"]}', BUILD_TEST_LOG=str(log))

    def run(*args, fail=''):
        log.write_text('')
        result = subprocess.run([str(work / 'run.sh'), 'build', *args], cwd='/',
                                env={**env, 'BUILD_TEST_FAIL': fail}, capture_output=True, text=True)
        return result.returncode, log.read_text().splitlines()

    status, calls = run()
    assert status == 0 and str(bin_dir / 'aws') not in calls
    assert calls[1:] == [str(work), 'run', 'build', '--', '--base=./']
    for flag in ['-u', '--upload']:
        status, calls = run(flag)
        assert status == 0 and calls[-7:] == ['s3', '--profile', 'seastar', 'cp',
                                            str(work / 'dist') + '/', 's3://game/guo_2027/content/', '--recursive']
    status, calls = run('-u', fail='npm')
    assert status != 0 and str(bin_dir / 'aws') not in calls
    assert run('-u', fail='aws')[0] != 0
    for argument in ['1.0.0', '--debug', '--unknown']:
        status, calls = run(argument)
        assert status != 0 and not calls
print('PASS: local build, upload flags, failures, invalid arguments, paths with spaces, external cwd')
