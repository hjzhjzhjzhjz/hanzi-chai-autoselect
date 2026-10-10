"""自动打开项目网页：检测运行中的服务器，未启动则自动拉起后打开浏览器。"""

import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEV_PORT, PREVIEW_PORT = 5173, 4173
DEV_URL = f"http://localhost:{DEV_PORT}/"
PREVIEW_URL = f"http://localhost:{PREVIEW_PORT}/"

# bun 可能不在系统 PATH（本项目常见情况），给出常见安装位置
BUN_CANDIDATES = [
    Path.home() / ".bun" / "bin" / "bun.exe",
    Path("C:/bun/bun.exe"),
]


def find_bun() -> str:
    for p in BUN_CANDIDATES:
        if p.exists():
            return str(p)
    return "bun"  # 兜底：依赖 PATH


def port_open(port: int) -> bool:
    """检测端口是否监听，IPv4（127.0.0.1）与 IPv6（::1）都尝试。"""
    for host, family in (("127.0.0.1", socket.AF_INET), ("::1", socket.AF_INET6)):
        with socket.socket(family, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex((host, port)) == 0:
                return True
    return False


def start_dev() -> None:
    print("未检测到运行中的服务器，正在启动开发服务器 ...")
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    subprocess.Popen([find_bun(), "run", "dev"], cwd=ROOT, **kwargs)
    for _ in range(120):
        if port_open(DEV_PORT):
            print("开发服务器已就绪。")
            return
        time.sleep(1)
    sys.exit("开发服务器启动超时（120 秒）")


def main() -> None:
    if port_open(DEV_PORT):
        url = DEV_URL
        print("检测到开发服务器已在运行。")
    elif port_open(PREVIEW_PORT):
        url = PREVIEW_URL
        print("检测到 preview 服务器已在运行。")
    else:
        start_dev()
        url = DEV_URL
    print(f"正在打开 {url}")
    webbrowser.open(url)


if __name__ == "__main__":
    main()
