# iso9660-wasm
[![Go Reference](https://pkg.go.dev/badge/github.com/thev1sta/iso9660-wasm.svg)](https://pkg.go.dev/github.com/thev1sta/iso9660-wasm)
[![Go Report Card](https://goreportcard.com/badge/github.com/thev1sta/iso9660-wasm)](https://goreportcard.com/report/github.com/thev1sta/iso9660-wasm)

A WebAssembly port of [iso9660](https://github.com/kdomanski/iso9660) library for working with ISO9660 (.iso) files.

Currently only writing ISO images is supported.

**Warning!**
This port is experimental, API and functionality may change in future releases.

## Install
```bash
npm install iso9660-wasm
yarn add iso9660-wasm
pnpm add iso9660-wasm
```

## Examples

### Creating ISO file in browser
```ts
import { ISOWriter } from 'iso9660-wasm';

// Create iso writer instance
const iso = await ISOWriter.create();

// Add file to the iso
iso.addFile("test.txt", new TextEncoder().encode("Hello WebAssembly!"));

// Write image filesystem and get it as a Uint8Array
const image = await iso.write("DEMO_VOLUME"); // volume id

// Close the iso writer instance and free resources
iso.close();

// Download the image as a file
const blob = new Blob([image as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "image.iso";
a.click();
URL.revokeObjectURL(url);
```

Also see [complete example](https://github.com/thev1sta/iso9660-wasm/blob/master/demo/index.html) in `demo` folder.

## References for the format:
- [ECMA-119 1st edition (December 1986)](https://www.ecma-international.org/wp-content/uploads/ECMA-119_1st_edition_december_1986.pdf) ([Web Archive link](http://web.archive.org/web/20210122025258/https://www.ecma-international.org/wp-content/uploads/ECMA-119_1st_edition_december_1986.pdf))
- [ECMA-119 2nd edition (December 1987)](https://www.ecma-international.org/wp-content/uploads/ECMA-119_2nd_edition_december_1987.pdf) ([Web Archive link](http://web.archive.org/web/20210418211711/https://www.ecma-international.org/wp-content/uploads/ECMA-119_2nd_edition_december_1987.pdf))
- [ECMA-119 3rd edition (December 2017)](https://www.ecma-international.org/wp-content/uploads/ECMA-119_3rd_edition_december_2017.pdf) ([Web Archive link](http://web.archive.org/web/20210527165925/https://www.ecma-international.org/wp-content/uploads/ECMA-119_3rd_edition_december_2017.pdf))
- [ECMA-119 4th edition (June 2019)](https://www.ecma-international.org/wp-content/uploads/ECMA-119_4th_edition_june_2019.pdf) ([Web Archive link](https://www.ecma-international.org/wp-content/uploads/ECMA-119_4th_edition_june_2019.pdf))
- [Rock Ridge Interchange Protocol](http://www.nextcomputers.org/NeXTfiles/Projects/CD-ROM/Rock_Ridge_Interchange_Protocol.pdf) ([Web Archive link](http://web.archive.org/web/20071017082049/http://www.nextcomputers.org/NeXTfiles/Projects/CD-ROM/Rock_Ridge_Interchange_Protocol.pdf))
- [System Use Sharing Protocol v1.12](http://aminet.net/package/docs/misc/RRIP)

## TODO
- Implement reading ISO files (with Rockridge)
- Bring back Go tests from upstream repo and adapt them for afero fs
- Rewrite E2E test of WASM from slop placeholder

## Licensing
**Original package**

iso9660 - https://github.com/kdomanski/iso9660

Copyright (c) 2019-2020, Kamil Domański and contributors

This project is licensed under the BSD-2-Clause License - see the LICENSE file for details.

This project includes [spf13/afero](https://github.com/spf13/afero) library by Steve Francia licensed under the Apache License 2.0 which can be obtained from https://www.apache.org/licenses/LICENSE-2.0.txt