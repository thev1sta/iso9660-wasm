// Type declarations for the vendored Go WebAssembly runtime (wasm_exec.js).

/** The Go class drives a `GOOS=js GOARCH=wasm` module's lifecycle. */
export declare class Go {
	/** Import object to pass to WebAssembly.instantiate / instantiateStreaming. */
	importObject: WebAssembly.Imports;
	/** Runs the instantiated module. Resolves when the Go program exits. */
	run(instance: WebAssembly.Instance): Promise<void>;
}
