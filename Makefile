# Builds the Go bindings to WebAssembly and vendors the matching Go JS runtime
# (wasm_exec.js) into src/runtime/, where the TypeScript loader and tsdown pick
# them up. Re-run `make wasm` whenever the Go sources change.

GOROOT := $(shell go env GOROOT)
OUT := src/runtime

# wasm_exec.js moved from misc/wasm to lib/wasm in Go 1.24.
WASM_EXEC := $(firstword $(wildcard $(GOROOT)/lib/wasm/wasm_exec.js $(GOROOT)/misc/wasm/wasm_exec.js))

.PHONY: wasm clean

wasm: $(OUT)/iso9660.wasm $(OUT)/wasm_exec.js

$(OUT)/iso9660.wasm: $(wildcard js/*.go) $(wildcard *.go)
	@mkdir -p $(OUT)
	@echo "> Building iso9660.wasm (GOOS=js GOARCH=wasm)..."
	GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o $@ ./js

$(OUT)/wasm_exec.js: $(WASM_EXEC)
	@mkdir -p $(OUT)
	@echo "> Vendoring wasm_exec.js from $(WASM_EXEC)"
	cp $(WASM_EXEC) $@
	@# The upstream file is an IIFE that assigns globalThis.Go. Re-export it so
	@# the loader can import it as an ES module (and bundlers keep the side effect).
	@printf '\n// Added by Makefile — expose the Go runtime as an ES export.\nexport const Go = globalThis.Go;\n' >> $@

clean:
	rm -f $(OUT)/iso9660.wasm $(OUT)/wasm_exec.js
