//go:build js && wasm

package main

import "syscall/js"

func jsObject() js.Value {
	return js.Global().Get("Object").New()
}

func uint8Array(length int) js.Value {
	return js.Global().Get("Uint8Array").New(length)
}

func errorResult(err error) js.Value {
	return errorString(err.Error())
}

func errorString(msg string) js.Value {
	res := jsObject()
	res.Set("error", msg)
	return res
}
