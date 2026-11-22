#!/usr/bin/env python3
"""
无缓存静态服务器
继承标准 http.server，为所有响应添加 Cache-Control: no-store，
避免浏览器缓存旧版 HTML/JS/JSON 导致页面显示过期数据。
用法：python server_no_cache.py 8000
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    """为所有响应注入禁止缓存头"""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=".")
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"无缓存服务器已启动: http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()


if __name__ == "__main__":
    main()
