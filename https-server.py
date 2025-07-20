#!/usr/bin/env python3
import http.server
import ssl
import os
import sys
from pathlib import Path

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    port = 3000
    ssl_dir = Path('ssl')
    cert_file = ssl_dir / 'server.crt'
    key_file = ssl_dir / 'server.key'
    
    # Check if SSL certificates exist
    if not cert_file.exists() or not key_file.exists():
        print("SSL certificates not found!")
        print("Please run ./generate-ssl.sh first to create SSL certificates.")
        sys.exit(1)
    
    # Create server
    server_address = ('', port)
    httpd = http.server.HTTPServer(server_address, CORSHTTPRequestHandler)
    
    # Create SSL context
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(str(cert_file), str(key_file))
    
    # Wrap socket with SSL
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"HTTPS server starting on https://localhost:{port}/")
    print("Note: Your browser will show a security warning for the self-signed certificate.")
    print("Click 'Advanced' then 'Proceed to localhost (unsafe)' to continue.")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
        httpd.shutdown()

if __name__ == '__main__':
    main()
