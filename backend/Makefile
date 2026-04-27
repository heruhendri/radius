.PHONY: build run dev clean

# Build binary (Linux, for VPS deployment)
build:
	GOOS=linux GOARCH=amd64 go build -o bin/server ./cmd/server/...

# Build binary for current OS (dev/testing)
build-local:
	go build -o server ./cmd/server/...

# Run server directly with go run (dev mode, reads ../.env)
dev:
	go run ./cmd/server/...

# Run compiled binary
run: build-local
	./server

# Clean build artifacts
clean:
	rm -f server server.exe
	rm -rf bin/

# Run seed scripts
seed:
	go run ./cmd/seed/...

seed-olt:
	go run ./cmd/seed-olt/...
