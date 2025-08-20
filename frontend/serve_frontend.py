from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

class FrontendHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

if __name__ == '__main__':
    port = 8080
    server = HTTPServer(('0.0.0.0', port), FrontendHandler)
    print(f"Serving frontend on http://localhost:{port}")
    server.serve_forever()
import http.server
import socketserver
import os

PORT = 8080
WEB_DIR = os.path.join(os.path.dirname(__file__))
os.chdir(WEB_DIR)

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving frontend at http://localhost:{PORT}")
        httpd.serve_forever()
