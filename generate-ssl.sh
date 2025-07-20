#!/bin/bash

# Create a directory for SSL certificates
mkdir -p ssl

# Generate private key
openssl genrsa -out ssl/server.key 2048

# Generate certificate signing request
openssl req -new -key ssl/server.key -out ssl/server.csr -subj "/C=US/ST=Local/L=Local/O=TwinSpark/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in ssl/server.csr -signkey ssl/server.key -out ssl/server.crt

# Create certificate with Subject Alternative Names for better browser compatibility
cat > ssl/server.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Local
L = Local
O = TwinSpark
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
EOF

# Generate new certificate with SAN
openssl req -new -x509 -key ssl/server.key -out ssl/server.crt -days 365 -config ssl/server.conf -extensions v3_req

echo "SSL certificates generated in ssl/ directory"
echo "You'll need to add ssl/server.crt as a trusted certificate in your browser"
