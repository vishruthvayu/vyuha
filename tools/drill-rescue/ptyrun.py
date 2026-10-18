#!/usr/bin/env python3
"""Run a command under a real pseudo-terminal and record its output verbatim.

Test harness only; lives outside the repository under test.

  ptyrun.py --log OUT --meta META --stop-file STOP [--secret-file F] -- cmd args...

* Everything the command prints to the terminal is appended to OUT unmodified.
* If the terminal shows a hidden-password prompt matching "password" and
  --secret-file is given, the file's first line is typed followed by Enter.
* When STOP appears, a literal Ctrl+C (0x03) is typed into the terminal, the
  same thing a person does at the keyboard. A second one follows after 15 s if
  the command is still alive.
* META receives harness-side notes (timestamps, exit status) so OUT stays a
  pure transcript.
"""
import argparse, fcntl, os, pty, select, signal, struct, sys, termios, time


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--log', required=True)
    p.add_argument('--meta', required=True)
    p.add_argument('--stop-file', required=True)
    p.add_argument('--secret-file')
    p.add_argument('--cwd', required=True)
    p.add_argument('cmd', nargs=argparse.REMAINDER)
    a = p.parse_args()
    cmd = a.cmd[1:] if a.cmd and a.cmd[0] == '--' else a.cmd
    secret = None
    if a.secret_file:
        with open(a.secret_file) as f:
            secret = f.readline().rstrip('\n')

    def note(msg):
        with open(a.meta, 'a') as m:
            m.write(f"{time.strftime('%Y-%m-%d %H:%M:%S %z')} {msg}\n")

    if os.path.exists(a.stop_file):
        os.unlink(a.stop_file)
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(a.cwd)
        os.execvp(cmd[0], cmd)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 140, 0, 0))
    note(f"started pid={pid} cwd={a.cwd} cmd={' '.join(cmd)}")
    out = open(a.log, 'ab', buffering=0)
    tail = b''
    answered = 0
    interrupts = 0
    last_interrupt = 0.0
    status = None
    while True:
        try:
            r, _, _ = select.select([fd], [], [], 0.25)
        except InterruptedError:
            continue
        if r:
            try:
                data = os.read(fd, 65536)
            except OSError:
                data = b''
            if not data:
                break
            out.write(data)
            tail = (tail + data)[-400:]
            if secret is not None and answered < 2:
                low = tail.lower()
                want = b'confirm officer password:' if answered == 1 else b'officer password (12+ characters):'
                if want in low:
                    time.sleep(0.4)  # getpass flushes pending input when it disables echo
                    os.write(fd, secret.encode() + b'\n')
                    answered += 1
                    tail = b''
                    note(f"typed hidden password answer #{answered} (value not logged)")
        if os.path.exists(a.stop_file):
            now = time.time()
            if interrupts == 0 or (interrupts < 3 and now - last_interrupt > 15):
                os.write(fd, b'\x03')
                interrupts += 1
                last_interrupt = now
                note(f"typed Ctrl+C #{interrupts}")
        done, st = os.waitpid(pid, os.WNOHANG)
        if done:
            status = st
            # drain whatever is left
            while True:
                r, _, _ = select.select([fd], [], [], 0.2)
                if not r:
                    break
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    break
                if not data:
                    break
                out.write(data)
            break
    if status is None:
        _, status = os.waitpid(pid, 0)
    if os.WIFSIGNALED(status):
        note(f"exited: killed by signal {os.WTERMSIG(status)} ({signal.Signals(os.WTERMSIG(status)).name})")
    else:
        note(f"exited: status {os.WEXITSTATUS(status)}")
    if os.path.exists(a.stop_file):
        os.unlink(a.stop_file)


if __name__ == '__main__':
    main()
