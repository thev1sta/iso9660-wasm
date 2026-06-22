import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	platform: "browser",
	dts: true,
	clean: true,
	// Ship the compiled wasm next to the bundle; the loader resolves it relative
	// to import.meta.url.
	copy: [{ from: "src/runtime/iso9660.wasm", to: "dist" }],
});
