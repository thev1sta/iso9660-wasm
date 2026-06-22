import { Go } from "./runtime/wasm_exec.js";

/**
 * Shape of the object the Go module registers on `globalThis.__iso9660wasm`.
 * Every call returns a plain object; on failure it carries an `error` string
 * instead of its success payload.
 */
export interface WasmApi {
	newWriter(): { handle?: number; error?: string };
	addFile(handle: number, path: string, data: Uint8Array): { error?: string };
	write(
		handle: number,
		volumeId: string,
	): { data?: Uint8Array; error?: string };
	cleanup(handle: number): { error?: string };
}

export interface LoadOptions {
	/**
	 * Location of the `iso9660.wasm` asset. Defaults to the file shipped next to
	 * this module (resolved via `import.meta.url`). Pass an explicit URL when
	 * serving the asset from a different path or CDN.
	 */
	wasmUrl?: string | URL;
	/**
	 * Pre-fetched wasm bytes. Takes precedence over {@link LoadOptions.wasmUrl}
	 * and avoids a network round-trip — useful when the binary is inlined or
	 * loaded by some other mechanism.
	 */
	wasmBinary?: BufferSource;
}

let apiPromise: Promise<WasmApi> | undefined;

/**
 * Instantiates the Go WebAssembly module (once per page) and resolves with its
 * exported API. Repeated calls return the same cached promise; the first call's
 * options win.
 */
export function loadWasm(options: LoadOptions = {}): Promise<WasmApi> {
	apiPromise ??= instantiate(options);
	return apiPromise;
}

async function instantiate(options: LoadOptions): Promise<WasmApi> {
	const go = new Go();
	const instance = await instantiateModule(options, go);

	// `go.run` resolves only when the Go program exits. Ours blocks forever
	// (`select {}`), so we deliberately don't await it: the synchronous portion
	// of run() executes main() up to the block, registering the API before
	// control returns here.
	void go.run(instance);

	const api = (globalThis as { __iso9660wasm?: WasmApi }).__iso9660wasm;
	if (!api) {
		throw new Error("iso9660-wasm: module did not register its API");
	}
	return api;
}

async function instantiateModule(
	options: LoadOptions,
	go: Go,
): Promise<WebAssembly.Instance> {
	if (options.wasmBinary) {
		const { instance } = await WebAssembly.instantiate(
			options.wasmBinary,
			go.importObject,
		);
		return instance;
	}

	// `new URL("./iso9660.wasm", import.meta.url)` is the literal form that
	// bundlers (webpack/Next, Vite/Astro, Rollup) statically detect to emit the
	// asset, and that raw browsers/CDNs resolve relative to the module URL.
	const url = (
		options.wasmUrl ?? new URL("./iso9660.wasm", import.meta.url)
	).toString();

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`iso9660-wasm: failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}

	// Prefer streaming compilation, but fall back to buffering when the server
	// doesn't advertise `Content-Type: application/wasm` (common on CDNs), which makes streaming throw.
	if (typeof WebAssembly.instantiateStreaming === "function") {
		try {
			const { instance } = await WebAssembly.instantiateStreaming(
				response.clone(),
				go.importObject,
			);
			return instance;
		} catch {
			// Body of `response` is still unread (we cloned it above); fall through.
		}
	}

	const bytes = await response.arrayBuffer();
	const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
	return instance;
}
