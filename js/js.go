//go:build js && wasm

package main

import (
	"bytes"
	"sync"
	"syscall/js"

	iso9660 "github.com/thev1sta/iso9660-wasm"
)

// Live ImageWriter instances are kept in a registry keyed by an opaque integer
// handle, because Go pointers cannot be handed to JavaScript directly. Each
// call from JS references its writer by this handle.
var (
	mu       sync.Mutex
	writers  = make(map[int]*iso9660.ImageWriter)
	handleID int
)

func main() {
	api := jsObject()
	api.Set("newWriter", js.FuncOf(newWriter))
	api.Set("addFile", js.FuncOf(addFile))
	api.Set("write", js.FuncOf(write))
	api.Set("cleanup", js.FuncOf(cleanup))
	js.Global().Set("__iso9660wasm", api)

	// Block forever so the exported callbacks stay alive for the JS runtime.
	select {}
}

// lookup resolves a writer handle (the first argument of a call) to its
// ImageWriter instance.
func lookup(handle js.Value) (*iso9660.ImageWriter, bool) {
	mu.Lock()
	defer mu.Unlock()
	w, ok := writers[handle.Int()]
	return w, ok
}

// newWriter() -> { handle: number } | { error: string }
func newWriter(_ js.Value, _ []js.Value) any {
	w, err := iso9660.NewWriter()
	if err != nil {
		return errorResult(err)
	}

	mu.Lock()
	handleID++
	id := handleID
	writers[id] = w
	mu.Unlock()

	res := jsObject()
	res.Set("handle", id)
	return res
}

// addFile(handle: number, path: string, data: Uint8Array) -> { error?: string }
func addFile(_ js.Value, args []js.Value) any {
	if len(args) < 3 {
		return errorString("addFile expects (handle, path, data)")
	}

	w, ok := lookup(args[0])
	if !ok {
		return errorString("invalid writer handle")
	}

	path := args[1].String()
	data := args[2]
	buf := make([]byte, data.Get("length").Int())
	js.CopyBytesToGo(buf, data)

	if err := w.AddFile(bytes.NewReader(buf), path); err != nil {
		return errorResult(err)
	}
	return jsObject()
}

// write(handle: number, volumeId: string) -> { data: Uint8Array } | { error: string }
func write(_ js.Value, args []js.Value) any {
	if len(args) < 2 {
		return errorString("write expects (handle, volumeId)")
	}

	w, ok := lookup(args[0])
	if !ok {
		return errorString("invalid writer handle")
	}
	volumeID := args[1].String()

	var buf bytes.Buffer
	if err := w.WriteTo(&buf, volumeID); err != nil {
		return errorResult(err)
	}

	out := buf.Bytes()
	arr := uint8Array(len(out))
	js.CopyBytesToJS(arr, out)

	res := jsObject()
	res.Set("data", arr)
	return res
}

// cleanup(handle: number) -> { error?: string }
func cleanup(_ js.Value, args []js.Value) any {
	if len(args) < 1 {
		return errorString("cleanup expects (handle)")
	}

	id := args[0].Int()

	mu.Lock()
	w, ok := writers[id]
	if ok {
		delete(writers, id)
	}
	mu.Unlock()

	if !ok {
		return errorString("invalid writer handle")
	}

	if err := w.Cleanup(); err != nil {
		return errorResult(err)
	}
	return jsObject()
}
