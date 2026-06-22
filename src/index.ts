import { type LoadOptions, loadWasm, type WasmApi } from "./loader.js";

export type { LoadOptions, WasmApi } from "./loader.js";

/**
 * Stages files in memory and writes an ISO 9660 image, backed by the Go
 * implementation compiled to WebAssembly.
 */
export class ISOWriter {
	readonly #api: WasmApi;
	readonly #handle: number;
	#closed = false;

	private constructor(api: WasmApi, handle: number) {
		this.#api = api;
		this.#handle = handle;
	}

	/**
	 * Loads the WebAssembly module (if not already loaded) and allocates a new
	 * writer. The optional {@link LoadOptions} are only honoured on the first
	 * call that triggers module instantiation.
	 */
	static async create(options: LoadOptions = {}): Promise<ISOWriter> {
		const api = await loadWasm(options);
		const res = api.newWriter();
		if (res.error || res.handle === undefined) {
			throw new Error(
				`iso9660-wasm: failed to create writer: ${res.error ?? "no handle returned"}`,
			);
		}
		return new ISOWriter(api, res.handle);
	}

	/**
	 * Stages a file at `path` within the image. Intermediate directories are
	 * created automatically; path components are mangled to satisfy ISO 9660
	 * naming rules. Calling with an existing path overwrites it.
	 */
	addFile(path: string, data: Uint8Array): void {
		this.#assertOpen();
		const res = this.#api.addFile(this.#handle, path, data);
		if (res.error) {
			throw new Error(`iso9660-wasm: failed to add "${path}": ${res.error}`);
		}
	}

	/**
	 * Serialises the staged files into an ISO 9660 image and returns its bytes.
	 * The writer remains usable afterwards; call again after staging more files
	 * to produce an updated image.
	 *
	 * Note: the work runs synchronously on the calling thread inside WASM; the
	 * Promise exists so the image can later be produced off the main thread
	 * without an API change.
	 */
	write(volumeId = ""): Promise<Uint8Array> {
		this.#assertOpen();
		const res = this.#api.write(this.#handle, volumeId);
		if (res.error || res.data === undefined) {
			return Promise.reject(
				new Error(
					`iso9660-wasm: failed to write image: ${res.error ?? "no data returned"}`,
				),
			);
		}
		return Promise.resolve(res.data);
	}

	/**
	 * Releases the writer's in-memory staging area. After this the instance can
	 * no longer be used. Safe to call multiple times.
	 */
	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		const res = this.#api.cleanup(this.#handle);
		if (res.error) {
			throw new Error(`iso9660-wasm: failed to close writer: ${res.error}`);
		}
	}

	#assertOpen(): void {
		if (this.#closed) {
			throw new Error("iso9660-wasm: writer has been closed");
		}
	}
}
